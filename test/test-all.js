"use strict";

var OneBuf = require("../OneBuf.js");

var testIndex = process.argv[2];
var testCount = 10000;
// var testCount = 1;

var testDir = "./";
var test0 = require(testDir + "test0.js");
var test1 = require(testDir + "test1.js");
var test2 = require(testDir + "test2.js");
var test3 = require(testDir + "test3.js");
var test4 = require(testDir + "test4.js");
var test5 = require(testDir + "test5.js");
var test6 = require(testDir + "test6.js");
var test7 = require(testDir + "test7.js");
var test8 = require(testDir + "test8.js");

var unitTests = [test0, test1, test2, test3, test4, test5, test6, test7, test8];

function doTest(data, schema, schemaPool) {
    if (schemaPool) {
        for (var i = 0; i < schemaPool.length; i++) {
            OneBuf.loadSchema(schemaPool[i]);
        }
    }
    var struct = OneBuf.loadSchema(schema);

    var encodedData = struct.jsonToBinary(data);
    var decodedData = struct.binaryToJSON(encodedData);

    var same = compare(data, decodedData, 1);

    console.log("======= raw data =======");
    console.log(stringify(data));
    console.log("======= decoded data =======");
    console.log(stringify(decodedData));

    var jsonStr = JSON.stringify(data);

    var stringfiedDataSize = OneBuf.sizeOfUTF8String(jsonStr);
    var binaryDataSize = encodedData.byteLength;
    var compressRate = (binaryDataSize / stringfiedDataSize).toFixed(2);

    console.log("======= same =======");
    console.log(same);
    console.log("======= struct fixed =======");
    console.log(struct.fixed);
    console.log("======= data size =======");
    console.log("stringfiedDataSize: ", stringfiedDataSize);
    console.log("binaryDataSize: ", binaryDataSize);
    console.log("compress rate: ", compressRate);

    console.log("======= performance (x" + testCount + ")=======");
    console.time('encode');
    for (var i = 0; i < testCount; i++) {
        var encodedData = struct.jsonToBinary(data);
    }
    console.timeEnd('encode');

    console.time('decode');
    for (var i = 0; i < testCount; i++) {
        var decodedData = struct.binaryToJSON(encodedData);
    }
    console.timeEnd('decode');

    console.time("encodeJSON");
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

function doOneTest(index) {
    var unitTest = unitTests[index];
    console.log("unitTest: ", index);
    if (!unitTest) {
        console.log(" *** No unitTest *** ");
        return false;
    }
    return doTest(unitTest.data, unitTest.schema, unitTest.schemaPool);
}


if (testIndex !== undefined) {
    doOneTest(parseInt(testIndex) || 0);
} else {
    var sameList = [];
    for (var i = 0; i < unitTests.length; i++) {
        var same = doOneTest(i);
        sameList.push(same);
        console.log("                                          ");
        console.log(" " + sameList.join(", "));
        console.log("                                          ");
        console.log("-------------- unit test end -------------");
        console.log("                                          ");
        console.log("                                          ");
        console.log("                                          ");
        console.log("                                          ");
        console.log("                                          ");
    }
}
