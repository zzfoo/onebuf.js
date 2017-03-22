"use strict";

var innerSchema = {
    id: "inner",
    fields: [{
        name: "innerA",
        type: "int8"
    }, {
        name: "innerB",
        type: "int16"
    }, {
        name: "innerC",
        type: "int32"
    }, {
        name: "innerD",
        type: "uint8"
    }, {
        name: "innerE",
        type: "uint16"
    }, {
        name: "innerF",
        type: "uint32"
    }, {
        name: "innerG",
        type: "float32"
    }]
};

var schema = {
    id: "main",
    fields: [{
        name: "id",
        type: "uint32",
    }, {
        name: "data",
        // type: "inner[12]",
        type: "inner[]",
    }]
};

var data = {
    //  4294967295
    id: 123456789,
    data: [{
        innerA: -127,
        innerB: -32767,
        innerC: -2147483647,
        innerD: 255,
        innerE: 65535,
        innerF: 4294967295,
        innerG: 3.1415926,
    }, {
        innerA: -127,
        innerB: -32767,
        innerC: -2147483647,
        innerD: 255,
        innerE: 65535,
        innerF: 4294967295,
        innerG: 3.1415926,
    }, {
        innerA: -127,
        innerB: -32767,
        innerC: -2147483647,
        innerD: 255,
        innerE: 65535,
        innerF: 4294967295,
        innerG: 3.1415926,
    }, {
        innerA: -127,
        innerB: -32767,
        innerC: -2147483647,
        innerD: 255,
        innerE: 65535,
        innerF: 4294967295,
        innerG: 3.1415926,
    }, {
        innerA: -127,
        innerB: -32767,
        innerC: -2147483647,
        innerD: 255,
        innerE: 65535,
        innerF: 4294967295,
        innerG: 3.1415926,
    }, {
        innerA: -127,
        innerB: -32767,
        innerC: -2147483647,
        innerD: 255,
        innerE: 65535,
        innerF: 4294967295,
        innerG: 3.1415926,
    }, {
        innerA: -127,
        innerB: -32767,
        innerC: -2147483647,
        innerD: 255,
        innerE: 65535,
        innerF: 4294967295,
        innerG: 3.1415926,
    }, {
        innerA: -127,
        innerB: -32767,
        innerC: -2147483647,
        innerD: 255,
        innerE: 65535,
        innerF: 4294967295,
        innerG: 3.1415926,
    }, {
        innerA: -127,
        innerB: -32767,
        innerC: -2147483647,
        innerD: 255,
        innerE: 65535,
        innerF: 4294967295,
        innerG: 3.1415926,
    }, {
        innerA: -127,
        innerB: -32767,
        innerC: -2147483647,
        innerD: 255,
        innerE: 65535,
        innerF: 4294967295,
        innerG: 3.1415926,
    }, {
        innerA: -127,
        innerB: -32767,
        innerC: -2147483647,
        innerD: 255,
        innerE: 65535,
        innerF: 4294967295,
        innerG: 3.1415926,
    }, {
        innerA: -127,
        innerB: -32767,
        innerC: -2147483647,
        innerD: 255,
        innerE: 65535,
        innerF: 4294967295,
        innerG: 3.1415926,
    }]
};

module.exports = {
    schema: schema,
    data: data,
    schemaPool: [innerSchema]
};
