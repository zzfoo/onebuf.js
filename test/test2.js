"use strict";

var schema = {
    id: "main",
    fields: [{
        name: "a",
        type: "int8[]",
    }, {
        name: "b",
        type: "uint8[]",
    }, {
        name: "c",
        type: "int16[]",
    }, {
        name: "d",
        type: "uint16[]",
    }, {
        name: "e",
        type: "int32[]",
    }, {
        name: "f",
        type: "uint32[]",
    }, {
        name: "g",
        type: "float32[]",
    }, {
        name: "h",
        type: "float64[]",
    }, {
        name: "i",
        type: "bool[]",
    }, {
        name: "j",
        type: "string[]",
    }]
};

var data = {
    a: [127, 127, 127],
    b: [255, 255, 255],
    c: [32767, 32767, 32767],
    d: [65535, 65535, 65535],
    e: [2147483647, 2147483647, 2147483647],
    f: [4294967295, 4294967295, 4294967295],
    g: [3.14, 3.14, 3.14],
    h: [2.71, 2.71, 2.71],
    i: [true, true, true],
    j: ["c'est bien!", "je le sais", "c'est pas bon"],
};

module.exports = {
    schema: schema,
    data: data
};





















