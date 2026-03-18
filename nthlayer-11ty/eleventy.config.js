export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ "mirror/nthlayer.co.uk/wp-content": "wp-content" });
  eleventyConfig.addPassthroughCopy({ "mirror/nthlayer.co.uk/wp-includes": "wp-includes" });
  eleventyConfig.addPassthroughCopy({ "mirror/nthlayer.co.uk/wp-json": "wp-json" });
  eleventyConfig.addPassthroughCopy({ "mirror/nthlayer.co.uk/robots.txt": "robots.txt" });

  return {
    dir: {
      input: "mirror/nthlayer.co.uk",
      output: "_site"
    }
  };
}
