"use strict";

var schema = {
    id: "main",
    fields: [{
        name: "a",
        type: "int8",
    }, {
        name: "b",
        type: "uint8",
    }, {
        name: "c",
        type: "int16",
    }, {
        name: "d",
        type: "uint16",
    }, {
        name: "e",
        type: "int32",
    }, {
        name: "f",
        type: "uint32",
    }, {
        name: "g",
        type: "float32",
    }, {
        name: "h",
        type: "float64",
    }, {
        name: "i",
        type: "bool",
    }, {
        name: "j",
        type: "string",
    }]
};

var data = {
    a: 127,
    b: 255,
    c: 32767,
    d: 65535,
    e: 2147483647,
    f: 4294967295,
    g: 3.14,
    h: -999999999999999, //in JavaScript, integers (numbers without a period or exponent notation) are considered accurate up to 15 digits
    i: true,
    j: "cest bien!",
};

module.exports = {
    schema: schema,
    data: data,
};
























