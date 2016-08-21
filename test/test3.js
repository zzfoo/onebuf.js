"use strict";

var schema = {
    id: "main",
    fields: [{
        name: "a",
        type: "int8"
    }, {
        name: "b",
        fields: [{
            name: "c",
            type: "int8",
        }, {
            name: "d",
            type: "int8[]",
        }]
    }]
};

var data = {
    a: 127,
    b: {
        c: 27,
        d: [42, 42, 42]
    }
};

module.exports = {
    schema: schema,
    data: data
};


















