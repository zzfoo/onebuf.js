"use strict";

var OneBuf = OneBuf || {};

(function() {

    OneBuf.loadSchema = function(schema) {
        return new Struct(schema);
    };
    OneBuf.getId = function(dataView) {
        return dataView.getUint16(0);
    };
    OneBuf.schemaPool = {};

    var MAX_ARRAY_LENGTH = (1 << 16) - 1;
    var ID_BYTE = 2;
    var SIZE_BYTE = 2;
    var VALID_BYTE = 1;

    var BasicTypeLength = {
        "int8": 1,
        "uint8": 1,
        "int16": 2,
        "uint16": 2,
        "int32": 4,
        "uint32": 4,
        "float32": 4,
        "float64": 8,
        "bool": 1,
        // "string": 0,
        // "map": 0,
    };

    var KeyTypeLength = {
        "int8": 1,
        "int16": 2,
        "int32": 4,
        // "string": 0,
    };


    var Struct = function(schema) {
        schema.name = schema.name || schema.id;
        OneBuf.schemaPool[schema.name] = schema;

        this.schema = schema;
        this.id = schema.id;
        this.name = schema.name;
        this.fields = schema.fields;
        this.compile();
    };

    Struct.prototype.compile = function() {
        this.parseSchema(this.schema);
        // console.log('==============')
        // console.log(JSON.stringify(this.schema,null,2));
        // console.log('==============')
    };

    Struct.prototype.parseSchema = function(schema) {
        if (schema.fields) {
            var fields = schema.fields;
            for (var i = 0; i < fields.length; i++) {
                var field = fields[i];
                this.parseSchema(field);
            }
        } else {
            var type = schema.type;
            if (type[type.length - 1] == "]") {
                schema.array = true;
                type = schema.type = type.substring(0, type.length - 2);
            }
        }
    };
    ////////////////////////////////////////////////
    ////////////////////////////////////////////////
    ////////////////////////////////////////////////
    ////////////////////////////////////////////////
    ////////////////////////////////////////////////


    Struct.prototype.jsonToBinary = function(data) {
        var fields = this.fields,
            field;
        var bufferLength = ID_BYTE;

        bufferLength += this.calculateLength(this.schema, data, true);

        // console.log("length: ", bufferLength);
        var buffer = new ArrayBuffer(bufferLength);
        var dataView = new DataView(buffer);
        var dataViewIndex = 0;
        dataView.setUint16(dataViewIndex, this.schema.id);
        dataViewIndex += ID_BYTE;

        var dataViewGroup = {
            dataView: dataView,
            dataViewIndex: dataViewIndex
        };
        this.writeToBuffer(this.schema, data, dataViewGroup, true);
        // console.log("dataViewIndex: ", dataViewGroup.dataViewIndex);
        // console.log("dataView: ", dataViewGroup.dataView.byteLength);

        return dataView;
    };

    Struct.prototype.calculateLength = function(schema, data, top) {
        var optional = schema.optional;
        var bufferLength = 0;
        if (optional && !top) {
            bufferLength += VALID_BYTE;
            if (data === null || data === undefined) {
                return bufferLength;
            }
        }

        var fields = schema.fields,
            array = schema.array,
            field;
        if (fields) {
            var fieldCount = fields.length;
            if (array) {
                bufferLength += SIZE_BYTE;

                var arrayLength = data.length;
                for (var i = 0; i < data.length; i++) {
                    for (var j = 0; j < fieldCount; j++) {
                        field = fields[j];
                        bufferLength += this.calculateLength(field, data[i][field.name]);
                    }
                }
            } else {
                for (var i = 0; i < fieldCount; i++) {
                    field = fields[i];
                    bufferLength += this.calculateLength(field, data[field.name]);
                }
            }
        } else {
            var type = schema.type;
            if (array) {
                bufferLength += SIZE_BYTE;

                var arrayLength = data.length;
                for (var i = 0; i < arrayLength; i++) {
                    bufferLength += this.getTypeLength(type, data[i], schema);
                }
            } else {
                bufferLength += this.getTypeLength(type, data, schema);
            }
        }

        return bufferLength;
    };

    Struct.prototype.writeToBuffer = function(schema, data, dataViewGroup, top) {
        var optional = schema.optional;
        var dataView = dataViewGroup.dataView;
        if (optional && !top) {
            if (data === null || data === undefined) {
                dataView.setInt8(dataViewGroup.dataViewIndex, 0);
                dataViewGroup.dataViewIndex += VALID_BYTE;
                return;
            }
            dataView.setInt8(dataViewGroup.dataViewIndex, 1);
            dataViewGroup.dataViewIndex += VALID_BYTE;
        }

        var fields = schema.fields,
            array = schema.array,
            field;
        if (fields) {
            if (array) {
                var arrayLength = data.length;
                var fieldCount = fields.length;

                dataView.setUint16(dataViewGroup.dataViewIndex, arrayLength);
                dataViewGroup.dataViewIndex += SIZE_BYTE;
                for (var i = 0; i < arrayLength; i++) {
                    for (var j = 0; j < fieldCount; j++) {
                        field = fields[j];
                        this.writeToBuffer(field, data[i][field.name], dataViewGroup);
                    }
                }
            } else {
                var fieldCount = fields.length;
                for (var i = 0; i < fieldCount; i++) {
                    field = fields[i];
                    this.writeToBuffer(field, data[field.name], dataViewGroup);
                }
            }
        } else {
            var type = schema.type;
            if (array) {
                var arrayLength = data.length;
                if (arrayLength > MAX_ARRAY_LENGTH) {
                    throw Error("Array too long");
                }
                dataView.setUint16(dataViewGroup.dataViewIndex, arrayLength);
                dataViewGroup.dataViewIndex += SIZE_BYTE;
                for (var i = 0; i < arrayLength; i++) {
                    this.writeTypeToBuffer(type, data[i], dataViewGroup, schema);
                }
            } else {
                this.writeTypeToBuffer(type, data, dataViewGroup, schema);
            }
        }
    };

    /////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////


    Struct.prototype.binaryToJSON = function(dataView) {
        var dataViewIndex = ID_BYTE;
        var dataViewGroup = {
            dataView: dataView,
            dataViewIndex: dataViewIndex
        };
        var data = this.getJSON(this.schema, dataViewGroup, true);
        return data;
    };

    Struct.prototype.getJSON = function(schema, dataViewGroup, top) {
        var optional = schema.optional;
        if (optional && !top) {
            var hasData = !!dataViewGroup.dataView.getInt8(dataViewGroup.dataViewIndex);
            dataViewGroup.dataViewIndex += VALID_BYTE;
            if (!hasData) {
                return null;
            }
        }

        var data;
        var fields = schema.fields,
            array = schema.array,
            field;

        if (fields) {
            if (array) {
                var fieldData;
                var fieldCount = fields.length;
                var arrayLength = dataViewGroup.dataView.getUint16(dataViewGroup.dataViewIndex);
                dataViewGroup.dataViewIndex += SIZE_BYTE;
                data = [];
                for (var i = 0; i < arrayLength; i++) {
                    fieldData = {};
                    data.push(fieldData);

                    for (var j = 0; j < fieldCount; j++) {
                        field = fields[j];
                        fieldData[field.name] = this.getJSON(field, dataViewGroup);
                    }
                }
            } else {
                var fieldData = {};
                var fieldCount = fields.length;
                for (var i = 0; i < fieldCount; i++) {
                    field = fields[i];
                    fieldData[field.name] = this.getJSON(field, dataViewGroup);
                }
                data = fieldData;
            }
        } else {
            var type = schema.type;
            if (array) {
                var arrayLength = dataViewGroup.dataView.getUint16(dataViewGroup.dataViewIndex);
                dataViewGroup.dataViewIndex += SIZE_BYTE;

                data = [];
                for (var i = 0; i < arrayLength; i++) {
                    data.push(this.getTypeJSON(type, dataViewGroup, schema));
                }
            } else {
                data = this.getTypeJSON(type, dataViewGroup, schema);
            }
        }
        return data;
    };

    /////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////

    Struct.prototype.getTypeLength = function(type, value, schema) {
        var length;

        length = this.getBasicTypeLength(type, value);
        if (length !== undefined) {
            return length;
        }

        if (type === "string") {
            return this.getStringLength(value);
        }

        if (type === "map") {
            length = this.getMapLength(schema, value);
            return length;
        }

        var subSchema = OneBuf.schemaPool[type];
        if (subSchema) {
            length = this.calculateLength(subSchema, value, true);
            return length;
        }

        throw Error("Illigal type: " + type);

    };

    Struct.prototype.getMapLength = function(schema, data) {
        var optional = schema.optional;
        var validByte = optional ? VALID_BYTE : 0;
        // 2 byte for key count
        var length = SIZE_BYTE;
        var keyType = schema.keyType;
        var valueType = schema.valueType;
        var value;
        for (var key in data) {
            length += this.getKeyLength(keyType, key);
            value = data[key];
            length += validByte;
            if (value !== null || value !== undefined) {
                length += this.getTypeLength(valueType, value);
            }
        }
        return length;
    };

    Struct.prototype.getKeyLength = function(type, value) {
        if (type === "string") {
            return this.getStringLength(value);
        }

        var length = KeyTypeLength[type];
        if (length === undefined) {
            throw Error("illigal key type: " + type);
        }

        return length;
    };

    Struct.prototype.getBasicTypeLength = function(type) {
        return BasicTypeLength[type];
    };

    Struct.prototype.getStringLength = function(value) {
        return 2 + 2 * value.length;
    };

    Struct.prototype.writeTypeToBuffer = function(type, value, dataViewGroup, schema) {
        // console.log("type: ", type);
        // console.log("value: ", value);
        // console.log("dataViewIndex: ", this.dataViewIndex);
        // console.log("byteLength: ", this.dataView.byteLength);
        var dataView = dataViewGroup.dataView;
        if (type === "map") {
            this.writeMapToBuffer(value, dataViewGroup, schema);
            return;
        }

        var subSchema = OneBuf.schemaPool[type];
        if (subSchema) {
            this.writeToBuffer(subSchema, value, dataViewGroup, true);
            return;
        }

        switch (type) {
            case "int8":
                dataView.setInt8(dataViewGroup.dataViewIndex, value);
                dataViewGroup.dataViewIndex += 1;
                break;
            case "int16":
                dataView.setInt16(dataViewGroup.dataViewIndex, value);
                dataViewGroup.dataViewIndex += 2;
                break;
            case "int32":
                dataView.setInt32(dataViewGroup.dataViewIndex, value);
                dataViewGroup.dataViewIndex += 4;
                break;
            case "uint8":
                dataView.setUint8(dataViewGroup.dataViewIndex, value);
                dataViewGroup.dataViewIndex += 1;
                break;
            case "uint16":
                dataView.setUint16(dataViewGroup.dataViewIndex, value);
                dataViewGroup.dataViewIndex += 2;
                break;
            case "uint32":
                dataView.setUint32(dataViewGroup.dataViewIndex, value);
                dataViewGroup.dataViewIndex += 4;
                break;
            case "float32":
                dataView.setFloat32(dataViewGroup.dataViewIndex, value);
                dataViewGroup.dataViewIndex += 4;
                break;
            case "float64":
                dataView.setFloat64(dataViewGroup.dataViewIndex, value);
                dataViewGroup.dataViewIndex += 8;
                break;
            case "bool":
                value = value ? 1 : 0;
                dataView.setInt8(dataViewGroup.dataViewIndex, value);
                dataViewGroup.dataViewIndex += 1;
                break;
            case "string":
                var length = value.length;
                dataView.setUint16(dataViewGroup.dataViewIndex, length);
                dataViewGroup.dataViewIndex += 2;
                for (var i = 0; i < length; i++) {
                    dataView.setUint16(dataViewGroup.dataViewIndex, value.charCodeAt(i));
                    dataViewGroup.dataViewIndex += 2;
                }
                break;
            default:
                throw Error("Illigal type: " + type);
        }
    };

    Struct.prototype.writeMapToBuffer = function(data, dataViewGroup, schema) {
        var optional = schema.optional;

        var dataView = dataViewGroup.dataView;
        var keyCount = Object.keys(data).length;
        var keyType = schema.keyType;
        var valueType = schema.valueType;
        var value;

        dataView.setUint16(dataViewGroup.dataViewIndex, keyCount);
        dataViewGroup.dataViewIndex += SIZE_BYTE;
        for (var key in data) {
            this.writeTypeToBuffer(keyType, key, dataViewGroup, schema);
            value = data[key];
            if (optional) {
                if (value === null || value === undefined) {
                    dataView.setInt8(dataViewGroup.dataViewIndex, 0);
                    dataViewGroup.dataViewIndex += VALID_BYTE;
                    continue;
                }
                dataView.setInt8(dataViewGroup.dataViewIndex, 1);
                dataViewGroup.dataViewIndex += VALID_BYTE;
            }
            this.writeTypeToBuffer(valueType, value, dataViewGroup, schema);
        }
    };

    Struct.prototype.getTypeJSON = function(type, dataViewGroup, schema) {
        if (type === "map") {
            return this.getMapJSON(dataViewGroup, schema);
        }

        var subSchema = OneBuf.schemaPool[type];
        if (subSchema) {
            return this.getJSON(subSchema, dataViewGroup, true);
        }

        var value;
        switch (type) {
            case "int8":
                value = dataViewGroup.dataView.getInt8(dataViewGroup.dataViewIndex);
                dataViewGroup.dataViewIndex += 1;
                break;
            case "int16":
                value = dataViewGroup.dataView.getInt16(dataViewGroup.dataViewIndex);
                dataViewGroup.dataViewIndex += 2;
                break;
            case "int32":
                value = dataViewGroup.dataView.getInt32(dataViewGroup.dataViewIndex);
                dataViewGroup.dataViewIndex += 4;
                break;
            case "uint8":
                value = dataViewGroup.dataView.getUint8(dataViewGroup.dataViewIndex);
                dataViewGroup.dataViewIndex += 1;
                break;
            case "uint16":
                value = dataViewGroup.dataView.getUint16(dataViewGroup.dataViewIndex);
                dataViewGroup.dataViewIndex += 2;
                break;
            case "uint32":
                value = dataViewGroup.dataView.getUint32(dataViewGroup.dataViewIndex);
                dataViewGroup.dataViewIndex += 4;
                break;
            case "float32":
                value = dataViewGroup.dataView.getFloat32(dataViewGroup.dataViewIndex);
                dataViewGroup.dataViewIndex += 4;
                break;
            case "float64":
                value = dataViewGroup.dataView.getFloat64(dataViewGroup.dataViewIndex);
                dataViewGroup.dataViewIndex += 8;
                break;
            case "bool":
                value = dataViewGroup.dataView.getInt8(dataViewGroup.dataViewIndex) ? true : false;
                dataViewGroup.dataViewIndex += 1;
                break;
            case "string":
                var length = dataViewGroup.dataView.getUint16(dataViewGroup.dataViewIndex);
                dataViewGroup.dataViewIndex += 2;
                var value = "";
                var char;
                var code;
                for (var i = 0; i < length; i++) {
                    code = dataViewGroup.dataView.getUint16(dataViewGroup.dataViewIndex);
                    dataViewGroup.dataViewIndex += 2;
                    value += String.fromCharCode(code);
                }
                break;
            default:
                throw Error("illigal type: ", type);
        }
        return value;
    };

    Struct.prototype.getMapJSON = function(dataViewGroup, schema) {
        var optional = schema.optional;
        var data = {};
        var keyType = schema.keyType;
        var valueType = schema.valueType;

        var keyCount = dataViewGroup.dataView.getUint16(dataViewGroup.dataViewIndex);
        dataViewGroup.dataViewIndex += SIZE_BYTE;
        var key;
        var value;
        for (var i = 0; i < keyCount; i++) {
            key = this.getTypeJSON(keyType, dataViewGroup, schema);
            if (optional) {
                var hasValue = !!dataViewGroup.dataView.getInt8(dataViewGroup.dataViewIndex);
                dataViewGroup.dataViewIndex += VALID_BYTE;
                if (hasValue) {
                    value = this.getTypeJSON(valueType, dataViewGroup, schema);
                } else {
                    value = null;
                }
            } else {
                value = this.getTypeJSON(valueType, dataViewGroup, schema);
            }
            data[key] = value;
        }
        return data;
    };

    OneBuf.sizeOfUTF8String = function(str) {
        if (!str) {
            return 0;
        }
        var sizeInBytes = str.split('')
            .map(function(ch) {
                return ch.charCodeAt(0);
            }).map(function(uchar) {
                return uchar < 128 ? 1 : 2;
            }).reduce(function(curr, next) {
                return curr + next;
            });

        return sizeInBytes;
    };


    if (typeof module === "object" && module && module["exports"]) {
        module["exports"] = OneBuf;
    }

}());
