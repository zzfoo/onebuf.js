"use strict";

var innerSchema = {
    id: "inner",
    fields: [{
        name: "innerA",
        type: "int8"
    }, {
        name: "innerB",
        type: "string"
    }]
};

var schema = {
    id: "main",
    fields: [{
        name: "mainA",
        type: "inner",
    }, {
        name: "mainB",
        type: "inner[]"
    }]
};

var data = {
    mainA: {
        innerA: 43,
        innerB: "look!",
    },
    mainB: [{
        innerA: 42,
        innerB: "think!",
    }, {
        innerA: 41,
        innerB: "thinking!",
    }, {
        innerA: 40,
        innerB: "thought!",
    }]
}

module.exports = {
    schema: schema,
    data: data,
    schemaPool: [innerSchema]
};



































