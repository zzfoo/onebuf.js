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
        "boolean": 1,
        // "string": 0,
        // "map": 0,
    };

    var KeyTypeLength = {
        "int8": 1,
        "int16": 2,
        "int32": 4,
        // "string": 0,
    };

    var Struct = function(schema, fixed) {
        schema.name = schema.name || schema.id;
        OneBuf.schemaPool[schema.name] = schema;

        this.schema = schema;
        this.id = schema.id;
        this.name = schema.name;
        this.fields = schema.fields;
        this._fixed = fixed || fixed === false ? fixed : (schema.fixed !== false);
        this.compile();
    };

    Struct.prototype.compile = function() {
        this.fixedLength = 0;
        this.fixed = this._fixed;
        // this.fixed = true;
        // this.fixed = false;
        if (!this.schema.$compiled) {
            this.parseSchema(this.schema);
            this.schema.$compiled = true;
        } else {
            this.fixed = this.schema.$canFixed;
        }
        // console.log(this.fixed)
        // console.log("fixed:", this.id, this._fixed, this.fixed, this.fixedLength);
        if (!this.fixed) {
            this.fixedLength = null;
        }
        // this.schema.$fixedLength = this.fixedLength;
        // console.log("schema.$canFixed", this.schema.$canFixed);
        // console.log("schema.$fixedLength", this.schema.$fixedLength);
        // console.log('==============')
        // console.log(JSON.stringify(this.schema,null,2));
        // console.log('==============')
    };

    Struct.prototype.parseSchema = function(schema) {
        var canFixed = true;
        var fixedLength = 0;

        if (schema.fields) {
            var fields = schema.fields;
            for (var i = 0; i < fields.length; i++) {
                var field = fields[i];
                this.parseSchema(field);
                canFixed = canFixed && field.$canFixed;
                fixedLength += field.fixedLength;
            }
            schema.$canFixed = canFixed;
            schema.$fixedLength = fixedLength;
            return;
        }

        var type = schema.type || "int8";

        // wholeString, type, sizeCfg, size, arrayCfg, arrayLength
        // 0,           1,      2,      3,      4,      5
        var reg = /([a-z0-9]+)(\((\d*)\))*(\[(\d*)\])*/;
        var check = type.match(reg);
        type = schema.type = check[1];

        if (check[4]) {
            schema.array = true;
        }

        var noop = function() {
            console.log("noop", this.type);
        };
        if (schema.type == "map") {
            schema.$readValue = ReadValueFuns[schema.valueType] || noop;
            schema.$writeValue = WriteValueFuns[schema.valueType] || noop;

            schema.$readKeyValue = ReadValueFuns[schema.keyType] || noop;
            schema.$writeKeyValue = WriteValueFuns[schema.keyType] || noop;
        } else {
            schema.$readValue = ReadValueFuns[schema.type] || noop;
            schema.$writeValue = WriteValueFuns[schema.type] || noop;
        }

        if (!this.fixed) {
            schema.$canFixed = false;
            schema.$fixedLength = 0;
            return;
        }

        var subSchema = OneBuf.schemaPool[type];
        if (subSchema) {
            if (!subSchema.$canFixed) {
                canFixed = false;
            } else {
                fixedLength = subSchema.$fixedLength || 0;
            }
        } else if (type === "map") {
            canFixed = false;
        } else if (type === "string") {
            // schema.string = true;
            schema.$stringLength = parseInt(check[3]) || 0;
            if (!schema.$stringLength) {
                canFixed = false;
            } else {
                fixedLength = 2 + 2 * schema.$stringLength;
            }
        } else {
            fixedLength = this.getBasicTypeLength(type) || 0;
        }

        if (schema.array) {
            schema.array = true;
            schema.$arrayLength = parseInt(check[5]) || 0;
            if (!schema.$arrayLength) {
                canFixed = false;
            } else {
                fixedLength *= schema.$arrayLength;
            }
        }

        schema.$canFixed = canFixed;
        schema.$fixedLength = fixedLength;

        this.fixed = this.fixed && canFixed;
        if (this.fixed) {
            this.fixedLength += fixedLength;
            schema.$_optional = schema.optional;
            schema.optional = false;
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
        if (this.fixed) {
            bufferLength += this.fixedLength;
            // console.log("fixed Length: ", this.fixedLength === this.calculateLength(this.schema, data, true));
        } else {
            bufferLength += this.calculateLength(this.schema, data, true);
        }

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
                for (var i = 0; i < arrayLength; i++) {
                    var _data = data[i];
                    for (var j = 0; j < fieldCount; j++) {
                        field = fields[j];
                        bufferLength += this.calculateLength(field, _data[field.name]);
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
                var fieldCount = fields.length;
                var arrayLength;
                if (!this.fixed) {
                    arrayLength = data.length;
                    dataView.setUint16(dataViewGroup.dataViewIndex, arrayLength);
                    dataViewGroup.dataViewIndex += SIZE_BYTE;
                } else {
                    arrayLength = schema.$arrayLength;
                }
                for (var i = 0; i < arrayLength; i++) {
                    var _data = data[i];
                    for (var j = 0; j < fieldCount; j++) {
                        field = fields[j];
                        this.writeToBuffer(field, _data[field.name], dataViewGroup);
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
                var arrayLength;
                if (!this.fixed) {
                    arrayLength = data.length;
                    if (arrayLength > MAX_ARRAY_LENGTH) {
                        throw Error("Array too long");
                    }
                    dataView.setUint16(dataViewGroup.dataViewIndex, arrayLength);
                    dataViewGroup.dataViewIndex += SIZE_BYTE;
                } else {
                    arrayLength = schema.$arrayLength;
                }
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
        var data = this.readJSON(this.schema, dataViewGroup, true);
        return data;
    };

    Struct.prototype.readJSON = function(schema, dataViewGroup, top) {
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
                var arrayLength;
                if (!this.fixed) {
                    arrayLength = dataViewGroup.dataView.getUint16(dataViewGroup.dataViewIndex);
                    dataViewGroup.dataViewIndex += SIZE_BYTE;
                } else {
                    arrayLength = schema.$arrayLength;
                }
                data = [];
                for (var i = 0; i < arrayLength; i++) {
                    fieldData = {};
                    data.push(fieldData);
                    for (var j = 0; j < fieldCount; j++) {
                        field = fields[j];
                        fieldData[field.name] = this.readJSON(field, dataViewGroup);
                    }
                }
            } else {
                var fieldData = {};
                var fieldCount = fields.length;
                for (var i = 0; i < fieldCount; i++) {
                    field = fields[i];
                    fieldData[field.name] = this.readJSON(field, dataViewGroup);
                }
                data = fieldData;
            }
        } else {
            var type = schema.type;
            if (array) {
                var arrayLength;
                if (!this.fixed) {
                    arrayLength = dataViewGroup.dataView.getUint16(dataViewGroup.dataViewIndex);
                    dataViewGroup.dataViewIndex += SIZE_BYTE;
                } else {
                    arrayLength = schema.$arrayLength;
                }

                data = [];
                for (var i = 0; i < arrayLength; i++) {
                    data.push(this.readTypeJSON(type, dataViewGroup, schema));
                }
            } else {
                data = this.readTypeJSON(type, dataViewGroup, schema);
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
            throw Error("Illigal key type: " + type);
        }

        return length;
    };

    Struct.prototype.getBasicTypeLength = function(type) {
        return BasicTypeLength[type];
    };

    Struct.prototype.getStringLength = function(value) {
        return 2 + 2 * value.length;
    };


    Struct.prototype.readTypeJSON = function(type, dataViewGroup, schema) {

        var subSchema = OneBuf.schemaPool[type];
        if (subSchema) {
            return this.readJSON(subSchema, dataViewGroup, true);
        }
        if (type === "map") {
            return this.readMapJSON(dataViewGroup, schema);
        }
        return schema.$readValue(dataViewGroup, dataViewGroup.dataView, schema);
    };

    Struct.prototype.readMapJSON = function(dataViewGroup, schema) {
        var optional = schema.optional;
        var dataView = dataViewGroup.dataView;
        var keyType = schema.keyType;
        var valueType = schema.valueType;
        var keyCount = dataView.getUint16(dataViewGroup.dataViewIndex);
        dataViewGroup.dataViewIndex += SIZE_BYTE;

        var data = {};
        var key, value;

        for (var i = 0; i < keyCount; i++) {
            key = schema.$readKeyValue(dataViewGroup, dataView, schema);
            if (optional) {
                var hasValue = !!dataView.getInt8(dataViewGroup.dataViewIndex);
                dataViewGroup.dataViewIndex += VALID_BYTE;
                if (hasValue) {
                    value = this.readTypeJSON(valueType, dataViewGroup, schema);
                } else {
                    value = null;
                }
            } else {
                value = this.readTypeJSON(valueType, dataViewGroup, schema);
            }
            data[key] = value;
        }
        return data;
    };

    Struct.prototype.writeTypeToBuffer = function(type, value, dataViewGroup, schema) {
        // console.log("type: ", type);
        // console.log("value: ", value);
        // console.log("dataViewIndex: ", this.dataViewIndex);
        // console.log("byteLength: ", this.dataView.byteLength);
        var subSchema = OneBuf.schemaPool[type];
        if (subSchema) {
            this.writeToBuffer(subSchema, value, dataViewGroup, true);
            return;
        }

        if (type === "map") {
            this.writeMapToBuffer(value, dataViewGroup, schema);
            return;
        }

        return schema.$writeValue(dataViewGroup, dataViewGroup.dataView, value, schema);

    };

    Struct.prototype.writeMapToBuffer = function(data, dataViewGroup, schema) {
        var optional = schema.optional;
        var dataView = dataViewGroup.dataView;
        var keyType = schema.keyType;
        var valueType = schema.valueType;
        var keyCount = Object.keys(data).length;

        var value;

        dataView.setUint16(dataViewGroup.dataViewIndex, keyCount);
        dataViewGroup.dataViewIndex += SIZE_BYTE;
        for (var key in data) {
            schema.$writeKeyValue(dataViewGroup, dataView, key, schema);

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


    ////////////////////////////////////////////////
    ////////////////////////////////////////////////
    ////////////////////////////////////////////////


    var ReadValueFuns = {
        "int8": function(dataViewGroup, dataView) {
            var value = dataView.getInt8(dataViewGroup.dataViewIndex);
            dataViewGroup.dataViewIndex += 1;
            return value;
        },
        "int16": function(dataViewGroup, dataView) {
            var value = dataView.getInt16(dataViewGroup.dataViewIndex);
            dataViewGroup.dataViewIndex += 2;
            return value;
        },
        "int32": function(dataViewGroup, dataView) {
            var value = dataView.getInt32(dataViewGroup.dataViewIndex);
            dataViewGroup.dataViewIndex += 4;
            return value;
        },
        "uint8": function(dataViewGroup, dataView) {
            var value = dataView.getUint8(dataViewGroup.dataViewIndex);
            dataViewGroup.dataViewIndex += 1;
            return value;
        },
        "uint16": function(dataViewGroup, dataView) {
            var value = dataView.getUint16(dataViewGroup.dataViewIndex);
            dataViewGroup.dataViewIndex += 2;
            return value;
        },
        "uint32": function(dataViewGroup, dataView) {
            var value = dataView.getUint32(dataViewGroup.dataViewIndex);
            dataViewGroup.dataViewIndex += 4;
            return value;
        },
        "float32": function(dataViewGroup, dataView) {
            var value = dataView.getFloat32(dataViewGroup.dataViewIndex);
            dataViewGroup.dataViewIndex += 4;
            return value;
        },
        "float64": function(dataViewGroup, dataView) {
            var value = dataView.getFloat64(dataViewGroup.dataViewIndex);
            dataViewGroup.dataViewIndex += 8;
            return value;
        },
        "bool": function(dataViewGroup, dataView) {
            var value = dataView.getInt8(dataViewGroup.dataViewIndex) ? true : false;
            dataViewGroup.dataViewIndex += 1;
            return value;
        },
        "string": function(dataViewGroup, dataView, schema) {
            var stringLength;
            if (schema.$canFixed) {
                stringLength = schema.$stringLength;
            } else {
                stringLength = dataView.getUint16(dataViewGroup.dataViewIndex);
                dataViewGroup.dataViewIndex += 2;
            }
            var value = "";
            var char, code;
            for (var i = 0; i < stringLength; i++) {
                code = dataView.getUint16(dataViewGroup.dataViewIndex);
                dataViewGroup.dataViewIndex += 2;
                value += String.fromCharCode(code);
            }
            return value;
        },
    };
    ReadValueFuns["boolean"] = ReadValueFuns["bool"];


    var WriteValueFuns = {
        "int8": function(dataViewGroup, dataView, value) {
            dataView.setInt8(dataViewGroup.dataViewIndex, value);
            dataViewGroup.dataViewIndex += 1;
        },
        "int16": function(dataViewGroup, dataView, value) {
            dataView.setInt16(dataViewGroup.dataViewIndex, value);
            dataViewGroup.dataViewIndex += 2;
        },
        "int32": function(dataViewGroup, dataView, value) {
            dataView.setInt32(dataViewGroup.dataViewIndex, value);
            dataViewGroup.dataViewIndex += 4;
        },
        "uint8": function(dataViewGroup, dataView, value) {
            dataView.setUint8(dataViewGroup.dataViewIndex, value);
            dataViewGroup.dataViewIndex += 1;
        },
        "uint16": function(dataViewGroup, dataView, value) {
            dataView.setUint16(dataViewGroup.dataViewIndex, value);
            dataViewGroup.dataViewIndex += 2;
        },
        "uint32": function(dataViewGroup, dataView, value) {
            dataView.setUint32(dataViewGroup.dataViewIndex, value);
            dataViewGroup.dataViewIndex += 4;
        },
        "float32": function(dataViewGroup, dataView, value) {
            dataView.setFloat32(dataViewGroup.dataViewIndex, value);
            dataViewGroup.dataViewIndex += 4;
        },
        "float64": function(dataViewGroup, dataView, value) {
            dataView.setFloat64(dataViewGroup.dataViewIndex, value);
            dataViewGroup.dataViewIndex += 8;
        },
        "bool": function(dataViewGroup, dataView, value) {
            value = value ? 1 : 0;
            dataView.setInt8(dataViewGroup.dataViewIndex, value);
            dataViewGroup.dataViewIndex += 1;
        },
        "string": function(dataViewGroup, dataView, value, schema) {
            var stringLength;
            if (schema.$canFixed) {
                stringLength = schema.$stringLength;
            } else {
                stringLength = value.length;
                dataView.setUint16(dataViewGroup.dataViewIndex, stringLength);
                dataViewGroup.dataViewIndex += 2;
            }
            for (var i = 0; i < stringLength; i++) {
                dataView.setUint16(dataViewGroup.dataViewIndex, value.charCodeAt(i));
                dataViewGroup.dataViewIndex += 2;
            }
        },
    };
    WriteValueFuns["boolean"] = WriteValueFuns["bool"];

    ////////////////////////////////////////////////
    ////////////////////////////////////////////////
    ////////////////////////////////////////////////


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
