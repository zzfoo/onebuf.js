"use strict";

var inner1Schema = {
    id: "inner1",
    fields: [{
        name: "inner1A",
        type: "int8"
    }, {
        name: "inner1B",
        type: "string"
    }]
};

var inner2Schema = {
    id: "inner2",
    fields: [{
        name: "inner2A",
        type: "int8"
    }, {
        name: "inner2B",
        type: "inner1"
    }]
};

var schema = {
    id: "main",
    fields: [{
        name: "mainA",
        type: "int8"
    }, {
        name: "mainB",
        type: "inner2"
    }]
};

var data = {
    mainA: 10,
    mainB: {
        inner2A: 9,
        inner2B: {
            inner1A: 8,
            inner1B: "yolo!"
        }
    }
};

module.exports = {
    schema: schema,
    data: data,
    schemaPool: [inner1Schema, inner2Schema]
}
