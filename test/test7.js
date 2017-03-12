"use strict";

var innerSchema = {
    id: "inner",
    type: "int8[]",
    // type: "int8[9]",
    // fixed: true,
};

var schema = {
    id: "main",
    type: "inner[]",
    // type: "inner[9]",
    // fixed: true,
};

var data = [
    [1, 2, 3, 4, 5, 6, 7, 8, 9],
    [2, 3, 4, 5, 6, 7, 8, 9, 1],
    [3, 4, 5, 6, 7, 8, 9, 1, 2],
    [4, 5, 6, 7, 8, 9, 1, 2, 3],
    [5, 6, 7, 8, 9, 1, 2, 3, 4],
    [6, 7, 8, 9, 1, 2, 3, 4, 5],
    [7, 8, 9, 1, 2, 3, 4, 5, 6],
    [8, 9, 1, 2, 3, 4, 5, 6, 7],
    [9, 1, 2, 3, 4, 5, 6, 7, 8],
];

module.exports = {
    schema: schema,
    data: data,
    schemaPool: [innerSchema]
}
