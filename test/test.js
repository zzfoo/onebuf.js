"use strict";

var OneBuf = require("../OneBuf.js");

var getSchema = function(id) {
    var schema = {
        id: id || "user",
        fields: [{
            name: "sn",
            type: "uint16",
        }, {
            name: "name",
            type: "string(3)",
            optional: true,
        }, {
            name: "gender",
            type: "uint8",
        }, {
            name: "age",
            type: "uint8",
        }, {
            name: "height",
            type: "float32",
        }, {
            name: "weight",
            type: "float32",
        }, {
            name: "score",
            type: "uint8[10]",
        }, ]
    };
    return schema;
}

var userData = {
    sn: 1234,
    name: "Tom",
    gender: 1,
    age: 32,
    height: 177.50,
    weight: 87.50,
    score: [
        11, 22, 33, 44, 55, 66, 77, 88, 99, 100
    ]
};

var testCount = 10000;

var struct = doTest(userData, getSchema());
// console.log(OneBuf.schemaPool["user"]);
testPerformance(userData, getSchema(), testCount);


function doTest(data, schema, schemaPool) {
    if (schemaPool) {
        for (var i = 0; i < schemaPool.length; i++) {
            OneBuf.loadSchema(schemaPool[i]);
        }
    }
    var struct = OneBuf.loadSchema(schema);

    var encodedData = struct.encode(data);
    var decodedData = struct.decode(encodedData);

    var same = compare(data, decodedData, 1);

    console.log("======= raw data =======");
    console.log(stringify(data));
    console.log("======= decoded data =======");
    console.log(stringify(decodedData));

    var stringfiedDataSize = OneBuf.sizeOfUTF8String(JSON.stringify(data));
    var binaryDataSize = encodedData.byteLength;
    var compressRate = (binaryDataSize / stringfiedDataSize).toFixed(2);
    console.log("======= same =======");
    console.log(same);
    console.log("======= data size =======");
    console.log("stringfiedDataSize: ", stringfiedDataSize);
    console.log("binaryDataSize: ", binaryDataSize);
    console.log("compress rate: ", compressRate);
    console.log("\n");

    return same;
}

function stringify(object) {
    return JSON.stringify(object, null, 2);
}

function compare(data1, data2, floatFixed) {
    var type1 = typeof data1;
    if (type1 !== typeof data2) {
        return false;
    }
    if (type1 === "string" || type1 === "boolean" || type1 === "undefined") {
        return data1 === data2;
    }
    if (type1 === "number") {
        if (floatFixed) {
            data1 = data1.toFixed(floatFixed || 1);
            data2 = data2.toFixed(floatFixed || 1);
        }
        return data1 === data2;
    }
    if (type1 === "function") {
        return false;
    }

    var arr1 = Array.isArray(data1);

    if (arr1 !== Array.isArray(data2)) {
        return false;
    }

    if (arr1) {
        if (data1.length !== data2.length) {
            return false;
        }
        for (var i = 0; i < data1.length; i++) {
            var value1 = data1[i];
            var value2 = data2[i];
            if (!compare(value1, value2, floatFixed)) {
                return false;
            }
        }
        return true;
    }

    var key1 = Object.keys(data1);
    var key2 = Object.keys(data2);
    if (key1.length !== key2.length) {
        return false;
    }
    for (var i = 0; i < key1.length; i++) {
        var key = key1[i];
        var value1 = data1[key];
        if (!(key in data2)) {
            return false;
        }
        var value2 = data2[key];
        if (!compare(value1, value2, floatFixed)) {
            return false;
        }
    }
    return true;
}

function testPerformance(data, schema, testCount) {
    console.log("======= performance test =======");

    testCount = testCount || 100;
    var struct = OneBuf.loadSchema(schema);

    console.log("struct fixed: ", struct.fixed);

    console.time("encode");
    var bin;
    for (var i = 0; i < testCount; i++) {
        bin = struct.encode(data);
    }
    console.timeEnd("encode");

    console.time("decode");
    for (var i = 0; i < testCount; i++) {
        struct.decode(bin);
    }
    console.timeEnd("decode");

    console.time("encodeJSON");
    var jsonStr;
    for (var i = 0; i < testCount; i++) {
        jsonStr = JSON.stringify(data);
    }
    console.timeEnd("encodeJSON");

    console.time("decodeJSON");
    for (var i = 0; i < testCount; i++) {
        JSON.parse(jsonStr);
    }
    console.timeEnd("decodeJSON");


    console.log("\n");
}
