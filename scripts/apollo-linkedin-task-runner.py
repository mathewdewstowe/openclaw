#!/usr/bin/env python3
"""
Process Apollo LinkedIn connection tasks via a live Chrome CDP session.

Flow per task:
1. Read current Apollo task detail page
2. Extract LinkedIn profile URL + connection request message
3. Open profile in new tab
4. Click Connect -> Add note -> paste Apollo message -> Send
5. Return to Apollo and click Manually complete
6. Advance to next task

Stops on uncertain UI states rather than guessing.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

CDP_URL = "http://127.0.0.1:9222"
LOG_PATH = Path("/home/matthewdewstowe/.openclaw/workspace/memory/apollo-linkedin-task-runner.json")


def sleep(ms: int):
    time.sleep(ms / 1000)


def log_event(entry: dict):
    existing = []
    if LOG_PATH.exists():
        try:
            existing = json.loads(LOG_PATH.read_text())
        except Exception:
            existing = []
    existing.append(entry)
    LOG_PATH.write_text(json.dumps(existing, indent=2))


def get_apollo_task_data(page):
    return page.evaluate(
        r"""() => {
        const taskTitleLink = [...document.querySelectorAll('a')].find(a => (a.getAttribute('href') || '').includes('/#/contacts/'));
        const profile = [...document.querySelectorAll('a')].find(a => (a.innerText || '').includes('LinkedIn Profile'));
        const textarea = [...document.querySelectorAll('textarea')].find(t =>
          (t.placeholder || '').includes('Type the message to be sent with the connection request') ||
          ((t.value || '').trim().startsWith('Hi '))
        );
        const bodyText = document.body?.innerText || '';
        const counterMatch = bodyText.match(/Task \d+ of \d+/);
        return {
          title: taskTitleLink?.innerText?.trim() || '',
          linkedinUrl: profile?.href || null,
          message: textarea?.value || '',
          taskCounter: counterMatch ? counterMatch[0] : null,
          taskType: bodyText.includes('LinkedIn: Send Connection Request') ? 'LinkedIn: Send Connection Request' : null,
        };
      }"""
    )


def ensure_apollo_task_page(page):
    if '/#/tasks/' not in page.url:
        raise RuntimeError(f'Not on an Apollo task detail page: {page.url}')
    page.wait_for_load_state('domcontentloaded', timeout=15000)
    sleep(1500)


def click_button_by_text(page, text, timeout=8000):
    page.get_by_role('button', name=text).click(timeout=timeout)


def maybe_click(page, role, name, timeout=3000):
    try:
        page.get_by_role(role, name=name).click(timeout=timeout)
        return True
    except Exception:
        return False


def linkedin_send_connection(context, profile_url: str, message: str, dry_run: bool = False):
    page = context.new_page()
    try:
        page.goto(profile_url, wait_until='domcontentloaded', timeout=30000)
        sleep(3000)

        if 'linkedin.com' not in page.url:
            raise RuntimeError(f'Unexpected LinkedIn URL: {page.url}')
        if 'login' in page.url or 'checkpoint' in page.url:
            raise RuntimeError(f'LinkedIn requires login/checkpoint: {page.url}')

        # Try direct Connect button first.
        connected = False
        sent = False
        status = 'unknown'

        def text_present(txt):
            try:
                return page.get_by_role('button', name=txt).count() > 0
            except Exception:
                return False

        if dry_run:
            return {'status': 'dry-run', 'url': page.url}

        try:
            page.get_by_role('button', name='Connect').first.click(timeout=5000)
            connected = True
        except Exception:
            # Fallback via More menu.
            more_clicked = False
            for label in ['More actions', 'More']:
                try:
                    page.get_by_role('button', name=label).first.click(timeout=4000)
                    more_clicked = True
                    sleep(1000)
                    break
                except Exception:
                    continue
            if more_clicked:
                try:
                    page.get_by_role('button', name='Connect').click(timeout=4000)
                    connected = True
                except Exception:
                    try:
                        page.get_by_text('Connect', exact=True).click(timeout=4000)
                        connected = True
                    except Exception:
                        connected = False

        if not connected:
            # Check if already pending/connected/follow-only.
            body = page.locator('body').inner_text(timeout=5000)
            if 'Pending' in body or 'Message' in body or '1st' in body:
                status = 'already-connected-or-pending'
                return {'status': status, 'url': page.url}
            raise RuntimeError('Could not find a usable Connect action on LinkedIn profile')

        sleep(1500)

        # Add note if available.
        maybe_click(page, 'button', 'Add a note', timeout=4000)
        sleep(1200)

        note_box = None
        for sel in ['textarea[name="message"]', 'textarea', '[contenteditable="true"]']:
            try:
                loc = page.locator(sel).first
                if loc.count() and loc.is_visible(timeout=1500):
                    note_box = loc
                    break
            except Exception:
                continue

        if note_box is None:
            raise RuntimeError('LinkedIn note box did not appear')

        try:
            note_box.fill(message, timeout=5000)
        except Exception:
            note_box.click(timeout=3000)
            page.keyboard.press('Control+A')
            page.keyboard.type(message, delay=15)

        sleep(1000)

        send_names = ['Send', 'Send without a note']
        for name in send_names:
            try:
                page.get_by_role('button', name=name).click(timeout=5000)
                sent = True
                break
            except Exception:
                continue
        if not sent:
            raise RuntimeError('Could not click LinkedIn send button')

        sleep(2500)
        return {'status': 'sent', 'url': page.url}
    finally:
        try:
            page.close()
        except Exception:
            pass


def manual_complete_apollo_task(page):
    click_button_by_text(page, 'Manually complete', timeout=8000)
    sleep(1500)
    # Some UIs keep you on current task and move automatically; some need explicit next.
    return True


def goto_next_task(page):
    try:
        page.get_by_role('button', name='Next Task').click(timeout=5000)
        sleep(2000)
        return True
    except Exception:
        return False


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--max', type=int, default=1)
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()

    with sync_playwright() as p:
        browser = p.chromium.connect_over_cdp(CDP_URL)
        pages = [pg for ctx in browser.contexts for pg in ctx.pages]
        apollo = next((pg for pg in pages if '/#/tasks/' in pg.url), None)
        if apollo is None:
            raise RuntimeError('No Apollo task detail page found in Chrome. Open a task first.')
        context = apollo.context

        processed = 0
        results = []

        while processed < args.max:
            ensure_apollo_task_page(apollo)
            task = get_apollo_task_data(apollo)
            if not task.get('linkedinUrl') or not task.get('message'):
                raise RuntimeError(f'Missing LinkedIn URL or message on Apollo task page: {task}')

            title = task.get('title') or 'Unknown task'
            print(f"\n=== Processing {processed+1}/{args.max}: {title} ===")
            print(task.get('taskCounter') or '')
            print(task.get('linkedinUrl'))

            li = linkedin_send_connection(context, task['linkedinUrl'], task['message'], dry_run=args.dry_run)
            print('LinkedIn result:', li['status'])

            if li['status'] == 'sent' or li['status'] == 'already-connected-or-pending':
                if not args.dry_run:
                    manual_complete_apollo_task(apollo)
                    print('Apollo task marked manually complete')
            else:
                raise RuntimeError(f"LinkedIn action failed for {title}: {li}")

            result = {
                'title': title,
                'taskCounter': task.get('taskCounter'),
                'linkedinUrl': task.get('linkedinUrl'),
                'linkedinStatus': li['status'],
                'completedInApollo': not args.dry_run,
                'ts': time.time(),
            }
            results.append(result)
            log_event(result)
            processed += 1

            if processed >= args.max:
                break
            if not goto_next_task(apollo):
                print('No next task button available; stopping.')
                break

        print('\nDone.')
        print(json.dumps(results, indent=2))


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f'ERROR: {e}', file=sys.stderr)
        raise
