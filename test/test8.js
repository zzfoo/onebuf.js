"use strict";

var innerSchema = {
    id: "inner",
    type: "map",
    keyType: "string",
    valueType: "string"
};

var schema = {
    id: "main",
    fields: [{
        name: "a",
        type: "int8"
    }, {
        name: "b",
        type: "map",
        keyType: "string",
        valueType: "int32"
    }, {
        name: "c",
        type: "map",
        keyType: "string",
        valueType: "inner"
    }]
};

var data = {
    a: 1,
    b: {
        "b0": 10,
        "b1": 11,
        "b2": 12,
        "b3": -15,
    },
    c: {
        "yo": { "a": "lo", "b": "e0" },
        "so": { "a": "lo", "b": "e1" },
        "co": { "a": "co", "b": "e2" },
        "mo": { "a": "mo", "b": "e3" },
    }
};

module.exports = {
    schema: schema,
    data: data,
    schemaPool: [innerSchema]
};
