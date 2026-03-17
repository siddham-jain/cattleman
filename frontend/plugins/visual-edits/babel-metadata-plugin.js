// Babel plugin for source metadata
module.exports = function babelMetadataPlugin() {
  return {
    visitor: {
      JSXElement(path, state) {
        const { node } = path;
        if (node.openingElement.name.name) {
          node.openingElement.attributes.push(
            state.addImport("react", "createElement"));
        }
      }
    }
  };
};
