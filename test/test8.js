"use strict";

var schema = {
    id: "main",
    fields: [{
        name: "a",
        type: "int8"
    }, {
        name: "b",
        type: "map",
        keyType: "string",
        valueType: "string"
    }]
};

var data = {
    a: 1,
    b: {
        "yo": "lo",
        "so": "lo",
        "co": "co",
        "mo": "mo",
    }
};

module.exports = {
    schema: schema,
    data: data
};




































