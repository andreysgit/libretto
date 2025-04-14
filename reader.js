const bookPath = window.readerAPI.getBookPath();
console.log("Book path:", bookPath);

const readerDiv = document.getElementById('reader');

window.readerAPI.getBookBuffer(bookPath)
  .then((arrayBuffer) => {
    console.log("Buffer loaded:", arrayBuffer.byteLength);

    const book = ePub(arrayBuffer);
    const rendition = book.renderTo(readerDiv, {
      width: "100%",
      height: "100%",
      allowScriptedContent: true
    });

    rendition.hooks.content.register((contents) => {
        // Unsandbox iframe
        const frame = contents.document.defaultView?.frameElement;
        if (frame && frame.hasAttribute('sandbox')) {
          frame.removeAttribute('sandbox');
          console.log("Removed sandbox from iframe");
        }
      
        // Remove all <script> tags inside book content
        const scripts = contents.document.querySelectorAll("script");
        scripts.forEach((script) => {
          console.warn("Stripped <script> from book:", script.outerHTML);
          script.remove();
        });
      });

    rendition.display().then(() => {
      console.log("Book displayed");
    });
  })
  .catch(err => {
    console.error("Error loading or displaying book:", err);
  });