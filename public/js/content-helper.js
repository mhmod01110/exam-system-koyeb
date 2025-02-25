const contentHelpers = {
    contents: {},
    
    contentFor: function(name, content) {
        this.contents[name] = content;
    },
    
    getContent: function(name) {
        return this.contents[name] || '';
    },
    
    reset: function() {
        this.contents = {};
    }
};

const attachContentHelpers = (req, res, next) => {
    res.locals.contentFor = function(name, content) {
        contentHelpers.contentFor(name, content);
    };
    
    res.locals.getContent = function(name) {
        return contentHelpers.getContent(name);
    };
    
    contentHelpers.reset();
    next();
};

module.exports = { attachContentHelpers };