/*!
 * @maptalks/gl v0.2.4
 * LICENSE : UNLICENSED
 * (c) 2016-2019 maptalks.org
 */
(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('assert'), require('maptalks')) :
	typeof define === 'function' && define.amd ? define(['exports', 'assert', 'maptalks'], factory) :
	(global = global || self, factory(global.maptalksgl = {}, global.assert, global.maptalks));
}(this, function (exports, assert, maptalks) { 'use strict';

	assert = assert && assert.hasOwnProperty('default') ? assert['default'] : assert;

	var commonjsGlobal = typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

	function createCommonjsModule(fn, module) {
		return module = { exports: {} }, fn(module, module.exports), module.exports;
	}

	var regl = createCommonjsModule(function (module, exports) {
	  (function (global, factory) {
	    module.exports = factory();
	  })(commonjsGlobal, function () {

	    var isTypedArray = function isTypedArray(x) {
	      return x instanceof Uint8Array || x instanceof Uint16Array || x instanceof Uint32Array || x instanceof Int8Array || x instanceof Int16Array || x instanceof Int32Array || x instanceof Float32Array || x instanceof Float64Array || x instanceof Uint8ClampedArray;
	    };

	    var extend = function extend(base, opts) {
	      var keys = Object.keys(opts);

	      for (var i = 0; i < keys.length; ++i) {
	        base[keys[i]] = opts[keys[i]];
	      }

	      return base;
	    };

	    var endl = '\n';

	    function decodeB64(str) {
	      if (typeof atob !== 'undefined') {
	        return atob(str);
	      }

	      return 'base64:' + str;
	    }

	    function raise(message) {
	      var error = new Error('(regl) ' + message);
	      console.error(error);
	      throw error;
	    }

	    function check(pred, message) {
	      if (!pred) {
	        raise(message);
	      }
	    }

	    function encolon(message) {
	      if (message) {
	        return ': ' + message;
	      }

	      return '';
	    }

	    function checkParameter(param, possibilities, message) {
	      if (!(param in possibilities)) {
	        raise('unknown parameter (' + param + ')' + encolon(message) + '. possible values: ' + Object.keys(possibilities).join());
	      }
	    }

	    function checkIsTypedArray(data, message) {
	      if (!isTypedArray(data)) {
	        raise('invalid parameter type' + encolon(message) + '. must be a typed array');
	      }
	    }

	    function checkTypeOf(value, type, message) {
	      if (typeof value !== type) {
	        raise('invalid parameter type' + encolon(message) + '. expected ' + type + ', got ' + typeof value);
	      }
	    }

	    function checkNonNegativeInt(value, message) {
	      if (!(value >= 0 && (value | 0) === value)) {
	        raise('invalid parameter type, (' + value + ')' + encolon(message) + '. must be a nonnegative integer');
	      }
	    }

	    function checkOneOf(value, list, message) {
	      if (list.indexOf(value) < 0) {
	        raise('invalid value' + encolon(message) + '. must be one of: ' + list);
	      }
	    }

	    var constructorKeys = ['gl', 'canvas', 'container', 'attributes', 'pixelRatio', 'extensions', 'optionalExtensions', 'profile', 'onDone'];

	    function checkConstructor(obj) {
	      Object.keys(obj).forEach(function (key) {
	        if (constructorKeys.indexOf(key) < 0) {
	          raise('invalid regl constructor argument "' + key + '". must be one of ' + constructorKeys);
	        }
	      });
	    }

	    function leftPad(str, n) {
	      str = str + '';

	      while (str.length < n) {
	        str = ' ' + str;
	      }

	      return str;
	    }

	    function ShaderFile() {
	      this.name = 'unknown';
	      this.lines = [];
	      this.index = {};
	      this.hasErrors = false;
	    }

	    function ShaderLine(number, line) {
	      this.number = number;
	      this.line = line;
	      this.errors = [];
	    }

	    function ShaderError(fileNumber, lineNumber, message) {
	      this.file = fileNumber;
	      this.line = lineNumber;
	      this.message = message;
	    }

	    function guessCommand() {
	      var error = new Error();
	      var stack = (error.stack || error).toString();
	      var pat = /compileProcedure.*\n\s*at.*\((.*)\)/.exec(stack);

	      if (pat) {
	        return pat[1];
	      }

	      var pat2 = /compileProcedure.*\n\s*at\s+(.*)(\n|$)/.exec(stack);

	      if (pat2) {
	        return pat2[1];
	      }

	      return 'unknown';
	    }

	    function guessCallSite() {
	      var error = new Error();
	      var stack = (error.stack || error).toString();
	      var pat = /at REGLCommand.*\n\s+at.*\((.*)\)/.exec(stack);

	      if (pat) {
	        return pat[1];
	      }

	      var pat2 = /at REGLCommand.*\n\s+at\s+(.*)\n/.exec(stack);

	      if (pat2) {
	        return pat2[1];
	      }

	      return 'unknown';
	    }

	    function parseSource(source, command) {
	      var lines = source.split('\n');
	      var lineNumber = 1;
	      var fileNumber = 0;
	      var files = {
	        unknown: new ShaderFile(),
	        0: new ShaderFile()
	      };
	      files.unknown.name = files[0].name = command || guessCommand();
	      files.unknown.lines.push(new ShaderLine(0, ''));

	      for (var i = 0; i < lines.length; ++i) {
	        var line = lines[i];
	        var parts = /^\s*\#\s*(\w+)\s+(.+)\s*$/.exec(line);

	        if (parts) {
	          switch (parts[1]) {
	            case 'line':
	              var lineNumberInfo = /(\d+)(\s+\d+)?/.exec(parts[2]);

	              if (lineNumberInfo) {
	                lineNumber = lineNumberInfo[1] | 0;

	                if (lineNumberInfo[2]) {
	                  fileNumber = lineNumberInfo[2] | 0;

	                  if (!(fileNumber in files)) {
	                    files[fileNumber] = new ShaderFile();
	                  }
	                }
	              }

	              break;

	            case 'define':
	              var nameInfo = /SHADER_NAME(_B64)?\s+(.*)$/.exec(parts[2]);

	              if (nameInfo) {
	                files[fileNumber].name = nameInfo[1] ? decodeB64(nameInfo[2]) : nameInfo[2];
	              }

	              break;
	          }
	        }

	        files[fileNumber].lines.push(new ShaderLine(lineNumber++, line));
	      }

	      Object.keys(files).forEach(function (fileNumber) {
	        var file = files[fileNumber];
	        file.lines.forEach(function (line) {
	          file.index[line.number] = line;
	        });
	      });
	      return files;
	    }

	    function parseErrorLog(errLog) {
	      var result = [];
	      errLog.split('\n').forEach(function (errMsg) {
	        if (errMsg.length < 5) {
	          return;
	        }

	        var parts = /^ERROR\:\s+(\d+)\:(\d+)\:\s*(.*)$/.exec(errMsg);

	        if (parts) {
	          result.push(new ShaderError(parts[1] | 0, parts[2] | 0, parts[3].trim()));
	        } else if (errMsg.length > 0) {
	          result.push(new ShaderError('unknown', 0, errMsg));
	        }
	      });
	      return result;
	    }

	    function annotateFiles(files, errors) {
	      errors.forEach(function (error) {
	        var file = files[error.file];

	        if (file) {
	          var line = file.index[error.line];

	          if (line) {
	            line.errors.push(error);
	            file.hasErrors = true;
	            return;
	          }
	        }

	        files.unknown.hasErrors = true;
	        files.unknown.lines[0].errors.push(error);
	      });
	    }

	    function checkShaderError(gl, shader, source, type, command) {
	      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
	        var errLog = gl.getShaderInfoLog(shader);
	        var typeName = type === gl.FRAGMENT_SHADER ? 'fragment' : 'vertex';
	        checkCommandType(source, 'string', typeName + ' shader source must be a string', command);
	        var files = parseSource(source, command);
	        var errors = parseErrorLog(errLog);
	        annotateFiles(files, errors);
	        Object.keys(files).forEach(function (fileNumber) {
	          var file = files[fileNumber];

	          if (!file.hasErrors) {
	            return;
	          }

	          var strings = [''];
	          var styles = [''];

	          function push(str, style) {
	            strings.push(str);
	            styles.push(style || '');
	          }

	          push('file number ' + fileNumber + ': ' + file.name + '\n', 'color:red;text-decoration:underline;font-weight:bold');
	          file.lines.forEach(function (line) {
	            if (line.errors.length > 0) {
	              push(leftPad(line.number, 4) + '|  ', 'background-color:yellow; font-weight:bold');
	              push(line.line + endl, 'color:red; background-color:yellow; font-weight:bold');
	              var offset = 0;
	              line.errors.forEach(function (error) {
	                var message = error.message;
	                var token = /^\s*\'(.*)\'\s*\:\s*(.*)$/.exec(message);

	                if (token) {
	                  var tokenPat = token[1];
	                  message = token[2];

	                  switch (tokenPat) {
	                    case 'assign':
	                      tokenPat = '=';
	                      break;
	                  }

	                  offset = Math.max(line.line.indexOf(tokenPat, offset), 0);
	                } else {
	                  offset = 0;
	                }

	                push(leftPad('| ', 6));
	                push(leftPad('^^^', offset + 3) + endl, 'font-weight:bold');
	                push(leftPad('| ', 6));
	                push(message + endl, 'font-weight:bold');
	              });
	              push(leftPad('| ', 6) + endl);
	            } else {
	              push(leftPad(line.number, 4) + '|  ');
	              push(line.line + endl, 'color:red');
	            }
	          });

	          if (typeof document !== 'undefined' && !window.chrome) {
	            styles[0] = strings.join('%c');
	            console.log.apply(console, styles);
	          } else {
	            console.log(strings.join(''));
	          }
	        });
	        check.raise('Error compiling ' + typeName + ' shader, ' + files[0].name);
	      }
	    }

	    function checkLinkError(gl, program, fragShader, vertShader, command) {
	      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
	        var errLog = gl.getProgramInfoLog(program);
	        var fragParse = parseSource(fragShader, command);
	        var vertParse = parseSource(vertShader, command);
	        var header = 'Error linking program with vertex shader, "' + vertParse[0].name + '", and fragment shader "' + fragParse[0].name + '"';

	        if (typeof document !== 'undefined') {
	          console.log('%c' + header + endl + '%c' + errLog, 'color:red;text-decoration:underline;font-weight:bold', 'color:red');
	        } else {
	          console.log(header + endl + errLog);
	        }

	        check.raise(header);
	      }
	    }

	    function saveCommandRef(object) {
	      object._commandRef = guessCommand();
	    }

	    function saveDrawCommandInfo(opts, uniforms, attributes, stringStore) {
	      saveCommandRef(opts);

	      function id(str) {
	        if (str) {
	          return stringStore.id(str);
	        }

	        return 0;
	      }

	      opts._fragId = id(opts.static.frag);
	      opts._vertId = id(opts.static.vert);

	      function addProps(dict, set) {
	        Object.keys(set).forEach(function (u) {
	          dict[stringStore.id(u)] = true;
	        });
	      }

	      var uniformSet = opts._uniformSet = {};
	      addProps(uniformSet, uniforms.static);
	      addProps(uniformSet, uniforms.dynamic);
	      var attributeSet = opts._attributeSet = {};
	      addProps(attributeSet, attributes.static);
	      addProps(attributeSet, attributes.dynamic);
	      opts._hasCount = 'count' in opts.static || 'count' in opts.dynamic || 'elements' in opts.static || 'elements' in opts.dynamic;
	    }

	    function commandRaise(message, command) {
	      var callSite = guessCallSite();
	      raise(message + ' in command ' + (command || guessCommand()) + (callSite === 'unknown' ? '' : ' called from ' + callSite));
	    }

	    function checkCommand(pred, message, command) {
	      if (!pred) {
	        commandRaise(message, command || guessCommand());
	      }
	    }

	    function checkParameterCommand(param, possibilities, message, command) {
	      if (!(param in possibilities)) {
	        commandRaise('unknown parameter (' + param + ')' + encolon(message) + '. possible values: ' + Object.keys(possibilities).join(), command || guessCommand());
	      }
	    }

	    function checkCommandType(value, type, message, command) {
	      if (typeof value !== type) {
	        commandRaise('invalid parameter type' + encolon(message) + '. expected ' + type + ', got ' + typeof value, command || guessCommand());
	      }
	    }

	    function checkOptional(block) {
	      block();
	    }

	    function checkFramebufferFormat(attachment, texFormats, rbFormats) {
	      if (attachment.texture) {
	        checkOneOf(attachment.texture._texture.internalformat, texFormats, 'unsupported texture format for attachment');
	      } else {
	        checkOneOf(attachment.renderbuffer._renderbuffer.format, rbFormats, 'unsupported renderbuffer format for attachment');
	      }
	    }

	    var GL_CLAMP_TO_EDGE = 0x812F;
	    var GL_NEAREST = 0x2600;
	    var GL_NEAREST_MIPMAP_NEAREST = 0x2700;
	    var GL_LINEAR_MIPMAP_NEAREST = 0x2701;
	    var GL_NEAREST_MIPMAP_LINEAR = 0x2702;
	    var GL_LINEAR_MIPMAP_LINEAR = 0x2703;
	    var GL_BYTE = 5120;
	    var GL_UNSIGNED_BYTE = 5121;
	    var GL_SHORT = 5122;
	    var GL_UNSIGNED_SHORT = 5123;
	    var GL_INT = 5124;
	    var GL_UNSIGNED_INT = 5125;
	    var GL_FLOAT = 5126;
	    var GL_UNSIGNED_SHORT_4_4_4_4 = 0x8033;
	    var GL_UNSIGNED_SHORT_5_5_5_1 = 0x8034;
	    var GL_UNSIGNED_SHORT_5_6_5 = 0x8363;
	    var GL_UNSIGNED_INT_24_8_WEBGL = 0x84FA;
	    var GL_HALF_FLOAT_OES = 0x8D61;
	    var TYPE_SIZE = {};
	    TYPE_SIZE[GL_BYTE] = TYPE_SIZE[GL_UNSIGNED_BYTE] = 1;
	    TYPE_SIZE[GL_SHORT] = TYPE_SIZE[GL_UNSIGNED_SHORT] = TYPE_SIZE[GL_HALF_FLOAT_OES] = TYPE_SIZE[GL_UNSIGNED_SHORT_5_6_5] = TYPE_SIZE[GL_UNSIGNED_SHORT_4_4_4_4] = TYPE_SIZE[GL_UNSIGNED_SHORT_5_5_5_1] = 2;
	    TYPE_SIZE[GL_INT] = TYPE_SIZE[GL_UNSIGNED_INT] = TYPE_SIZE[GL_FLOAT] = TYPE_SIZE[GL_UNSIGNED_INT_24_8_WEBGL] = 4;

	    function pixelSize(type, channels) {
	      if (type === GL_UNSIGNED_SHORT_5_5_5_1 || type === GL_UNSIGNED_SHORT_4_4_4_4 || type === GL_UNSIGNED_SHORT_5_6_5) {
	        return 2;
	      } else if (type === GL_UNSIGNED_INT_24_8_WEBGL) {
	        return 4;
	      } else {
	        return TYPE_SIZE[type] * channels;
	      }
	    }

	    function isPow2(v) {
	      return !(v & v - 1) && !!v;
	    }

	    function checkTexture2D(info, mipData, limits) {
	      var i;
	      var w = mipData.width;
	      var h = mipData.height;
	      var c = mipData.channels;
	      check(w > 0 && w <= limits.maxTextureSize && h > 0 && h <= limits.maxTextureSize, 'invalid texture shape');

	      if (info.wrapS !== GL_CLAMP_TO_EDGE || info.wrapT !== GL_CLAMP_TO_EDGE) {
	        check(isPow2(w) && isPow2(h), 'incompatible wrap mode for texture, both width and height must be power of 2');
	      }

	      if (mipData.mipmask === 1) {
	        if (w !== 1 && h !== 1) {
	          check(info.minFilter !== GL_NEAREST_MIPMAP_NEAREST && info.minFilter !== GL_NEAREST_MIPMAP_LINEAR && info.minFilter !== GL_LINEAR_MIPMAP_NEAREST && info.minFilter !== GL_LINEAR_MIPMAP_LINEAR, 'min filter requires mipmap');
	        }
	      } else {
	        check(isPow2(w) && isPow2(h), 'texture must be a square power of 2 to support mipmapping');
	        check(mipData.mipmask === (w << 1) - 1, 'missing or incomplete mipmap data');
	      }

	      if (mipData.type === GL_FLOAT) {
	        if (limits.extensions.indexOf('oes_texture_float_linear') < 0) {
	          check(info.minFilter === GL_NEAREST && info.magFilter === GL_NEAREST, 'filter not supported, must enable oes_texture_float_linear');
	        }

	        check(!info.genMipmaps, 'mipmap generation not supported with float textures');
	      }

	      var mipimages = mipData.images;

	      for (i = 0; i < 16; ++i) {
	        if (mipimages[i]) {
	          var mw = w >> i;
	          var mh = h >> i;
	          check(mipData.mipmask & 1 << i, 'missing mipmap data');
	          var img = mipimages[i];
	          check(img.width === mw && img.height === mh, 'invalid shape for mip images');
	          check(img.format === mipData.format && img.internalformat === mipData.internalformat && img.type === mipData.type, 'incompatible type for mip image');

	          if (img.compressed) ; else if (img.data) {
	            var rowSize = Math.ceil(pixelSize(img.type, c) * mw / img.unpackAlignment) * img.unpackAlignment;
	            check(img.data.byteLength === rowSize * mh, 'invalid data for image, buffer size is inconsistent with image format');
	          } else if (img.element) ; else if (img.copy) ;
	        } else if (!info.genMipmaps) {
	          check((mipData.mipmask & 1 << i) === 0, 'extra mipmap data');
	        }
	      }

	      if (mipData.compressed) {
	        check(!info.genMipmaps, 'mipmap generation for compressed images not supported');
	      }
	    }

	    function checkTextureCube(texture, info, faces, limits) {
	      var w = texture.width;
	      var h = texture.height;
	      var c = texture.channels;
	      check(w > 0 && w <= limits.maxTextureSize && h > 0 && h <= limits.maxTextureSize, 'invalid texture shape');
	      check(w === h, 'cube map must be square');
	      check(info.wrapS === GL_CLAMP_TO_EDGE && info.wrapT === GL_CLAMP_TO_EDGE, 'wrap mode not supported by cube map');

	      for (var i = 0; i < faces.length; ++i) {
	        var face = faces[i];
	        check(face.width === w && face.height === h, 'inconsistent cube map face shape');

	        if (info.genMipmaps) {
	          check(!face.compressed, 'can not generate mipmap for compressed textures');
	          check(face.mipmask === 1, 'can not specify mipmaps and generate mipmaps');
	        }

	        var mipmaps = face.images;

	        for (var j = 0; j < 16; ++j) {
	          var img = mipmaps[j];

	          if (img) {
	            var mw = w >> j;
	            var mh = h >> j;
	            check(face.mipmask & 1 << j, 'missing mipmap data');
	            check(img.width === mw && img.height === mh, 'invalid shape for mip images');
	            check(img.format === texture.format && img.internalformat === texture.internalformat && img.type === texture.type, 'incompatible type for mip image');

	            if (img.compressed) ; else if (img.data) {
	              check(img.data.byteLength === mw * mh * Math.max(pixelSize(img.type, c), img.unpackAlignment), 'invalid data for image, buffer size is inconsistent with image format');
	            } else if (img.element) ; else if (img.copy) ;
	          }
	        }
	      }
	    }

	    var check$1 = extend(check, {
	      optional: checkOptional,
	      raise: raise,
	      commandRaise: commandRaise,
	      command: checkCommand,
	      parameter: checkParameter,
	      commandParameter: checkParameterCommand,
	      constructor: checkConstructor,
	      type: checkTypeOf,
	      commandType: checkCommandType,
	      isTypedArray: checkIsTypedArray,
	      nni: checkNonNegativeInt,
	      oneOf: checkOneOf,
	      shaderError: checkShaderError,
	      linkError: checkLinkError,
	      callSite: guessCallSite,
	      saveCommandRef: saveCommandRef,
	      saveDrawInfo: saveDrawCommandInfo,
	      framebufferFormat: checkFramebufferFormat,
	      guessCommand: guessCommand,
	      texture2D: checkTexture2D,
	      textureCube: checkTextureCube
	    });
	    var VARIABLE_COUNTER = 0;
	    var DYN_FUNC = 0;

	    function DynamicVariable(type, data) {
	      this.id = VARIABLE_COUNTER++;
	      this.type = type;
	      this.data = data;
	    }

	    function escapeStr(str) {
	      return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
	    }

	    function splitParts(str) {
	      if (str.length === 0) {
	        return [];
	      }

	      var firstChar = str.charAt(0);
	      var lastChar = str.charAt(str.length - 1);

	      if (str.length > 1 && firstChar === lastChar && (firstChar === '"' || firstChar === "'")) {
	        return ['"' + escapeStr(str.substr(1, str.length - 2)) + '"'];
	      }

	      var parts = /\[(false|true|null|\d+|'[^']*'|"[^"]*")\]/.exec(str);

	      if (parts) {
	        return splitParts(str.substr(0, parts.index)).concat(splitParts(parts[1])).concat(splitParts(str.substr(parts.index + parts[0].length)));
	      }

	      var subparts = str.split('.');

	      if (subparts.length === 1) {
	        return ['"' + escapeStr(str) + '"'];
	      }

	      var result = [];

	      for (var i = 0; i < subparts.length; ++i) {
	        result = result.concat(splitParts(subparts[i]));
	      }

	      return result;
	    }

	    function toAccessorString(str) {
	      return '[' + splitParts(str).join('][') + ']';
	    }

	    function defineDynamic(type, data) {
	      return new DynamicVariable(type, toAccessorString(data + ''));
	    }

	    function isDynamic(x) {
	      return typeof x === 'function' && !x._reglType || x instanceof DynamicVariable;
	    }

	    function unbox(x, path) {
	      if (typeof x === 'function') {
	        return new DynamicVariable(DYN_FUNC, x);
	      }

	      return x;
	    }

	    var dynamic = {
	      DynamicVariable: DynamicVariable,
	      define: defineDynamic,
	      isDynamic: isDynamic,
	      unbox: unbox,
	      accessor: toAccessorString
	    };
	    var raf = {
	      next: typeof requestAnimationFrame === 'function' ? function (cb) {
	        return requestAnimationFrame(cb);
	      } : function (cb) {
	        return setTimeout(cb, 16);
	      },
	      cancel: typeof cancelAnimationFrame === 'function' ? function (raf) {
	        return cancelAnimationFrame(raf);
	      } : clearTimeout
	    };
	    var clock = typeof performance !== 'undefined' && performance.now ? function () {
	      return performance.now();
	    } : function () {
	      return +new Date();
	    };

	    function createStringStore() {
	      var stringIds = {
	        '': 0
	      };
	      var stringValues = [''];
	      return {
	        id: function id(str) {
	          var result = stringIds[str];

	          if (result) {
	            return result;
	          }

	          result = stringIds[str] = stringValues.length;
	          stringValues.push(str);
	          return result;
	        },
	        str: function str(id) {
	          return stringValues[id];
	        }
	      };
	    }

	    function createCanvas(element, onDone, pixelRatio) {
	      var canvas = document.createElement('canvas');
	      extend(canvas.style, {
	        border: 0,
	        margin: 0,
	        padding: 0,
	        top: 0,
	        left: 0
	      });
	      element.appendChild(canvas);

	      if (element === document.body) {
	        canvas.style.position = 'absolute';
	        extend(element.style, {
	          margin: 0,
	          padding: 0
	        });
	      }

	      function resize() {
	        var w = window.innerWidth;
	        var h = window.innerHeight;

	        if (element !== document.body) {
	          var bounds = element.getBoundingClientRect();
	          w = bounds.right - bounds.left;
	          h = bounds.bottom - bounds.top;
	        }

	        canvas.width = pixelRatio * w;
	        canvas.height = pixelRatio * h;
	        extend(canvas.style, {
	          width: w + 'px',
	          height: h + 'px'
	        });
	      }

	      window.addEventListener('resize', resize, false);

	      function onDestroy() {
	        window.removeEventListener('resize', resize);
	        element.removeChild(canvas);
	      }

	      resize();
	      return {
	        canvas: canvas,
	        onDestroy: onDestroy
	      };
	    }

	    function createContext(canvas, contextAttributes) {
	      function get(name) {
	        try {
	          return canvas.getContext(name, contextAttributes);
	        } catch (e) {
	          return null;
	        }
	      }

	      return get('webgl') || get('experimental-webgl') || get('webgl-experimental');
	    }

	    function isHTMLElement(obj) {
	      return typeof obj.nodeName === 'string' && typeof obj.appendChild === 'function' && typeof obj.getBoundingClientRect === 'function';
	    }

	    function isWebGLContext(obj) {
	      return typeof obj.drawArrays === 'function' || typeof obj.drawElements === 'function';
	    }

	    function parseExtensions(input) {
	      if (typeof input === 'string') {
	        return input.split();
	      }

	      check$1(Array.isArray(input), 'invalid extension array');
	      return input;
	    }

	    function getElement(desc) {
	      if (typeof desc === 'string') {
	        check$1(typeof document !== 'undefined', 'not supported outside of DOM');
	        return document.querySelector(desc);
	      }

	      return desc;
	    }

	    function parseArgs(args_) {
	      var args = args_ || {};
	      var element, container, canvas, gl;
	      var contextAttributes = {};
	      var extensions = [];
	      var optionalExtensions = [];
	      var pixelRatio = typeof window === 'undefined' ? 1 : window.devicePixelRatio;
	      var profile = false;

	      var onDone = function onDone(err) {
	        if (err) {
	          check$1.raise(err);
	        }
	      };

	      var onDestroy = function onDestroy() {};

	      if (typeof args === 'string') {
	        check$1(typeof document !== 'undefined', 'selector queries only supported in DOM enviroments');
	        element = document.querySelector(args);
	        check$1(element, 'invalid query string for element');
	      } else if (typeof args === 'object') {
	        if (isHTMLElement(args)) {
	          element = args;
	        } else if (isWebGLContext(args)) {
	          gl = args;
	          canvas = gl.canvas;
	        } else {
	          check$1.constructor(args);

	          if ('gl' in args) {
	            gl = args.gl;
	          } else if ('canvas' in args) {
	            canvas = getElement(args.canvas);
	          } else if ('container' in args) {
	            container = getElement(args.container);
	          }

	          if ('attributes' in args) {
	            contextAttributes = args.attributes;
	            check$1.type(contextAttributes, 'object', 'invalid context attributes');
	          }

	          if ('extensions' in args) {
	            extensions = parseExtensions(args.extensions);
	          }

	          if ('optionalExtensions' in args) {
	            optionalExtensions = parseExtensions(args.optionalExtensions);
	          }

	          if ('onDone' in args) {
	            check$1.type(args.onDone, 'function', 'invalid or missing onDone callback');
	            onDone = args.onDone;
	          }

	          if ('profile' in args) {
	            profile = !!args.profile;
	          }

	          if ('pixelRatio' in args) {
	            pixelRatio = +args.pixelRatio;
	            check$1(pixelRatio > 0, 'invalid pixel ratio');
	          }
	        }
	      } else {
	        check$1.raise('invalid arguments to regl');
	      }

	      if (element) {
	        if (element.nodeName.toLowerCase() === 'canvas') {
	          canvas = element;
	        } else {
	          container = element;
	        }
	      }

	      if (!gl) {
	        if (!canvas) {
	          check$1(typeof document !== 'undefined', 'must manually specify webgl context outside of DOM environments');
	          var result = createCanvas(container || document.body, onDone, pixelRatio);

	          if (!result) {
	            return null;
	          }

	          canvas = result.canvas;
	          onDestroy = result.onDestroy;
	        }

	        gl = createContext(canvas, contextAttributes);
	      }

	      if (!gl) {
	        onDestroy();
	        onDone('webgl not supported, try upgrading your browser or graphics drivers http://get.webgl.org');
	        return null;
	      }

	      return {
	        gl: gl,
	        canvas: canvas,
	        container: container,
	        extensions: extensions,
	        optionalExtensions: optionalExtensions,
	        pixelRatio: pixelRatio,
	        profile: profile,
	        onDone: onDone,
	        onDestroy: onDestroy
	      };
	    }

	    function createExtensionCache(gl, config) {
	      var extensions = {};

	      function tryLoadExtension(name_) {
	        check$1.type(name_, 'string', 'extension name must be string');
	        var name = name_.toLowerCase();
	        var ext;

	        try {
	          ext = extensions[name] = gl.getExtension(name);
	        } catch (e) {}

	        return !!ext;
	      }

	      for (var i = 0; i < config.extensions.length; ++i) {
	        var name = config.extensions[i];

	        if (!tryLoadExtension(name)) {
	          config.onDestroy();
	          config.onDone('"' + name + '" extension is not supported by the current WebGL context, try upgrading your system or a different browser');
	          return null;
	        }
	      }

	      config.optionalExtensions.forEach(tryLoadExtension);
	      return {
	        extensions: extensions,
	        restore: function restore() {
	          Object.keys(extensions).forEach(function (name) {
	            if (extensions[name] && !tryLoadExtension(name)) {
	              throw new Error('(regl): error restoring extension ' + name);
	            }
	          });
	        }
	      };
	    }

	    function loop(n, f) {
	      var result = Array(n);

	      for (var i = 0; i < n; ++i) {
	        result[i] = f(i);
	      }

	      return result;
	    }

	    var GL_BYTE$1 = 5120;
	    var GL_UNSIGNED_BYTE$2 = 5121;
	    var GL_SHORT$1 = 5122;
	    var GL_UNSIGNED_SHORT$1 = 5123;
	    var GL_INT$1 = 5124;
	    var GL_UNSIGNED_INT$1 = 5125;
	    var GL_FLOAT$2 = 5126;

	    function nextPow16(v) {
	      for (var i = 16; i <= 1 << 28; i *= 16) {
	        if (v <= i) {
	          return i;
	        }
	      }

	      return 0;
	    }

	    function log2(v) {
	      var r, shift;
	      r = (v > 0xFFFF) << 4;
	      v >>>= r;
	      shift = (v > 0xFF) << 3;
	      v >>>= shift;
	      r |= shift;
	      shift = (v > 0xF) << 2;
	      v >>>= shift;
	      r |= shift;
	      shift = (v > 0x3) << 1;
	      v >>>= shift;
	      r |= shift;
	      return r | v >> 1;
	    }

	    function createPool() {
	      var bufferPool = loop(8, function () {
	        return [];
	      });

	      function alloc(n) {
	        var sz = nextPow16(n);
	        var bin = bufferPool[log2(sz) >> 2];

	        if (bin.length > 0) {
	          return bin.pop();
	        }

	        return new ArrayBuffer(sz);
	      }

	      function free(buf) {
	        bufferPool[log2(buf.byteLength) >> 2].push(buf);
	      }

	      function allocType(type, n) {
	        var result = null;

	        switch (type) {
	          case GL_BYTE$1:
	            result = new Int8Array(alloc(n), 0, n);
	            break;

	          case GL_UNSIGNED_BYTE$2:
	            result = new Uint8Array(alloc(n), 0, n);
	            break;

	          case GL_SHORT$1:
	            result = new Int16Array(alloc(2 * n), 0, n);
	            break;

	          case GL_UNSIGNED_SHORT$1:
	            result = new Uint16Array(alloc(2 * n), 0, n);
	            break;

	          case GL_INT$1:
	            result = new Int32Array(alloc(4 * n), 0, n);
	            break;

	          case GL_UNSIGNED_INT$1:
	            result = new Uint32Array(alloc(4 * n), 0, n);
	            break;

	          case GL_FLOAT$2:
	            result = new Float32Array(alloc(4 * n), 0, n);
	            break;

	          default:
	            return null;
	        }

	        if (result.length !== n) {
	          return result.subarray(0, n);
	        }

	        return result;
	      }

	      function freeType(array) {
	        free(array.buffer);
	      }

	      return {
	        alloc: alloc,
	        free: free,
	        allocType: allocType,
	        freeType: freeType
	      };
	    }

	    var pool = createPool();
	    pool.zero = createPool();
	    var GL_SUBPIXEL_BITS = 0x0D50;
	    var GL_RED_BITS = 0x0D52;
	    var GL_GREEN_BITS = 0x0D53;
	    var GL_BLUE_BITS = 0x0D54;
	    var GL_ALPHA_BITS = 0x0D55;
	    var GL_DEPTH_BITS = 0x0D56;
	    var GL_STENCIL_BITS = 0x0D57;
	    var GL_ALIASED_POINT_SIZE_RANGE = 0x846D;
	    var GL_ALIASED_LINE_WIDTH_RANGE = 0x846E;
	    var GL_MAX_TEXTURE_SIZE = 0x0D33;
	    var GL_MAX_VIEWPORT_DIMS = 0x0D3A;
	    var GL_MAX_VERTEX_ATTRIBS = 0x8869;
	    var GL_MAX_VERTEX_UNIFORM_VECTORS = 0x8DFB;
	    var GL_MAX_VARYING_VECTORS = 0x8DFC;
	    var GL_MAX_COMBINED_TEXTURE_IMAGE_UNITS = 0x8B4D;
	    var GL_MAX_VERTEX_TEXTURE_IMAGE_UNITS = 0x8B4C;
	    var GL_MAX_TEXTURE_IMAGE_UNITS = 0x8872;
	    var GL_MAX_FRAGMENT_UNIFORM_VECTORS = 0x8DFD;
	    var GL_MAX_CUBE_MAP_TEXTURE_SIZE = 0x851C;
	    var GL_MAX_RENDERBUFFER_SIZE = 0x84E8;
	    var GL_VENDOR = 0x1F00;
	    var GL_RENDERER = 0x1F01;
	    var GL_VERSION = 0x1F02;
	    var GL_SHADING_LANGUAGE_VERSION = 0x8B8C;
	    var GL_MAX_TEXTURE_MAX_ANISOTROPY_EXT = 0x84FF;
	    var GL_MAX_COLOR_ATTACHMENTS_WEBGL = 0x8CDF;
	    var GL_MAX_DRAW_BUFFERS_WEBGL = 0x8824;
	    var GL_TEXTURE_2D = 0x0DE1;
	    var GL_TEXTURE_CUBE_MAP = 0x8513;
	    var GL_TEXTURE_CUBE_MAP_POSITIVE_X = 0x8515;
	    var GL_TEXTURE0 = 0x84C0;
	    var GL_RGBA = 0x1908;
	    var GL_FLOAT$1 = 0x1406;
	    var GL_UNSIGNED_BYTE$1 = 0x1401;
	    var GL_FRAMEBUFFER = 0x8D40;
	    var GL_FRAMEBUFFER_COMPLETE = 0x8CD5;
	    var GL_COLOR_ATTACHMENT0 = 0x8CE0;
	    var GL_COLOR_BUFFER_BIT$1 = 0x4000;

	    var wrapLimits = function wrapLimits(gl, extensions) {
	      var maxAnisotropic = 1;

	      if (extensions.ext_texture_filter_anisotropic) {
	        maxAnisotropic = gl.getParameter(GL_MAX_TEXTURE_MAX_ANISOTROPY_EXT);
	      }

	      var maxDrawbuffers = 1;
	      var maxColorAttachments = 1;

	      if (extensions.webgl_draw_buffers) {
	        maxDrawbuffers = gl.getParameter(GL_MAX_DRAW_BUFFERS_WEBGL);
	        maxColorAttachments = gl.getParameter(GL_MAX_COLOR_ATTACHMENTS_WEBGL);
	      }

	      var readFloat = !!extensions.oes_texture_float;

	      if (readFloat) {
	        var readFloatTexture = gl.createTexture();
	        gl.bindTexture(GL_TEXTURE_2D, readFloatTexture);
	        gl.texImage2D(GL_TEXTURE_2D, 0, GL_RGBA, 1, 1, 0, GL_RGBA, GL_FLOAT$1, null);
	        var fbo = gl.createFramebuffer();
	        gl.bindFramebuffer(GL_FRAMEBUFFER, fbo);
	        gl.framebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, readFloatTexture, 0);
	        gl.bindTexture(GL_TEXTURE_2D, null);
	        if (gl.checkFramebufferStatus(GL_FRAMEBUFFER) !== GL_FRAMEBUFFER_COMPLETE) readFloat = false;else {
	          gl.viewport(0, 0, 1, 1);
	          gl.clearColor(1.0, 0.0, 0.0, 1.0);
	          gl.clear(GL_COLOR_BUFFER_BIT$1);
	          var pixels = pool.allocType(GL_FLOAT$1, 4);
	          gl.readPixels(0, 0, 1, 1, GL_RGBA, GL_FLOAT$1, pixels);
	          if (gl.getError()) readFloat = false;else {
	            gl.deleteFramebuffer(fbo);
	            gl.deleteTexture(readFloatTexture);
	            readFloat = pixels[0] === 1.0;
	          }
	          pool.freeType(pixels);
	        }
	      }

	      var isIE = typeof navigator !== 'undefined' && (/MSIE/.test(navigator.userAgent) || /Trident\//.test(navigator.appVersion) || /Edge/.test(navigator.userAgent));
	      var npotTextureCube = true;

	      if (!isIE) {
	        var cubeTexture = gl.createTexture();
	        var data = pool.allocType(GL_UNSIGNED_BYTE$1, 36);
	        gl.activeTexture(GL_TEXTURE0);
	        gl.bindTexture(GL_TEXTURE_CUBE_MAP, cubeTexture);
	        gl.texImage2D(GL_TEXTURE_CUBE_MAP_POSITIVE_X, 0, GL_RGBA, 3, 3, 0, GL_RGBA, GL_UNSIGNED_BYTE$1, data);
	        pool.freeType(data);
	        gl.bindTexture(GL_TEXTURE_CUBE_MAP, null);
	        gl.deleteTexture(cubeTexture);
	        npotTextureCube = !gl.getError();
	      }

	      return {
	        colorBits: [gl.getParameter(GL_RED_BITS), gl.getParameter(GL_GREEN_BITS), gl.getParameter(GL_BLUE_BITS), gl.getParameter(GL_ALPHA_BITS)],
	        depthBits: gl.getParameter(GL_DEPTH_BITS),
	        stencilBits: gl.getParameter(GL_STENCIL_BITS),
	        subpixelBits: gl.getParameter(GL_SUBPIXEL_BITS),
	        extensions: Object.keys(extensions).filter(function (ext) {
	          return !!extensions[ext];
	        }),
	        maxAnisotropic: maxAnisotropic,
	        maxDrawbuffers: maxDrawbuffers,
	        maxColorAttachments: maxColorAttachments,
	        pointSizeDims: gl.getParameter(GL_ALIASED_POINT_SIZE_RANGE),
	        lineWidthDims: gl.getParameter(GL_ALIASED_LINE_WIDTH_RANGE),
	        maxViewportDims: gl.getParameter(GL_MAX_VIEWPORT_DIMS),
	        maxCombinedTextureUnits: gl.getParameter(GL_MAX_COMBINED_TEXTURE_IMAGE_UNITS),
	        maxCubeMapSize: gl.getParameter(GL_MAX_CUBE_MAP_TEXTURE_SIZE),
	        maxRenderbufferSize: gl.getParameter(GL_MAX_RENDERBUFFER_SIZE),
	        maxTextureUnits: gl.getParameter(GL_MAX_TEXTURE_IMAGE_UNITS),
	        maxTextureSize: gl.getParameter(GL_MAX_TEXTURE_SIZE),
	        maxAttributes: gl.getParameter(GL_MAX_VERTEX_ATTRIBS),
	        maxVertexUniforms: gl.getParameter(GL_MAX_VERTEX_UNIFORM_VECTORS),
	        maxVertexTextureUnits: gl.getParameter(GL_MAX_VERTEX_TEXTURE_IMAGE_UNITS),
	        maxVaryingVectors: gl.getParameter(GL_MAX_VARYING_VECTORS),
	        maxFragmentUniforms: gl.getParameter(GL_MAX_FRAGMENT_UNIFORM_VECTORS),
	        glsl: gl.getParameter(GL_SHADING_LANGUAGE_VERSION),
	        renderer: gl.getParameter(GL_RENDERER),
	        vendor: gl.getParameter(GL_VENDOR),
	        version: gl.getParameter(GL_VERSION),
	        readFloat: readFloat,
	        npotTextureCube: npotTextureCube
	      };
	    };

	    function isNDArrayLike(obj) {
	      return !!obj && typeof obj === 'object' && Array.isArray(obj.shape) && Array.isArray(obj.stride) && typeof obj.offset === 'number' && obj.shape.length === obj.stride.length && (Array.isArray(obj.data) || isTypedArray(obj.data));
	    }

	    var values = function values(obj) {
	      return Object.keys(obj).map(function (key) {
	        return obj[key];
	      });
	    };

	    var flattenUtils = {
	      shape: arrayShape$1,
	      flatten: flattenArray
	    };

	    function flatten1D(array, nx, out) {
	      for (var i = 0; i < nx; ++i) {
	        out[i] = array[i];
	      }
	    }

	    function flatten2D(array, nx, ny, out) {
	      var ptr = 0;

	      for (var i = 0; i < nx; ++i) {
	        var row = array[i];

	        for (var j = 0; j < ny; ++j) {
	          out[ptr++] = row[j];
	        }
	      }
	    }

	    function flatten3D(array, nx, ny, nz, out, ptr_) {
	      var ptr = ptr_;

	      for (var i = 0; i < nx; ++i) {
	        var row = array[i];

	        for (var j = 0; j < ny; ++j) {
	          var col = row[j];

	          for (var k = 0; k < nz; ++k) {
	            out[ptr++] = col[k];
	          }
	        }
	      }
	    }

	    function flattenRec(array, shape, level, out, ptr) {
	      var stride = 1;

	      for (var i = level + 1; i < shape.length; ++i) {
	        stride *= shape[i];
	      }

	      var n = shape[level];

	      if (shape.length - level === 4) {
	        var nx = shape[level + 1];
	        var ny = shape[level + 2];
	        var nz = shape[level + 3];

	        for (i = 0; i < n; ++i) {
	          flatten3D(array[i], nx, ny, nz, out, ptr);
	          ptr += stride;
	        }
	      } else {
	        for (i = 0; i < n; ++i) {
	          flattenRec(array[i], shape, level + 1, out, ptr);
	          ptr += stride;
	        }
	      }
	    }

	    function flattenArray(array, shape, type, out_) {
	      var sz = 1;

	      if (shape.length) {
	        for (var i = 0; i < shape.length; ++i) {
	          sz *= shape[i];
	        }
	      } else {
	        sz = 0;
	      }

	      var out = out_ || pool.allocType(type, sz);

	      switch (shape.length) {
	        case 0:
	          break;

	        case 1:
	          flatten1D(array, shape[0], out);
	          break;

	        case 2:
	          flatten2D(array, shape[0], shape[1], out);
	          break;

	        case 3:
	          flatten3D(array, shape[0], shape[1], shape[2], out, 0);
	          break;

	        default:
	          flattenRec(array, shape, 0, out, 0);
	      }

	      return out;
	    }

	    function arrayShape$1(array_) {
	      var shape = [];

	      for (var array = array_; array.length; array = array[0]) {
	        shape.push(array.length);
	      }

	      return shape;
	    }

	    var arrayTypes = {
	      "[object Int8Array]": 5120,
	      "[object Int16Array]": 5122,
	      "[object Int32Array]": 5124,
	      "[object Uint8Array]": 5121,
	      "[object Uint8ClampedArray]": 5121,
	      "[object Uint16Array]": 5123,
	      "[object Uint32Array]": 5125,
	      "[object Float32Array]": 5126,
	      "[object Float64Array]": 5121,
	      "[object ArrayBuffer]": 5121
	    };
	    var int8 = 5120;
	    var int16 = 5122;
	    var int32 = 5124;
	    var uint8 = 5121;
	    var uint16 = 5123;
	    var uint32 = 5125;
	    var float = 5126;
	    var float32 = 5126;
	    var glTypes = {
	      int8: int8,
	      int16: int16,
	      int32: int32,
	      uint8: uint8,
	      uint16: uint16,
	      uint32: uint32,
	      float: float,
	      float32: float32
	    };
	    var dynamic$1 = 35048;
	    var stream = 35040;
	    var usageTypes = {
	      dynamic: dynamic$1,
	      stream: stream,
	      "static": 35044
	    };
	    var arrayFlatten = flattenUtils.flatten;
	    var arrayShape = flattenUtils.shape;
	    var GL_STATIC_DRAW = 0x88E4;
	    var GL_STREAM_DRAW = 0x88E0;
	    var GL_UNSIGNED_BYTE$3 = 5121;
	    var GL_FLOAT$3 = 5126;
	    var DTYPES_SIZES = [];
	    DTYPES_SIZES[5120] = 1;
	    DTYPES_SIZES[5122] = 2;
	    DTYPES_SIZES[5124] = 4;
	    DTYPES_SIZES[5121] = 1;
	    DTYPES_SIZES[5123] = 2;
	    DTYPES_SIZES[5125] = 4;
	    DTYPES_SIZES[5126] = 4;

	    function typedArrayCode(data) {
	      return arrayTypes[Object.prototype.toString.call(data)] | 0;
	    }

	    function copyArray(out, inp) {
	      for (var i = 0; i < inp.length; ++i) {
	        out[i] = inp[i];
	      }
	    }

	    function transpose(result, data, shapeX, shapeY, strideX, strideY, offset) {
	      var ptr = 0;

	      for (var i = 0; i < shapeX; ++i) {
	        for (var j = 0; j < shapeY; ++j) {
	          result[ptr++] = data[strideX * i + strideY * j + offset];
	        }
	      }
	    }

	    function wrapBufferState(gl, stats, config, attributeState) {
	      var bufferCount = 0;
	      var bufferSet = {};

	      function REGLBuffer(type) {
	        this.id = bufferCount++;
	        this.buffer = gl.createBuffer();
	        this.type = type;
	        this.usage = GL_STATIC_DRAW;
	        this.byteLength = 0;
	        this.dimension = 1;
	        this.dtype = GL_UNSIGNED_BYTE$3;
	        this.persistentData = null;

	        if (config.profile) {
	          this.stats = {
	            size: 0
	          };
	        }
	      }

	      REGLBuffer.prototype.bind = function () {
	        gl.bindBuffer(this.type, this.buffer);
	      };

	      REGLBuffer.prototype.destroy = function () {
	        destroy(this);
	      };

	      var streamPool = [];

	      function createStream(type, data) {
	        var buffer = streamPool.pop();

	        if (!buffer) {
	          buffer = new REGLBuffer(type);
	        }

	        buffer.bind();
	        initBufferFromData(buffer, data, GL_STREAM_DRAW, 0, 1, false);
	        return buffer;
	      }

	      function destroyStream(stream$$1) {
	        streamPool.push(stream$$1);
	      }

	      function initBufferFromTypedArray(buffer, data, usage) {
	        buffer.byteLength = data.byteLength;
	        gl.bufferData(buffer.type, data, usage);
	      }

	      function initBufferFromData(buffer, data, usage, dtype, dimension, persist) {
	        var shape;
	        buffer.usage = usage;

	        if (Array.isArray(data)) {
	          buffer.dtype = dtype || GL_FLOAT$3;

	          if (data.length > 0) {
	            var flatData;

	            if (Array.isArray(data[0])) {
	              shape = arrayShape(data);
	              var dim = 1;

	              for (var i = 1; i < shape.length; ++i) {
	                dim *= shape[i];
	              }

	              buffer.dimension = dim;
	              flatData = arrayFlatten(data, shape, buffer.dtype);
	              initBufferFromTypedArray(buffer, flatData, usage);

	              if (persist) {
	                buffer.persistentData = flatData;
	              } else {
	                pool.freeType(flatData);
	              }
	            } else if (typeof data[0] === 'number') {
	              buffer.dimension = dimension;
	              var typedData = pool.allocType(buffer.dtype, data.length);
	              copyArray(typedData, data);
	              initBufferFromTypedArray(buffer, typedData, usage);

	              if (persist) {
	                buffer.persistentData = typedData;
	              } else {
	                pool.freeType(typedData);
	              }
	            } else if (isTypedArray(data[0])) {
	              buffer.dimension = data[0].length;
	              buffer.dtype = dtype || typedArrayCode(data[0]) || GL_FLOAT$3;
	              flatData = arrayFlatten(data, [data.length, data[0].length], buffer.dtype);
	              initBufferFromTypedArray(buffer, flatData, usage);

	              if (persist) {
	                buffer.persistentData = flatData;
	              } else {
	                pool.freeType(flatData);
	              }
	            } else {
	              check$1.raise('invalid buffer data');
	            }
	          }
	        } else if (isTypedArray(data)) {
	          buffer.dtype = dtype || typedArrayCode(data);
	          buffer.dimension = dimension;
	          initBufferFromTypedArray(buffer, data, usage);

	          if (persist) {
	            buffer.persistentData = new Uint8Array(new Uint8Array(data.buffer));
	          }
	        } else if (isNDArrayLike(data)) {
	          shape = data.shape;
	          var stride = data.stride;
	          var offset = data.offset;
	          var shapeX = 0;
	          var shapeY = 0;
	          var strideX = 0;
	          var strideY = 0;

	          if (shape.length === 1) {
	            shapeX = shape[0];
	            shapeY = 1;
	            strideX = stride[0];
	            strideY = 0;
	          } else if (shape.length === 2) {
	            shapeX = shape[0];
	            shapeY = shape[1];
	            strideX = stride[0];
	            strideY = stride[1];
	          } else {
	            check$1.raise('invalid shape');
	          }

	          buffer.dtype = dtype || typedArrayCode(data.data) || GL_FLOAT$3;
	          buffer.dimension = shapeY;
	          var transposeData = pool.allocType(buffer.dtype, shapeX * shapeY);
	          transpose(transposeData, data.data, shapeX, shapeY, strideX, strideY, offset);
	          initBufferFromTypedArray(buffer, transposeData, usage);

	          if (persist) {
	            buffer.persistentData = transposeData;
	          } else {
	            pool.freeType(transposeData);
	          }
	        } else if (data instanceof ArrayBuffer) {
	          buffer.dtype = GL_UNSIGNED_BYTE$3;
	          buffer.dimension = dimension;
	          initBufferFromTypedArray(buffer, data, usage);

	          if (persist) {
	            buffer.persistentData = new Uint8Array(new Uint8Array(data));
	          }
	        } else {
	          check$1.raise('invalid buffer data');
	        }
	      }

	      function destroy(buffer) {
	        stats.bufferCount--;

	        for (var i = 0; i < attributeState.state.length; ++i) {
	          var record = attributeState.state[i];

	          if (record.buffer === buffer) {
	            gl.disableVertexAttribArray(i);
	            record.buffer = null;
	          }
	        }

	        var handle = buffer.buffer;
	        check$1(handle, 'buffer must not be deleted already');
	        gl.deleteBuffer(handle);
	        buffer.buffer = null;
	        delete bufferSet[buffer.id];
	      }

	      function createBuffer(options, type, deferInit, persistent) {
	        stats.bufferCount++;
	        var buffer = new REGLBuffer(type);
	        bufferSet[buffer.id] = buffer;

	        function reglBuffer(options) {
	          var usage = GL_STATIC_DRAW;
	          var data = null;
	          var byteLength = 0;
	          var dtype = 0;
	          var dimension = 1;

	          if (Array.isArray(options) || isTypedArray(options) || isNDArrayLike(options) || options instanceof ArrayBuffer) {
	            data = options;
	          } else if (typeof options === 'number') {
	            byteLength = options | 0;
	          } else if (options) {
	            check$1.type(options, 'object', 'buffer arguments must be an object, a number or an array');

	            if ('data' in options) {
	              check$1(data === null || Array.isArray(data) || isTypedArray(data) || isNDArrayLike(data), 'invalid data for buffer');
	              data = options.data;
	            }

	            if ('usage' in options) {
	              check$1.parameter(options.usage, usageTypes, 'invalid buffer usage');
	              usage = usageTypes[options.usage];
	            }

	            if ('type' in options) {
	              check$1.parameter(options.type, glTypes, 'invalid buffer type');
	              dtype = glTypes[options.type];
	            }

	            if ('dimension' in options) {
	              check$1.type(options.dimension, 'number', 'invalid dimension');
	              dimension = options.dimension | 0;
	            }

	            if ('length' in options) {
	              check$1.nni(byteLength, 'buffer length must be a nonnegative integer');
	              byteLength = options.length | 0;
	            }
	          }

	          buffer.bind();

	          if (!data) {
	            if (byteLength) gl.bufferData(buffer.type, byteLength, usage);
	            buffer.dtype = dtype || GL_UNSIGNED_BYTE$3;
	            buffer.usage = usage;
	            buffer.dimension = dimension;
	            buffer.byteLength = byteLength;
	          } else {
	            initBufferFromData(buffer, data, usage, dtype, dimension, persistent);
	          }

	          if (config.profile) {
	            buffer.stats.size = buffer.byteLength * DTYPES_SIZES[buffer.dtype];
	          }

	          return reglBuffer;
	        }

	        function setSubData(data, offset) {
	          check$1(offset + data.byteLength <= buffer.byteLength, 'invalid buffer subdata call, buffer is too small. ' + ' Can\'t write data of size ' + data.byteLength + ' starting from offset ' + offset + ' to a buffer of size ' + buffer.byteLength);
	          gl.bufferSubData(buffer.type, offset, data);
	        }

	        function subdata(data, offset_) {
	          var offset = (offset_ || 0) | 0;
	          var shape;
	          buffer.bind();

	          if (isTypedArray(data) || data instanceof ArrayBuffer) {
	            setSubData(data, offset);
	          } else if (Array.isArray(data)) {
	            if (data.length > 0) {
	              if (typeof data[0] === 'number') {
	                var converted = pool.allocType(buffer.dtype, data.length);
	                copyArray(converted, data);
	                setSubData(converted, offset);
	                pool.freeType(converted);
	              } else if (Array.isArray(data[0]) || isTypedArray(data[0])) {
	                shape = arrayShape(data);
	                var flatData = arrayFlatten(data, shape, buffer.dtype);
	                setSubData(flatData, offset);
	                pool.freeType(flatData);
	              } else {
	                check$1.raise('invalid buffer data');
	              }
	            }
	          } else if (isNDArrayLike(data)) {
	            shape = data.shape;
	            var stride = data.stride;
	            var shapeX = 0;
	            var shapeY = 0;
	            var strideX = 0;
	            var strideY = 0;

	            if (shape.length === 1) {
	              shapeX = shape[0];
	              shapeY = 1;
	              strideX = stride[0];
	              strideY = 0;
	            } else if (shape.length === 2) {
	              shapeX = shape[0];
	              shapeY = shape[1];
	              strideX = stride[0];
	              strideY = stride[1];
	            } else {
	              check$1.raise('invalid shape');
	            }

	            var dtype = Array.isArray(data.data) ? buffer.dtype : typedArrayCode(data.data);
	            var transposeData = pool.allocType(dtype, shapeX * shapeY);
	            transpose(transposeData, data.data, shapeX, shapeY, strideX, strideY, data.offset);
	            setSubData(transposeData, offset);
	            pool.freeType(transposeData);
	          } else {
	            check$1.raise('invalid data for buffer subdata');
	          }

	          return reglBuffer;
	        }

	        if (!deferInit) {
	          reglBuffer(options);
	        }

	        reglBuffer._reglType = 'buffer';
	        reglBuffer._buffer = buffer;
	        reglBuffer.subdata = subdata;

	        if (config.profile) {
	          reglBuffer.stats = buffer.stats;
	        }

	        reglBuffer.destroy = function () {
	          destroy(buffer);
	        };

	        return reglBuffer;
	      }

	      function restoreBuffers() {
	        values(bufferSet).forEach(function (buffer) {
	          buffer.buffer = gl.createBuffer();
	          gl.bindBuffer(buffer.type, buffer.buffer);
	          gl.bufferData(buffer.type, buffer.persistentData || buffer.byteLength, buffer.usage);
	        });
	      }

	      if (config.profile) {
	        stats.getTotalBufferSize = function () {
	          var total = 0;
	          Object.keys(bufferSet).forEach(function (key) {
	            total += bufferSet[key].stats.size;
	          });
	          return total;
	        };
	      }

	      return {
	        create: createBuffer,
	        createStream: createStream,
	        destroyStream: destroyStream,
	        clear: function clear() {
	          values(bufferSet).forEach(destroy);
	          streamPool.forEach(destroy);
	        },
	        getBuffer: function getBuffer(wrapper) {
	          if (wrapper && wrapper._buffer instanceof REGLBuffer) {
	            return wrapper._buffer;
	          }

	          return null;
	        },
	        restore: restoreBuffers,
	        _initBuffer: initBufferFromData
	      };
	    }

	    var points = 0;
	    var point = 0;
	    var lines = 1;
	    var line = 1;
	    var triangles = 4;
	    var triangle = 4;
	    var primTypes = {
	      points: points,
	      point: point,
	      lines: lines,
	      line: line,
	      triangles: triangles,
	      triangle: triangle,
	      "line loop": 2,
	      "line strip": 3,
	      "triangle strip": 5,
	      "triangle fan": 6
	    };
	    var GL_POINTS = 0;
	    var GL_LINES = 1;
	    var GL_TRIANGLES = 4;
	    var GL_BYTE$2 = 5120;
	    var GL_UNSIGNED_BYTE$4 = 5121;
	    var GL_SHORT$2 = 5122;
	    var GL_UNSIGNED_SHORT$2 = 5123;
	    var GL_INT$2 = 5124;
	    var GL_UNSIGNED_INT$2 = 5125;
	    var GL_ELEMENT_ARRAY_BUFFER = 34963;
	    var GL_STREAM_DRAW$1 = 0x88E0;
	    var GL_STATIC_DRAW$1 = 0x88E4;

	    function wrapElementsState(gl, extensions, bufferState, stats) {
	      var elementSet = {};
	      var elementCount = 0;
	      var elementTypes = {
	        'uint8': GL_UNSIGNED_BYTE$4,
	        'uint16': GL_UNSIGNED_SHORT$2
	      };

	      if (extensions.oes_element_index_uint) {
	        elementTypes.uint32 = GL_UNSIGNED_INT$2;
	      }

	      function REGLElementBuffer(buffer) {
	        this.id = elementCount++;
	        elementSet[this.id] = this;
	        this.buffer = buffer;
	        this.primType = GL_TRIANGLES;
	        this.vertCount = 0;
	        this.type = 0;
	      }

	      REGLElementBuffer.prototype.bind = function () {
	        this.buffer.bind();
	      };

	      var bufferPool = [];

	      function createElementStream(data) {
	        var result = bufferPool.pop();

	        if (!result) {
	          result = new REGLElementBuffer(bufferState.create(null, GL_ELEMENT_ARRAY_BUFFER, true, false)._buffer);
	        }

	        initElements(result, data, GL_STREAM_DRAW$1, -1, -1, 0, 0);
	        return result;
	      }

	      function destroyElementStream(elements) {
	        bufferPool.push(elements);
	      }

	      function initElements(elements, data, usage, prim, count, byteLength, type) {
	        elements.buffer.bind();

	        if (data) {
	          var predictedType = type;

	          if (!type && (!isTypedArray(data) || isNDArrayLike(data) && !isTypedArray(data.data))) {
	            predictedType = extensions.oes_element_index_uint ? GL_UNSIGNED_INT$2 : GL_UNSIGNED_SHORT$2;
	          }

	          bufferState._initBuffer(elements.buffer, data, usage, predictedType, 3);
	        } else {
	          gl.bufferData(GL_ELEMENT_ARRAY_BUFFER, byteLength, usage);
	          elements.buffer.dtype = dtype || GL_UNSIGNED_BYTE$4;
	          elements.buffer.usage = usage;
	          elements.buffer.dimension = 3;
	          elements.buffer.byteLength = byteLength;
	        }

	        var dtype = type;

	        if (!type) {
	          switch (elements.buffer.dtype) {
	            case GL_UNSIGNED_BYTE$4:
	            case GL_BYTE$2:
	              dtype = GL_UNSIGNED_BYTE$4;
	              break;

	            case GL_UNSIGNED_SHORT$2:
	            case GL_SHORT$2:
	              dtype = GL_UNSIGNED_SHORT$2;
	              break;

	            case GL_UNSIGNED_INT$2:
	            case GL_INT$2:
	              dtype = GL_UNSIGNED_INT$2;
	              break;

	            default:
	              check$1.raise('unsupported type for element array');
	          }

	          elements.buffer.dtype = dtype;
	        }

	        elements.type = dtype;
	        check$1(dtype !== GL_UNSIGNED_INT$2 || !!extensions.oes_element_index_uint, '32 bit element buffers not supported, enable oes_element_index_uint first');
	        var vertCount = count;

	        if (vertCount < 0) {
	          vertCount = elements.buffer.byteLength;

	          if (dtype === GL_UNSIGNED_SHORT$2) {
	            vertCount >>= 1;
	          } else if (dtype === GL_UNSIGNED_INT$2) {
	            vertCount >>= 2;
	          }
	        }

	        elements.vertCount = vertCount;
	        var primType = prim;

	        if (prim < 0) {
	          primType = GL_TRIANGLES;
	          var dimension = elements.buffer.dimension;
	          if (dimension === 1) primType = GL_POINTS;
	          if (dimension === 2) primType = GL_LINES;
	          if (dimension === 3) primType = GL_TRIANGLES;
	        }

	        elements.primType = primType;
	      }

	      function destroyElements(elements) {
	        stats.elementsCount--;
	        check$1(elements.buffer !== null, 'must not double destroy elements');
	        delete elementSet[elements.id];
	        elements.buffer.destroy();
	        elements.buffer = null;
	      }

	      function createElements(options, persistent) {
	        var buffer = bufferState.create(null, GL_ELEMENT_ARRAY_BUFFER, true);
	        var elements = new REGLElementBuffer(buffer._buffer);
	        stats.elementsCount++;

	        function reglElements(options) {
	          if (!options) {
	            buffer();
	            elements.primType = GL_TRIANGLES;
	            elements.vertCount = 0;
	            elements.type = GL_UNSIGNED_BYTE$4;
	          } else if (typeof options === 'number') {
	            buffer(options);
	            elements.primType = GL_TRIANGLES;
	            elements.vertCount = options | 0;
	            elements.type = GL_UNSIGNED_BYTE$4;
	          } else {
	            var data = null;
	            var usage = GL_STATIC_DRAW$1;
	            var primType = -1;
	            var vertCount = -1;
	            var byteLength = 0;
	            var dtype = 0;

	            if (Array.isArray(options) || isTypedArray(options) || isNDArrayLike(options)) {
	              data = options;
	            } else {
	              check$1.type(options, 'object', 'invalid arguments for elements');

	              if ('data' in options) {
	                data = options.data;
	                check$1(Array.isArray(data) || isTypedArray(data) || isNDArrayLike(data), 'invalid data for element buffer');
	              }

	              if ('usage' in options) {
	                check$1.parameter(options.usage, usageTypes, 'invalid element buffer usage');
	                usage = usageTypes[options.usage];
	              }

	              if ('primitive' in options) {
	                check$1.parameter(options.primitive, primTypes, 'invalid element buffer primitive');
	                primType = primTypes[options.primitive];
	              }

	              if ('count' in options) {
	                check$1(typeof options.count === 'number' && options.count >= 0, 'invalid vertex count for elements');
	                vertCount = options.count | 0;
	              }

	              if ('type' in options) {
	                check$1.parameter(options.type, elementTypes, 'invalid buffer type');
	                dtype = elementTypes[options.type];
	              }

	              if ('length' in options) {
	                byteLength = options.length | 0;
	              } else {
	                byteLength = vertCount;

	                if (dtype === GL_UNSIGNED_SHORT$2 || dtype === GL_SHORT$2) {
	                  byteLength *= 2;
	                } else if (dtype === GL_UNSIGNED_INT$2 || dtype === GL_INT$2) {
	                  byteLength *= 4;
	                }
	              }
	            }

	            initElements(elements, data, usage, primType, vertCount, byteLength, dtype);
	          }

	          return reglElements;
	        }

	        reglElements(options);
	        reglElements._reglType = 'elements';
	        reglElements._elements = elements;

	        reglElements.subdata = function (data, offset) {
	          buffer.subdata(data, offset);
	          return reglElements;
	        };

	        reglElements.destroy = function () {
	          destroyElements(elements);
	        };

	        return reglElements;
	      }

	      return {
	        create: createElements,
	        createStream: createElementStream,
	        destroyStream: destroyElementStream,
	        getElements: function getElements(elements) {
	          if (typeof elements === 'function' && elements._elements instanceof REGLElementBuffer) {
	            return elements._elements;
	          }

	          return null;
	        },
	        clear: function clear() {
	          values(elementSet).forEach(destroyElements);
	        }
	      };
	    }

	    var FLOAT = new Float32Array(1);
	    var INT = new Uint32Array(FLOAT.buffer);
	    var GL_UNSIGNED_SHORT$4 = 5123;

	    function convertToHalfFloat(array) {
	      var ushorts = pool.allocType(GL_UNSIGNED_SHORT$4, array.length);

	      for (var i = 0; i < array.length; ++i) {
	        if (isNaN(array[i])) {
	          ushorts[i] = 0xffff;
	        } else if (array[i] === Infinity) {
	          ushorts[i] = 0x7c00;
	        } else if (array[i] === -Infinity) {
	          ushorts[i] = 0xfc00;
	        } else {
	          FLOAT[0] = array[i];
	          var x = INT[0];
	          var sgn = x >>> 31 << 15;
	          var exp = (x << 1 >>> 24) - 127;
	          var frac = x >> 13 & (1 << 10) - 1;

	          if (exp < -24) {
	            ushorts[i] = sgn;
	          } else if (exp < -14) {
	            var s = -14 - exp;
	            ushorts[i] = sgn + (frac + (1 << 10) >> s);
	          } else if (exp > 15) {
	            ushorts[i] = sgn + 0x7c00;
	          } else {
	            ushorts[i] = sgn + (exp + 15 << 10) + frac;
	          }
	        }
	      }

	      return ushorts;
	    }

	    function isArrayLike(s) {
	      return Array.isArray(s) || isTypedArray(s);
	    }

	    var isPow2$1 = function isPow2$1(v) {
	      return !(v & v - 1) && !!v;
	    };

	    var GL_COMPRESSED_TEXTURE_FORMATS = 0x86A3;
	    var GL_TEXTURE_2D$1 = 0x0DE1;
	    var GL_TEXTURE_CUBE_MAP$1 = 0x8513;
	    var GL_TEXTURE_CUBE_MAP_POSITIVE_X$1 = 0x8515;
	    var GL_RGBA$1 = 0x1908;
	    var GL_ALPHA = 0x1906;
	    var GL_RGB = 0x1907;
	    var GL_LUMINANCE = 0x1909;
	    var GL_LUMINANCE_ALPHA = 0x190A;
	    var GL_RGBA4 = 0x8056;
	    var GL_RGB5_A1 = 0x8057;
	    var GL_RGB565 = 0x8D62;
	    var GL_UNSIGNED_SHORT_4_4_4_4$1 = 0x8033;
	    var GL_UNSIGNED_SHORT_5_5_5_1$1 = 0x8034;
	    var GL_UNSIGNED_SHORT_5_6_5$1 = 0x8363;
	    var GL_UNSIGNED_INT_24_8_WEBGL$1 = 0x84FA;
	    var GL_DEPTH_COMPONENT = 0x1902;
	    var GL_DEPTH_STENCIL = 0x84F9;
	    var GL_SRGB_EXT = 0x8C40;
	    var GL_SRGB_ALPHA_EXT = 0x8C42;
	    var GL_HALF_FLOAT_OES$1 = 0x8D61;
	    var GL_COMPRESSED_RGB_S3TC_DXT1_EXT = 0x83F0;
	    var GL_COMPRESSED_RGBA_S3TC_DXT1_EXT = 0x83F1;
	    var GL_COMPRESSED_RGBA_S3TC_DXT3_EXT = 0x83F2;
	    var GL_COMPRESSED_RGBA_S3TC_DXT5_EXT = 0x83F3;
	    var GL_COMPRESSED_RGB_ATC_WEBGL = 0x8C92;
	    var GL_COMPRESSED_RGBA_ATC_EXPLICIT_ALPHA_WEBGL = 0x8C93;
	    var GL_COMPRESSED_RGBA_ATC_INTERPOLATED_ALPHA_WEBGL = 0x87EE;
	    var GL_COMPRESSED_RGB_PVRTC_4BPPV1_IMG = 0x8C00;
	    var GL_COMPRESSED_RGB_PVRTC_2BPPV1_IMG = 0x8C01;
	    var GL_COMPRESSED_RGBA_PVRTC_4BPPV1_IMG = 0x8C02;
	    var GL_COMPRESSED_RGBA_PVRTC_2BPPV1_IMG = 0x8C03;
	    var GL_COMPRESSED_RGB_ETC1_WEBGL = 0x8D64;
	    var GL_UNSIGNED_BYTE$5 = 0x1401;
	    var GL_UNSIGNED_SHORT$3 = 0x1403;
	    var GL_UNSIGNED_INT$3 = 0x1405;
	    var GL_FLOAT$4 = 0x1406;
	    var GL_TEXTURE_WRAP_S = 0x2802;
	    var GL_TEXTURE_WRAP_T = 0x2803;
	    var GL_REPEAT = 0x2901;
	    var GL_CLAMP_TO_EDGE$1 = 0x812F;
	    var GL_MIRRORED_REPEAT = 0x8370;
	    var GL_TEXTURE_MAG_FILTER = 0x2800;
	    var GL_TEXTURE_MIN_FILTER = 0x2801;
	    var GL_NEAREST$1 = 0x2600;
	    var GL_LINEAR = 0x2601;
	    var GL_NEAREST_MIPMAP_NEAREST$1 = 0x2700;
	    var GL_LINEAR_MIPMAP_NEAREST$1 = 0x2701;
	    var GL_NEAREST_MIPMAP_LINEAR$1 = 0x2702;
	    var GL_LINEAR_MIPMAP_LINEAR$1 = 0x2703;
	    var GL_GENERATE_MIPMAP_HINT = 0x8192;
	    var GL_DONT_CARE = 0x1100;
	    var GL_FASTEST = 0x1101;
	    var GL_NICEST = 0x1102;
	    var GL_TEXTURE_MAX_ANISOTROPY_EXT = 0x84FE;
	    var GL_UNPACK_ALIGNMENT = 0x0CF5;
	    var GL_UNPACK_FLIP_Y_WEBGL = 0x9240;
	    var GL_UNPACK_PREMULTIPLY_ALPHA_WEBGL = 0x9241;
	    var GL_UNPACK_COLORSPACE_CONVERSION_WEBGL = 0x9243;
	    var GL_BROWSER_DEFAULT_WEBGL = 0x9244;
	    var GL_TEXTURE0$1 = 0x84C0;
	    var MIPMAP_FILTERS = [GL_NEAREST_MIPMAP_NEAREST$1, GL_NEAREST_MIPMAP_LINEAR$1, GL_LINEAR_MIPMAP_NEAREST$1, GL_LINEAR_MIPMAP_LINEAR$1];
	    var CHANNELS_FORMAT = [0, GL_LUMINANCE, GL_LUMINANCE_ALPHA, GL_RGB, GL_RGBA$1];
	    var FORMAT_CHANNELS = {};
	    FORMAT_CHANNELS[GL_LUMINANCE] = FORMAT_CHANNELS[GL_ALPHA] = FORMAT_CHANNELS[GL_DEPTH_COMPONENT] = 1;
	    FORMAT_CHANNELS[GL_DEPTH_STENCIL] = FORMAT_CHANNELS[GL_LUMINANCE_ALPHA] = 2;
	    FORMAT_CHANNELS[GL_RGB] = FORMAT_CHANNELS[GL_SRGB_EXT] = 3;
	    FORMAT_CHANNELS[GL_RGBA$1] = FORMAT_CHANNELS[GL_SRGB_ALPHA_EXT] = 4;

	    function objectName(str) {
	      return '[object ' + str + ']';
	    }

	    var CANVAS_CLASS = objectName('HTMLCanvasElement');
	    var CONTEXT2D_CLASS = objectName('CanvasRenderingContext2D');
	    var BITMAP_CLASS = objectName('ImageBitmap');
	    var IMAGE_CLASS = objectName('HTMLImageElement');
	    var VIDEO_CLASS = objectName('HTMLVideoElement');
	    var PIXEL_CLASSES = Object.keys(arrayTypes).concat([CANVAS_CLASS, CONTEXT2D_CLASS, BITMAP_CLASS, IMAGE_CLASS, VIDEO_CLASS]);
	    var TYPE_SIZES = [];
	    TYPE_SIZES[GL_UNSIGNED_BYTE$5] = 1;
	    TYPE_SIZES[GL_FLOAT$4] = 4;
	    TYPE_SIZES[GL_HALF_FLOAT_OES$1] = 2;
	    TYPE_SIZES[GL_UNSIGNED_SHORT$3] = 2;
	    TYPE_SIZES[GL_UNSIGNED_INT$3] = 4;
	    var FORMAT_SIZES_SPECIAL = [];
	    FORMAT_SIZES_SPECIAL[GL_RGBA4] = 2;
	    FORMAT_SIZES_SPECIAL[GL_RGB5_A1] = 2;
	    FORMAT_SIZES_SPECIAL[GL_RGB565] = 2;
	    FORMAT_SIZES_SPECIAL[GL_DEPTH_STENCIL] = 4;
	    FORMAT_SIZES_SPECIAL[GL_COMPRESSED_RGB_S3TC_DXT1_EXT] = 0.5;
	    FORMAT_SIZES_SPECIAL[GL_COMPRESSED_RGBA_S3TC_DXT1_EXT] = 0.5;
	    FORMAT_SIZES_SPECIAL[GL_COMPRESSED_RGBA_S3TC_DXT3_EXT] = 1;
	    FORMAT_SIZES_SPECIAL[GL_COMPRESSED_RGBA_S3TC_DXT5_EXT] = 1;
	    FORMAT_SIZES_SPECIAL[GL_COMPRESSED_RGB_ATC_WEBGL] = 0.5;
	    FORMAT_SIZES_SPECIAL[GL_COMPRESSED_RGBA_ATC_EXPLICIT_ALPHA_WEBGL] = 1;
	    FORMAT_SIZES_SPECIAL[GL_COMPRESSED_RGBA_ATC_INTERPOLATED_ALPHA_WEBGL] = 1;
	    FORMAT_SIZES_SPECIAL[GL_COMPRESSED_RGB_PVRTC_4BPPV1_IMG] = 0.5;
	    FORMAT_SIZES_SPECIAL[GL_COMPRESSED_RGB_PVRTC_2BPPV1_IMG] = 0.25;
	    FORMAT_SIZES_SPECIAL[GL_COMPRESSED_RGBA_PVRTC_4BPPV1_IMG] = 0.5;
	    FORMAT_SIZES_SPECIAL[GL_COMPRESSED_RGBA_PVRTC_2BPPV1_IMG] = 0.25;
	    FORMAT_SIZES_SPECIAL[GL_COMPRESSED_RGB_ETC1_WEBGL] = 0.5;

	    function isNumericArray(arr) {
	      return Array.isArray(arr) && (arr.length === 0 || typeof arr[0] === 'number');
	    }

	    function isRectArray(arr) {
	      if (!Array.isArray(arr)) {
	        return false;
	      }

	      var width = arr.length;

	      if (width === 0 || !isArrayLike(arr[0])) {
	        return false;
	      }

	      return true;
	    }

	    function classString(x) {
	      return Object.prototype.toString.call(x);
	    }

	    function isCanvasElement(object) {
	      return classString(object) === CANVAS_CLASS;
	    }

	    function isContext2D(object) {
	      return classString(object) === CONTEXT2D_CLASS;
	    }

	    function isBitmap(object) {
	      return classString(object) === BITMAP_CLASS;
	    }

	    function isImageElement(object) {
	      return classString(object) === IMAGE_CLASS;
	    }

	    function isVideoElement(object) {
	      return classString(object) === VIDEO_CLASS;
	    }

	    function isPixelData(object) {
	      if (!object) {
	        return false;
	      }

	      var className = classString(object);

	      if (PIXEL_CLASSES.indexOf(className) >= 0) {
	        return true;
	      }

	      return isNumericArray(object) || isRectArray(object) || isNDArrayLike(object);
	    }

	    function typedArrayCode$1(data) {
	      return arrayTypes[Object.prototype.toString.call(data)] | 0;
	    }

	    function convertData(result, data) {
	      var n = data.length;

	      switch (result.type) {
	        case GL_UNSIGNED_BYTE$5:
	        case GL_UNSIGNED_SHORT$3:
	        case GL_UNSIGNED_INT$3:
	        case GL_FLOAT$4:
	          var converted = pool.allocType(result.type, n);
	          converted.set(data);
	          result.data = converted;
	          break;

	        case GL_HALF_FLOAT_OES$1:
	          result.data = convertToHalfFloat(data);
	          break;

	        default:
	          check$1.raise('unsupported texture type, must specify a typed array');
	      }
	    }

	    function preConvert(image, n) {
	      return pool.allocType(image.type === GL_HALF_FLOAT_OES$1 ? GL_FLOAT$4 : image.type, n);
	    }

	    function postConvert(image, data) {
	      if (image.type === GL_HALF_FLOAT_OES$1) {
	        image.data = convertToHalfFloat(data);
	        pool.freeType(data);
	      } else {
	        image.data = data;
	      }
	    }

	    function transposeData(image, array, strideX, strideY, strideC, offset) {
	      var w = image.width;
	      var h = image.height;
	      var c = image.channels;
	      var n = w * h * c;
	      var data = preConvert(image, n);
	      var p = 0;

	      for (var i = 0; i < h; ++i) {
	        for (var j = 0; j < w; ++j) {
	          for (var k = 0; k < c; ++k) {
	            data[p++] = array[strideX * j + strideY * i + strideC * k + offset];
	          }
	        }
	      }

	      postConvert(image, data);
	    }

	    function getTextureSize(format, type, width, height, isMipmap, isCube) {
	      var s;

	      if (typeof FORMAT_SIZES_SPECIAL[format] !== 'undefined') {
	        s = FORMAT_SIZES_SPECIAL[format];
	      } else {
	        s = FORMAT_CHANNELS[format] * TYPE_SIZES[type];
	      }

	      if (isCube) {
	        s *= 6;
	      }

	      if (isMipmap) {
	        var total = 0;
	        var w = width;

	        while (w >= 1) {
	          total += s * w * w;
	          w /= 2;
	        }

	        return total;
	      } else {
	        return s * width * height;
	      }
	    }

	    function createTextureSet(gl, extensions, limits, reglPoll, contextState, stats, config) {
	      var mipmapHint = {
	        "don't care": GL_DONT_CARE,
	        'dont care': GL_DONT_CARE,
	        'nice': GL_NICEST,
	        'fast': GL_FASTEST
	      };
	      var wrapModes = {
	        'repeat': GL_REPEAT,
	        'clamp': GL_CLAMP_TO_EDGE$1,
	        'mirror': GL_MIRRORED_REPEAT
	      };
	      var magFilters = {
	        'nearest': GL_NEAREST$1,
	        'linear': GL_LINEAR
	      };
	      var minFilters = extend({
	        'mipmap': GL_LINEAR_MIPMAP_LINEAR$1,
	        'nearest mipmap nearest': GL_NEAREST_MIPMAP_NEAREST$1,
	        'linear mipmap nearest': GL_LINEAR_MIPMAP_NEAREST$1,
	        'nearest mipmap linear': GL_NEAREST_MIPMAP_LINEAR$1,
	        'linear mipmap linear': GL_LINEAR_MIPMAP_LINEAR$1
	      }, magFilters);
	      var colorSpace = {
	        'none': 0,
	        'browser': GL_BROWSER_DEFAULT_WEBGL
	      };
	      var textureTypes = {
	        'uint8': GL_UNSIGNED_BYTE$5,
	        'rgba4': GL_UNSIGNED_SHORT_4_4_4_4$1,
	        'rgb565': GL_UNSIGNED_SHORT_5_6_5$1,
	        'rgb5 a1': GL_UNSIGNED_SHORT_5_5_5_1$1
	      };
	      var textureFormats = {
	        'alpha': GL_ALPHA,
	        'luminance': GL_LUMINANCE,
	        'luminance alpha': GL_LUMINANCE_ALPHA,
	        'rgb': GL_RGB,
	        'rgba': GL_RGBA$1,
	        'rgba4': GL_RGBA4,
	        'rgb5 a1': GL_RGB5_A1,
	        'rgb565': GL_RGB565
	      };
	      var compressedTextureFormats = {};

	      if (extensions.ext_srgb) {
	        textureFormats.srgb = GL_SRGB_EXT;
	        textureFormats.srgba = GL_SRGB_ALPHA_EXT;
	      }

	      if (extensions.oes_texture_float) {
	        textureTypes.float32 = textureTypes.float = GL_FLOAT$4;
	      }

	      if (extensions.oes_texture_half_float) {
	        textureTypes['float16'] = textureTypes['half float'] = GL_HALF_FLOAT_OES$1;
	      }

	      if (extensions.webgl_depth_texture) {
	        extend(textureFormats, {
	          'depth': GL_DEPTH_COMPONENT,
	          'depth stencil': GL_DEPTH_STENCIL
	        });
	        extend(textureTypes, {
	          'uint16': GL_UNSIGNED_SHORT$3,
	          'uint32': GL_UNSIGNED_INT$3,
	          'depth stencil': GL_UNSIGNED_INT_24_8_WEBGL$1
	        });
	      }

	      if (extensions.webgl_compressed_texture_s3tc) {
	        extend(compressedTextureFormats, {
	          'rgb s3tc dxt1': GL_COMPRESSED_RGB_S3TC_DXT1_EXT,
	          'rgba s3tc dxt1': GL_COMPRESSED_RGBA_S3TC_DXT1_EXT,
	          'rgba s3tc dxt3': GL_COMPRESSED_RGBA_S3TC_DXT3_EXT,
	          'rgba s3tc dxt5': GL_COMPRESSED_RGBA_S3TC_DXT5_EXT
	        });
	      }

	      if (extensions.webgl_compressed_texture_atc) {
	        extend(compressedTextureFormats, {
	          'rgb atc': GL_COMPRESSED_RGB_ATC_WEBGL,
	          'rgba atc explicit alpha': GL_COMPRESSED_RGBA_ATC_EXPLICIT_ALPHA_WEBGL,
	          'rgba atc interpolated alpha': GL_COMPRESSED_RGBA_ATC_INTERPOLATED_ALPHA_WEBGL
	        });
	      }

	      if (extensions.webgl_compressed_texture_pvrtc) {
	        extend(compressedTextureFormats, {
	          'rgb pvrtc 4bppv1': GL_COMPRESSED_RGB_PVRTC_4BPPV1_IMG,
	          'rgb pvrtc 2bppv1': GL_COMPRESSED_RGB_PVRTC_2BPPV1_IMG,
	          'rgba pvrtc 4bppv1': GL_COMPRESSED_RGBA_PVRTC_4BPPV1_IMG,
	          'rgba pvrtc 2bppv1': GL_COMPRESSED_RGBA_PVRTC_2BPPV1_IMG
	        });
	      }

	      if (extensions.webgl_compressed_texture_etc1) {
	        compressedTextureFormats['rgb etc1'] = GL_COMPRESSED_RGB_ETC1_WEBGL;
	      }

	      var supportedCompressedFormats = Array.prototype.slice.call(gl.getParameter(GL_COMPRESSED_TEXTURE_FORMATS));
	      Object.keys(compressedTextureFormats).forEach(function (name) {
	        var format = compressedTextureFormats[name];

	        if (supportedCompressedFormats.indexOf(format) >= 0) {
	          textureFormats[name] = format;
	        }
	      });
	      var supportedFormats = Object.keys(textureFormats);
	      limits.textureFormats = supportedFormats;
	      var textureFormatsInvert = [];
	      Object.keys(textureFormats).forEach(function (key) {
	        var val = textureFormats[key];
	        textureFormatsInvert[val] = key;
	      });
	      var textureTypesInvert = [];
	      Object.keys(textureTypes).forEach(function (key) {
	        var val = textureTypes[key];
	        textureTypesInvert[val] = key;
	      });
	      var magFiltersInvert = [];
	      Object.keys(magFilters).forEach(function (key) {
	        var val = magFilters[key];
	        magFiltersInvert[val] = key;
	      });
	      var minFiltersInvert = [];
	      Object.keys(minFilters).forEach(function (key) {
	        var val = minFilters[key];
	        minFiltersInvert[val] = key;
	      });
	      var wrapModesInvert = [];
	      Object.keys(wrapModes).forEach(function (key) {
	        var val = wrapModes[key];
	        wrapModesInvert[val] = key;
	      });
	      var colorFormats = supportedFormats.reduce(function (color, key) {
	        var glenum = textureFormats[key];

	        if (glenum === GL_LUMINANCE || glenum === GL_ALPHA || glenum === GL_LUMINANCE || glenum === GL_LUMINANCE_ALPHA || glenum === GL_DEPTH_COMPONENT || glenum === GL_DEPTH_STENCIL) {
	          color[glenum] = glenum;
	        } else if (glenum === GL_RGB5_A1 || key.indexOf('rgba') >= 0) {
	          color[glenum] = GL_RGBA$1;
	        } else {
	          color[glenum] = GL_RGB;
	        }

	        return color;
	      }, {});

	      function TexFlags() {
	        this.internalformat = GL_RGBA$1;
	        this.format = GL_RGBA$1;
	        this.type = GL_UNSIGNED_BYTE$5;
	        this.compressed = false;
	        this.premultiplyAlpha = false;
	        this.flipY = false;
	        this.unpackAlignment = 1;
	        this.colorSpace = GL_BROWSER_DEFAULT_WEBGL;
	        this.width = 0;
	        this.height = 0;
	        this.channels = 0;
	      }

	      function copyFlags(result, other) {
	        result.internalformat = other.internalformat;
	        result.format = other.format;
	        result.type = other.type;
	        result.compressed = other.compressed;
	        result.premultiplyAlpha = other.premultiplyAlpha;
	        result.flipY = other.flipY;
	        result.unpackAlignment = other.unpackAlignment;
	        result.colorSpace = other.colorSpace;
	        result.width = other.width;
	        result.height = other.height;
	        result.channels = other.channels;
	      }

	      function parseFlags(flags, options) {
	        if (typeof options !== 'object' || !options) {
	          return;
	        }

	        if ('premultiplyAlpha' in options) {
	          check$1.type(options.premultiplyAlpha, 'boolean', 'invalid premultiplyAlpha');
	          flags.premultiplyAlpha = options.premultiplyAlpha;
	        }

	        if ('flipY' in options) {
	          check$1.type(options.flipY, 'boolean', 'invalid texture flip');
	          flags.flipY = options.flipY;
	        }

	        if ('alignment' in options) {
	          check$1.oneOf(options.alignment, [1, 2, 4, 8], 'invalid texture unpack alignment');
	          flags.unpackAlignment = options.alignment;
	        }

	        if ('colorSpace' in options) {
	          check$1.parameter(options.colorSpace, colorSpace, 'invalid colorSpace');
	          flags.colorSpace = colorSpace[options.colorSpace];
	        }

	        if ('type' in options) {
	          var type = options.type;
	          check$1(extensions.oes_texture_float || !(type === 'float' || type === 'float32'), 'you must enable the OES_texture_float extension in order to use floating point textures.');
	          check$1(extensions.oes_texture_half_float || !(type === 'half float' || type === 'float16'), 'you must enable the OES_texture_half_float extension in order to use 16-bit floating point textures.');
	          check$1(extensions.webgl_depth_texture || !(type === 'uint16' || type === 'uint32' || type === 'depth stencil'), 'you must enable the WEBGL_depth_texture extension in order to use depth/stencil textures.');
	          check$1.parameter(type, textureTypes, 'invalid texture type');
	          flags.type = textureTypes[type];
	        }

	        var w = flags.width;
	        var h = flags.height;
	        var c = flags.channels;
	        var hasChannels = false;

	        if ('shape' in options) {
	          check$1(Array.isArray(options.shape) && options.shape.length >= 2, 'shape must be an array');
	          w = options.shape[0];
	          h = options.shape[1];

	          if (options.shape.length === 3) {
	            c = options.shape[2];
	            check$1(c > 0 && c <= 4, 'invalid number of channels');
	            hasChannels = true;
	          }

	          check$1(w >= 0 && w <= limits.maxTextureSize, 'invalid width');
	          check$1(h >= 0 && h <= limits.maxTextureSize, 'invalid height');
	        } else {
	          if ('radius' in options) {
	            w = h = options.radius;
	            check$1(w >= 0 && w <= limits.maxTextureSize, 'invalid radius');
	          }

	          if ('width' in options) {
	            w = options.width;
	            check$1(w >= 0 && w <= limits.maxTextureSize, 'invalid width');
	          }

	          if ('height' in options) {
	            h = options.height;
	            check$1(h >= 0 && h <= limits.maxTextureSize, 'invalid height');
	          }

	          if ('channels' in options) {
	            c = options.channels;
	            check$1(c > 0 && c <= 4, 'invalid number of channels');
	            hasChannels = true;
	          }
	        }

	        flags.width = w | 0;
	        flags.height = h | 0;
	        flags.channels = c | 0;
	        var hasFormat = false;

	        if ('format' in options) {
	          var formatStr = options.format;
	          check$1(extensions.webgl_depth_texture || !(formatStr === 'depth' || formatStr === 'depth stencil'), 'you must enable the WEBGL_depth_texture extension in order to use depth/stencil textures.');
	          check$1.parameter(formatStr, textureFormats, 'invalid texture format');
	          var internalformat = flags.internalformat = textureFormats[formatStr];
	          flags.format = colorFormats[internalformat];

	          if (formatStr in textureTypes) {
	            if (!('type' in options)) {
	              flags.type = textureTypes[formatStr];
	            }
	          }

	          if (formatStr in compressedTextureFormats) {
	            flags.compressed = true;
	          }

	          hasFormat = true;
	        }

	        if (!hasChannels && hasFormat) {
	          flags.channels = FORMAT_CHANNELS[flags.format];
	        } else if (hasChannels && !hasFormat) {
	          if (flags.channels !== CHANNELS_FORMAT[flags.format]) {
	            flags.format = flags.internalformat = CHANNELS_FORMAT[flags.channels];
	          }
	        } else if (hasFormat && hasChannels) {
	          check$1(flags.channels === FORMAT_CHANNELS[flags.format], 'number of channels inconsistent with specified format');
	        }
	      }

	      function setFlags(flags) {
	        gl.pixelStorei(GL_UNPACK_FLIP_Y_WEBGL, flags.flipY);
	        gl.pixelStorei(GL_UNPACK_PREMULTIPLY_ALPHA_WEBGL, flags.premultiplyAlpha);
	        gl.pixelStorei(GL_UNPACK_COLORSPACE_CONVERSION_WEBGL, flags.colorSpace);
	        gl.pixelStorei(GL_UNPACK_ALIGNMENT, flags.unpackAlignment);
	      }

	      function TexImage() {
	        TexFlags.call(this);
	        this.xOffset = 0;
	        this.yOffset = 0;
	        this.data = null;
	        this.needsFree = false;
	        this.element = null;
	        this.needsCopy = false;
	      }

	      function parseImage(image, options) {
	        var data = null;

	        if (isPixelData(options)) {
	          data = options;
	        } else if (options) {
	          check$1.type(options, 'object', 'invalid pixel data type');
	          parseFlags(image, options);

	          if ('x' in options) {
	            image.xOffset = options.x | 0;
	          }

	          if ('y' in options) {
	            image.yOffset = options.y | 0;
	          }

	          if (isPixelData(options.data)) {
	            data = options.data;
	          }
	        }

	        check$1(!image.compressed || data instanceof Uint8Array, 'compressed texture data must be stored in a uint8array');

	        if (options.copy) {
	          check$1(!data, 'can not specify copy and data field for the same texture');
	          var viewW = contextState.viewportWidth;
	          var viewH = contextState.viewportHeight;
	          image.width = image.width || viewW - image.xOffset;
	          image.height = image.height || viewH - image.yOffset;
	          image.needsCopy = true;
	          check$1(image.xOffset >= 0 && image.xOffset < viewW && image.yOffset >= 0 && image.yOffset < viewH && image.width > 0 && image.width <= viewW && image.height > 0 && image.height <= viewH, 'copy texture read out of bounds');
	        } else if (!data) {
	          image.width = image.width || 1;
	          image.height = image.height || 1;
	          image.channels = image.channels || 4;
	        } else if (isTypedArray(data)) {
	          image.channels = image.channels || 4;
	          image.data = data;

	          if (!('type' in options) && image.type === GL_UNSIGNED_BYTE$5) {
	            image.type = typedArrayCode$1(data);
	          }
	        } else if (isNumericArray(data)) {
	          image.channels = image.channels || 4;
	          convertData(image, data);
	          image.alignment = 1;
	          image.needsFree = true;
	        } else if (isNDArrayLike(data)) {
	          var array = data.data;

	          if (!Array.isArray(array) && image.type === GL_UNSIGNED_BYTE$5) {
	            image.type = typedArrayCode$1(array);
	          }

	          var shape = data.shape;
	          var stride = data.stride;
	          var shapeX, shapeY, shapeC, strideX, strideY, strideC;

	          if (shape.length === 3) {
	            shapeC = shape[2];
	            strideC = stride[2];
	          } else {
	            check$1(shape.length === 2, 'invalid ndarray pixel data, must be 2 or 3D');
	            shapeC = 1;
	            strideC = 1;
	          }

	          shapeX = shape[0];
	          shapeY = shape[1];
	          strideX = stride[0];
	          strideY = stride[1];
	          image.alignment = 1;
	          image.width = shapeX;
	          image.height = shapeY;
	          image.channels = shapeC;
	          image.format = image.internalformat = CHANNELS_FORMAT[shapeC];
	          image.needsFree = true;
	          transposeData(image, array, strideX, strideY, strideC, data.offset);
	        } else if (isCanvasElement(data) || isContext2D(data)) {
	          if (isCanvasElement(data)) {
	            image.element = data;
	          } else {
	            image.element = data.canvas;
	          }

	          image.width = image.element.width;
	          image.height = image.element.height;
	          image.channels = 4;
	        } else if (isBitmap(data)) {
	          image.element = data;
	          image.width = data.width;
	          image.height = data.height;
	          image.channels = 4;
	        } else if (isImageElement(data)) {
	          image.element = data;
	          image.width = data.naturalWidth;
	          image.height = data.naturalHeight;
	          image.channels = 4;
	        } else if (isVideoElement(data)) {
	          image.element = data;
	          image.width = data.videoWidth;
	          image.height = data.videoHeight;
	          image.channels = 4;
	        } else if (isRectArray(data)) {
	          var w = image.width || data[0].length;
	          var h = image.height || data.length;
	          var c = image.channels;

	          if (isArrayLike(data[0][0])) {
	            c = c || data[0][0].length;
	          } else {
	            c = c || 1;
	          }

	          var arrayShape = flattenUtils.shape(data);
	          var n = 1;

	          for (var dd = 0; dd < arrayShape.length; ++dd) {
	            n *= arrayShape[dd];
	          }

	          var allocData = preConvert(image, n);
	          flattenUtils.flatten(data, arrayShape, '', allocData);
	          postConvert(image, allocData);
	          image.alignment = 1;
	          image.width = w;
	          image.height = h;
	          image.channels = c;
	          image.format = image.internalformat = CHANNELS_FORMAT[c];
	          image.needsFree = true;
	        }

	        if (image.type === GL_FLOAT$4) {
	          check$1(limits.extensions.indexOf('oes_texture_float') >= 0, 'oes_texture_float extension not enabled');
	        } else if (image.type === GL_HALF_FLOAT_OES$1) {
	          check$1(limits.extensions.indexOf('oes_texture_half_float') >= 0, 'oes_texture_half_float extension not enabled');
	        }
	      }

	      function setImage(info, target, miplevel) {
	        var element = info.element;
	        var data = info.data;
	        var internalformat = info.internalformat;
	        var format = info.format;
	        var type = info.type;
	        var width = info.width;
	        var height = info.height;
	        var channels = info.channels;
	        setFlags(info);

	        if (element) {
	          gl.texImage2D(target, miplevel, format, format, type, element);
	        } else if (info.compressed) {
	          gl.compressedTexImage2D(target, miplevel, internalformat, width, height, 0, data);
	        } else if (info.needsCopy) {
	          reglPoll();
	          gl.copyTexImage2D(target, miplevel, format, info.xOffset, info.yOffset, width, height, 0);
	        } else {
	          var nullData = !data;

	          if (nullData) {
	            data = pool.zero.allocType(type, width * height * channels);
	          }

	          gl.texImage2D(target, miplevel, format, width, height, 0, format, type, data);

	          if (nullData && data) {
	            pool.zero.freeType(data);
	          }
	        }
	      }

	      function setSubImage(info, target, x, y, miplevel) {
	        var element = info.element;
	        var data = info.data;
	        var internalformat = info.internalformat;
	        var format = info.format;
	        var type = info.type;
	        var width = info.width;
	        var height = info.height;
	        setFlags(info);

	        if (element) {
	          gl.texSubImage2D(target, miplevel, x, y, format, type, element);
	        } else if (info.compressed) {
	          gl.compressedTexSubImage2D(target, miplevel, x, y, internalformat, width, height, data);
	        } else if (info.needsCopy) {
	          reglPoll();
	          gl.copyTexSubImage2D(target, miplevel, x, y, info.xOffset, info.yOffset, width, height);
	        } else {
	          gl.texSubImage2D(target, miplevel, x, y, width, height, format, type, data);
	        }
	      }

	      var imagePool = [];

	      function allocImage() {
	        return imagePool.pop() || new TexImage();
	      }

	      function freeImage(image) {
	        if (image.needsFree) {
	          pool.freeType(image.data);
	        }

	        TexImage.call(image);
	        imagePool.push(image);
	      }

	      function MipMap() {
	        TexFlags.call(this);
	        this.genMipmaps = false;
	        this.mipmapHint = GL_DONT_CARE;
	        this.mipmask = 0;
	        this.images = Array(16);
	      }

	      function parseMipMapFromShape(mipmap, width, height) {
	        var img = mipmap.images[0] = allocImage();
	        mipmap.mipmask = 1;
	        img.width = mipmap.width = width;
	        img.height = mipmap.height = height;
	        img.channels = mipmap.channels = 4;
	      }

	      function parseMipMapFromObject(mipmap, options) {
	        var imgData = null;

	        if (isPixelData(options)) {
	          imgData = mipmap.images[0] = allocImage();
	          copyFlags(imgData, mipmap);
	          parseImage(imgData, options);
	          mipmap.mipmask = 1;
	        } else {
	          parseFlags(mipmap, options);

	          if (Array.isArray(options.mipmap)) {
	            var mipData = options.mipmap;

	            for (var i = 0; i < mipData.length; ++i) {
	              imgData = mipmap.images[i] = allocImage();
	              copyFlags(imgData, mipmap);
	              imgData.width >>= i;
	              imgData.height >>= i;
	              parseImage(imgData, mipData[i]);
	              mipmap.mipmask |= 1 << i;
	            }
	          } else {
	            imgData = mipmap.images[0] = allocImage();
	            copyFlags(imgData, mipmap);
	            parseImage(imgData, options);
	            mipmap.mipmask = 1;
	          }
	        }

	        copyFlags(mipmap, mipmap.images[0]);

	        if (mipmap.compressed && mipmap.internalformat === GL_COMPRESSED_RGB_S3TC_DXT1_EXT || mipmap.internalformat === GL_COMPRESSED_RGBA_S3TC_DXT1_EXT || mipmap.internalformat === GL_COMPRESSED_RGBA_S3TC_DXT3_EXT || mipmap.internalformat === GL_COMPRESSED_RGBA_S3TC_DXT5_EXT) {
	          check$1(mipmap.width % 4 === 0 && mipmap.height % 4 === 0, 'for compressed texture formats, mipmap level 0 must have width and height that are a multiple of 4');
	        }
	      }

	      function setMipMap(mipmap, target) {
	        var images = mipmap.images;

	        for (var i = 0; i < images.length; ++i) {
	          if (!images[i]) {
	            return;
	          }

	          setImage(images[i], target, i);
	        }
	      }

	      var mipPool = [];

	      function allocMipMap() {
	        var result = mipPool.pop() || new MipMap();
	        TexFlags.call(result);
	        result.mipmask = 0;

	        for (var i = 0; i < 16; ++i) {
	          result.images[i] = null;
	        }

	        return result;
	      }

	      function freeMipMap(mipmap) {
	        var images = mipmap.images;

	        for (var i = 0; i < images.length; ++i) {
	          if (images[i]) {
	            freeImage(images[i]);
	          }

	          images[i] = null;
	        }

	        mipPool.push(mipmap);
	      }

	      function TexInfo() {
	        this.minFilter = GL_NEAREST$1;
	        this.magFilter = GL_NEAREST$1;
	        this.wrapS = GL_CLAMP_TO_EDGE$1;
	        this.wrapT = GL_CLAMP_TO_EDGE$1;
	        this.anisotropic = 1;
	        this.genMipmaps = false;
	        this.mipmapHint = GL_DONT_CARE;
	      }

	      function parseTexInfo(info, options) {
	        if ('min' in options) {
	          var minFilter = options.min;
	          check$1.parameter(minFilter, minFilters);
	          info.minFilter = minFilters[minFilter];

	          if (MIPMAP_FILTERS.indexOf(info.minFilter) >= 0 && !('faces' in options)) {
	            info.genMipmaps = true;
	          }
	        }

	        if ('mag' in options) {
	          var magFilter = options.mag;
	          check$1.parameter(magFilter, magFilters);
	          info.magFilter = magFilters[magFilter];
	        }

	        var wrapS = info.wrapS;
	        var wrapT = info.wrapT;

	        if ('wrap' in options) {
	          var wrap = options.wrap;

	          if (typeof wrap === 'string') {
	            check$1.parameter(wrap, wrapModes);
	            wrapS = wrapT = wrapModes[wrap];
	          } else if (Array.isArray(wrap)) {
	            check$1.parameter(wrap[0], wrapModes);
	            check$1.parameter(wrap[1], wrapModes);
	            wrapS = wrapModes[wrap[0]];
	            wrapT = wrapModes[wrap[1]];
	          }
	        } else {
	          if ('wrapS' in options) {
	            var optWrapS = options.wrapS;
	            check$1.parameter(optWrapS, wrapModes);
	            wrapS = wrapModes[optWrapS];
	          }

	          if ('wrapT' in options) {
	            var optWrapT = options.wrapT;
	            check$1.parameter(optWrapT, wrapModes);
	            wrapT = wrapModes[optWrapT];
	          }
	        }

	        info.wrapS = wrapS;
	        info.wrapT = wrapT;

	        if ('anisotropic' in options) {
	          var anisotropic = options.anisotropic;
	          check$1(typeof anisotropic === 'number' && anisotropic >= 1 && anisotropic <= limits.maxAnisotropic, 'aniso samples must be between 1 and ');
	          info.anisotropic = options.anisotropic;
	        }

	        if ('mipmap' in options) {
	          var hasMipMap = false;

	          switch (typeof options.mipmap) {
	            case 'string':
	              check$1.parameter(options.mipmap, mipmapHint, 'invalid mipmap hint');
	              info.mipmapHint = mipmapHint[options.mipmap];
	              info.genMipmaps = true;
	              hasMipMap = true;
	              break;

	            case 'boolean':
	              hasMipMap = info.genMipmaps = options.mipmap;
	              break;

	            case 'object':
	              check$1(Array.isArray(options.mipmap), 'invalid mipmap type');
	              info.genMipmaps = false;
	              hasMipMap = true;
	              break;

	            default:
	              check$1.raise('invalid mipmap type');
	          }

	          if (hasMipMap && !('min' in options)) {
	            info.minFilter = GL_NEAREST_MIPMAP_NEAREST$1;
	          }
	        }
	      }

	      function setTexInfo(info, target) {
	        gl.texParameteri(target, GL_TEXTURE_MIN_FILTER, info.minFilter);
	        gl.texParameteri(target, GL_TEXTURE_MAG_FILTER, info.magFilter);
	        gl.texParameteri(target, GL_TEXTURE_WRAP_S, info.wrapS);
	        gl.texParameteri(target, GL_TEXTURE_WRAP_T, info.wrapT);

	        if (extensions.ext_texture_filter_anisotropic) {
	          gl.texParameteri(target, GL_TEXTURE_MAX_ANISOTROPY_EXT, info.anisotropic);
	        }

	        if (info.genMipmaps) {
	          gl.hint(GL_GENERATE_MIPMAP_HINT, info.mipmapHint);
	          gl.generateMipmap(target);
	        }
	      }

	      var textureCount = 0;
	      var textureSet = {};
	      var numTexUnits = limits.maxTextureUnits;
	      var textureUnits = Array(numTexUnits).map(function () {
	        return null;
	      });

	      function REGLTexture(target) {
	        TexFlags.call(this);
	        this.mipmask = 0;
	        this.internalformat = GL_RGBA$1;
	        this.id = textureCount++;
	        this.refCount = 1;
	        this.target = target;
	        this.texture = gl.createTexture();
	        this.unit = -1;
	        this.bindCount = 0;
	        this.texInfo = new TexInfo();

	        if (config.profile) {
	          this.stats = {
	            size: 0
	          };
	        }
	      }

	      function tempBind(texture) {
	        gl.activeTexture(GL_TEXTURE0$1);
	        gl.bindTexture(texture.target, texture.texture);
	      }

	      function tempRestore() {
	        var prev = textureUnits[0];

	        if (prev) {
	          gl.bindTexture(prev.target, prev.texture);
	        } else {
	          gl.bindTexture(GL_TEXTURE_2D$1, null);
	        }
	      }

	      function destroy(texture) {
	        var handle = texture.texture;
	        check$1(handle, 'must not double destroy texture');
	        var unit = texture.unit;
	        var target = texture.target;

	        if (unit >= 0) {
	          gl.activeTexture(GL_TEXTURE0$1 + unit);
	          gl.bindTexture(target, null);
	          textureUnits[unit] = null;
	        }

	        gl.deleteTexture(handle);
	        texture.texture = null;
	        texture.params = null;
	        texture.pixels = null;
	        texture.refCount = 0;
	        delete textureSet[texture.id];
	        stats.textureCount--;
	      }

	      extend(REGLTexture.prototype, {
	        bind: function bind() {
	          var texture = this;
	          texture.bindCount += 1;
	          var unit = texture.unit;

	          if (unit < 0) {
	            for (var i = 0; i < numTexUnits; ++i) {
	              var other = textureUnits[i];

	              if (other) {
	                if (other.bindCount > 0) {
	                  continue;
	                }

	                other.unit = -1;
	              }

	              textureUnits[i] = texture;
	              unit = i;
	              break;
	            }

	            if (unit >= numTexUnits) {
	              check$1.raise('insufficient number of texture units');
	            }

	            if (config.profile && stats.maxTextureUnits < unit + 1) {
	              stats.maxTextureUnits = unit + 1;
	            }

	            texture.unit = unit;
	            gl.activeTexture(GL_TEXTURE0$1 + unit);
	            gl.bindTexture(texture.target, texture.texture);
	          }

	          return unit;
	        },
	        unbind: function unbind() {
	          this.bindCount -= 1;
	        },
	        decRef: function decRef() {
	          if (--this.refCount <= 0) {
	            destroy(this);
	          }
	        }
	      });

	      function createTexture2D(a, b) {
	        var texture = new REGLTexture(GL_TEXTURE_2D$1);
	        textureSet[texture.id] = texture;
	        stats.textureCount++;

	        function reglTexture2D(a, b) {
	          var texInfo = texture.texInfo;
	          TexInfo.call(texInfo);
	          var mipData = allocMipMap();

	          if (typeof a === 'number') {
	            if (typeof b === 'number') {
	              parseMipMapFromShape(mipData, a | 0, b | 0);
	            } else {
	              parseMipMapFromShape(mipData, a | 0, a | 0);
	            }
	          } else if (a) {
	            check$1.type(a, 'object', 'invalid arguments to regl.texture');
	            parseTexInfo(texInfo, a);
	            parseMipMapFromObject(mipData, a);
	          } else {
	            parseMipMapFromShape(mipData, 1, 1);
	          }

	          if (texInfo.genMipmaps) {
	            mipData.mipmask = (mipData.width << 1) - 1;
	          }

	          texture.mipmask = mipData.mipmask;
	          copyFlags(texture, mipData);
	          check$1.texture2D(texInfo, mipData, limits);
	          texture.internalformat = mipData.internalformat;
	          reglTexture2D.width = mipData.width;
	          reglTexture2D.height = mipData.height;
	          tempBind(texture);
	          setMipMap(mipData, GL_TEXTURE_2D$1);
	          setTexInfo(texInfo, GL_TEXTURE_2D$1);
	          tempRestore();
	          freeMipMap(mipData);

	          if (config.profile) {
	            texture.stats.size = getTextureSize(texture.internalformat, texture.type, mipData.width, mipData.height, texInfo.genMipmaps, false);
	          }

	          reglTexture2D.format = textureFormatsInvert[texture.internalformat];
	          reglTexture2D.type = textureTypesInvert[texture.type];
	          reglTexture2D.mag = magFiltersInvert[texInfo.magFilter];
	          reglTexture2D.min = minFiltersInvert[texInfo.minFilter];
	          reglTexture2D.wrapS = wrapModesInvert[texInfo.wrapS];
	          reglTexture2D.wrapT = wrapModesInvert[texInfo.wrapT];
	          return reglTexture2D;
	        }

	        function subimage(image, x_, y_, level_) {
	          check$1(!!image, 'must specify image data');
	          var x = x_ | 0;
	          var y = y_ | 0;
	          var level = level_ | 0;
	          var imageData = allocImage();
	          copyFlags(imageData, texture);
	          imageData.width = 0;
	          imageData.height = 0;
	          parseImage(imageData, image);
	          imageData.width = imageData.width || (texture.width >> level) - x;
	          imageData.height = imageData.height || (texture.height >> level) - y;
	          check$1(texture.type === imageData.type && texture.format === imageData.format && texture.internalformat === imageData.internalformat, 'incompatible format for texture.subimage');
	          check$1(x >= 0 && y >= 0 && x + imageData.width <= texture.width && y + imageData.height <= texture.height, 'texture.subimage write out of bounds');
	          check$1(texture.mipmask & 1 << level, 'missing mipmap data');
	          check$1(imageData.data || imageData.element || imageData.needsCopy, 'missing image data');
	          tempBind(texture);
	          setSubImage(imageData, GL_TEXTURE_2D$1, x, y, level);
	          tempRestore();
	          freeImage(imageData);
	          return reglTexture2D;
	        }

	        function resize(w_, h_) {
	          var w = w_ | 0;
	          var h = h_ | 0 || w;

	          if (w === texture.width && h === texture.height) {
	            return reglTexture2D;
	          }

	          reglTexture2D.width = texture.width = w;
	          reglTexture2D.height = texture.height = h;
	          tempBind(texture);
	          var data;
	          var channels = texture.channels;
	          var type = texture.type;

	          for (var i = 0; texture.mipmask >> i; ++i) {
	            var _w = w >> i;

	            var _h = h >> i;

	            if (!_w || !_h) break;
	            data = pool.zero.allocType(type, _w * _h * channels);
	            gl.texImage2D(GL_TEXTURE_2D$1, i, texture.format, _w, _h, 0, texture.format, texture.type, data);
	            if (data) pool.zero.freeType(data);
	          }

	          tempRestore();

	          if (config.profile) {
	            texture.stats.size = getTextureSize(texture.internalformat, texture.type, w, h, false, false);
	          }

	          return reglTexture2D;
	        }

	        reglTexture2D(a, b);
	        reglTexture2D.subimage = subimage;
	        reglTexture2D.resize = resize;
	        reglTexture2D._reglType = 'texture2d';
	        reglTexture2D._texture = texture;

	        if (config.profile) {
	          reglTexture2D.stats = texture.stats;
	        }

	        reglTexture2D.destroy = function () {
	          texture.decRef();
	        };

	        return reglTexture2D;
	      }

	      function createTextureCube(a0, a1, a2, a3, a4, a5) {
	        var texture = new REGLTexture(GL_TEXTURE_CUBE_MAP$1);
	        textureSet[texture.id] = texture;
	        stats.cubeCount++;
	        var faces = new Array(6);

	        function reglTextureCube(a0, a1, a2, a3, a4, a5) {
	          var i;
	          var texInfo = texture.texInfo;
	          TexInfo.call(texInfo);

	          for (i = 0; i < 6; ++i) {
	            faces[i] = allocMipMap();
	          }

	          if (typeof a0 === 'number' || !a0) {
	            var s = a0 | 0 || 1;

	            for (i = 0; i < 6; ++i) {
	              parseMipMapFromShape(faces[i], s, s);
	            }
	          } else if (typeof a0 === 'object') {
	            if (a1) {
	              parseMipMapFromObject(faces[0], a0);
	              parseMipMapFromObject(faces[1], a1);
	              parseMipMapFromObject(faces[2], a2);
	              parseMipMapFromObject(faces[3], a3);
	              parseMipMapFromObject(faces[4], a4);
	              parseMipMapFromObject(faces[5], a5);
	            } else {
	              parseTexInfo(texInfo, a0);
	              parseFlags(texture, a0);

	              if ('faces' in a0) {
	                var face_input = a0.faces;
	                check$1(Array.isArray(face_input) && face_input.length === 6, 'cube faces must be a length 6 array');

	                for (i = 0; i < 6; ++i) {
	                  check$1(typeof face_input[i] === 'object' && !!face_input[i], 'invalid input for cube map face');
	                  copyFlags(faces[i], texture);
	                  parseMipMapFromObject(faces[i], face_input[i]);
	                }
	              } else {
	                for (i = 0; i < 6; ++i) {
	                  parseMipMapFromObject(faces[i], a0);
	                }
	              }
	            }
	          } else {
	            check$1.raise('invalid arguments to cube map');
	          }

	          copyFlags(texture, faces[0]);

	          if (!limits.npotTextureCube) {
	            check$1(isPow2$1(texture.width) && isPow2$1(texture.height), 'your browser does not support non power or two texture dimensions');
	          }

	          if (texInfo.genMipmaps) {
	            texture.mipmask = (faces[0].width << 1) - 1;
	          } else {
	            texture.mipmask = faces[0].mipmask;
	          }

	          check$1.textureCube(texture, texInfo, faces, limits);
	          texture.internalformat = faces[0].internalformat;
	          reglTextureCube.width = faces[0].width;
	          reglTextureCube.height = faces[0].height;
	          tempBind(texture);

	          for (i = 0; i < 6; ++i) {
	            setMipMap(faces[i], GL_TEXTURE_CUBE_MAP_POSITIVE_X$1 + i);
	          }

	          setTexInfo(texInfo, GL_TEXTURE_CUBE_MAP$1);
	          tempRestore();

	          if (config.profile) {
	            texture.stats.size = getTextureSize(texture.internalformat, texture.type, reglTextureCube.width, reglTextureCube.height, texInfo.genMipmaps, true);
	          }

	          reglTextureCube.format = textureFormatsInvert[texture.internalformat];
	          reglTextureCube.type = textureTypesInvert[texture.type];
	          reglTextureCube.mag = magFiltersInvert[texInfo.magFilter];
	          reglTextureCube.min = minFiltersInvert[texInfo.minFilter];
	          reglTextureCube.wrapS = wrapModesInvert[texInfo.wrapS];
	          reglTextureCube.wrapT = wrapModesInvert[texInfo.wrapT];

	          for (i = 0; i < 6; ++i) {
	            freeMipMap(faces[i]);
	          }

	          return reglTextureCube;
	        }

	        function subimage(face, image, x_, y_, level_) {
	          check$1(!!image, 'must specify image data');
	          check$1(typeof face === 'number' && face === (face | 0) && face >= 0 && face < 6, 'invalid face');
	          var x = x_ | 0;
	          var y = y_ | 0;
	          var level = level_ | 0;
	          var imageData = allocImage();
	          copyFlags(imageData, texture);
	          imageData.width = 0;
	          imageData.height = 0;
	          parseImage(imageData, image);
	          imageData.width = imageData.width || (texture.width >> level) - x;
	          imageData.height = imageData.height || (texture.height >> level) - y;
	          check$1(texture.type === imageData.type && texture.format === imageData.format && texture.internalformat === imageData.internalformat, 'incompatible format for texture.subimage');
	          check$1(x >= 0 && y >= 0 && x + imageData.width <= texture.width && y + imageData.height <= texture.height, 'texture.subimage write out of bounds');
	          check$1(texture.mipmask & 1 << level, 'missing mipmap data');
	          check$1(imageData.data || imageData.element || imageData.needsCopy, 'missing image data');
	          tempBind(texture);
	          setSubImage(imageData, GL_TEXTURE_CUBE_MAP_POSITIVE_X$1 + face, x, y, level);
	          tempRestore();
	          freeImage(imageData);
	          return reglTextureCube;
	        }

	        function resize(radius_) {
	          var radius = radius_ | 0;

	          if (radius === texture.width) {
	            return;
	          }

	          reglTextureCube.width = texture.width = radius;
	          reglTextureCube.height = texture.height = radius;
	          tempBind(texture);

	          for (var i = 0; i < 6; ++i) {
	            for (var j = 0; texture.mipmask >> j; ++j) {
	              gl.texImage2D(GL_TEXTURE_CUBE_MAP_POSITIVE_X$1 + i, j, texture.format, radius >> j, radius >> j, 0, texture.format, texture.type, null);
	            }
	          }

	          tempRestore();

	          if (config.profile) {
	            texture.stats.size = getTextureSize(texture.internalformat, texture.type, reglTextureCube.width, reglTextureCube.height, false, true);
	          }

	          return reglTextureCube;
	        }

	        reglTextureCube(a0, a1, a2, a3, a4, a5);
	        reglTextureCube.subimage = subimage;
	        reglTextureCube.resize = resize;
	        reglTextureCube._reglType = 'textureCube';
	        reglTextureCube._texture = texture;

	        if (config.profile) {
	          reglTextureCube.stats = texture.stats;
	        }

	        reglTextureCube.destroy = function () {
	          texture.decRef();
	        };

	        return reglTextureCube;
	      }

	      function destroyTextures() {
	        for (var i = 0; i < numTexUnits; ++i) {
	          gl.activeTexture(GL_TEXTURE0$1 + i);
	          gl.bindTexture(GL_TEXTURE_2D$1, null);
	          textureUnits[i] = null;
	        }

	        values(textureSet).forEach(destroy);
	        stats.cubeCount = 0;
	        stats.textureCount = 0;
	      }

	      if (config.profile) {
	        stats.getTotalTextureSize = function () {
	          var total = 0;
	          Object.keys(textureSet).forEach(function (key) {
	            total += textureSet[key].stats.size;
	          });
	          return total;
	        };
	      }

	      function restoreTextures() {
	        for (var i = 0; i < numTexUnits; ++i) {
	          var tex = textureUnits[i];

	          if (tex) {
	            tex.bindCount = 0;
	            tex.unit = -1;
	            textureUnits[i] = null;
	          }
	        }

	        values(textureSet).forEach(function (texture) {
	          texture.texture = gl.createTexture();
	          gl.bindTexture(texture.target, texture.texture);

	          for (var i = 0; i < 32; ++i) {
	            if ((texture.mipmask & 1 << i) === 0) {
	              continue;
	            }

	            if (texture.target === GL_TEXTURE_2D$1) {
	              gl.texImage2D(GL_TEXTURE_2D$1, i, texture.internalformat, texture.width >> i, texture.height >> i, 0, texture.internalformat, texture.type, null);
	            } else {
	              for (var j = 0; j < 6; ++j) {
	                gl.texImage2D(GL_TEXTURE_CUBE_MAP_POSITIVE_X$1 + j, i, texture.internalformat, texture.width >> i, texture.height >> i, 0, texture.internalformat, texture.type, null);
	              }
	            }
	          }

	          setTexInfo(texture.texInfo, texture.target);
	        });
	      }

	      return {
	        create2D: createTexture2D,
	        createCube: createTextureCube,
	        clear: destroyTextures,
	        getTexture: function getTexture(wrapper) {
	          return null;
	        },
	        restore: restoreTextures
	      };
	    }

	    var GL_RENDERBUFFER = 0x8D41;
	    var GL_RGBA4$1 = 0x8056;
	    var GL_RGB5_A1$1 = 0x8057;
	    var GL_RGB565$1 = 0x8D62;
	    var GL_DEPTH_COMPONENT16 = 0x81A5;
	    var GL_STENCIL_INDEX8 = 0x8D48;
	    var GL_DEPTH_STENCIL$1 = 0x84F9;
	    var GL_SRGB8_ALPHA8_EXT = 0x8C43;
	    var GL_RGBA32F_EXT = 0x8814;
	    var GL_RGBA16F_EXT = 0x881A;
	    var GL_RGB16F_EXT = 0x881B;
	    var FORMAT_SIZES = [];
	    FORMAT_SIZES[GL_RGBA4$1] = 2;
	    FORMAT_SIZES[GL_RGB5_A1$1] = 2;
	    FORMAT_SIZES[GL_RGB565$1] = 2;
	    FORMAT_SIZES[GL_DEPTH_COMPONENT16] = 2;
	    FORMAT_SIZES[GL_STENCIL_INDEX8] = 1;
	    FORMAT_SIZES[GL_DEPTH_STENCIL$1] = 4;
	    FORMAT_SIZES[GL_SRGB8_ALPHA8_EXT] = 4;
	    FORMAT_SIZES[GL_RGBA32F_EXT] = 16;
	    FORMAT_SIZES[GL_RGBA16F_EXT] = 8;
	    FORMAT_SIZES[GL_RGB16F_EXT] = 6;

	    function getRenderbufferSize(format, width, height) {
	      return FORMAT_SIZES[format] * width * height;
	    }

	    var wrapRenderbuffers = function wrapRenderbuffers(gl, extensions, limits, stats, config) {
	      var formatTypes = {
	        'rgba4': GL_RGBA4$1,
	        'rgb565': GL_RGB565$1,
	        'rgb5 a1': GL_RGB5_A1$1,
	        'depth': GL_DEPTH_COMPONENT16,
	        'stencil': GL_STENCIL_INDEX8,
	        'depth stencil': GL_DEPTH_STENCIL$1
	      };

	      if (extensions.ext_srgb) {
	        formatTypes['srgba'] = GL_SRGB8_ALPHA8_EXT;
	      }

	      if (extensions.ext_color_buffer_half_float) {
	        formatTypes['rgba16f'] = GL_RGBA16F_EXT;
	        formatTypes['rgb16f'] = GL_RGB16F_EXT;
	      }

	      if (extensions.webgl_color_buffer_float) {
	        formatTypes['rgba32f'] = GL_RGBA32F_EXT;
	      }

	      var formatTypesInvert = [];
	      Object.keys(formatTypes).forEach(function (key) {
	        var val = formatTypes[key];
	        formatTypesInvert[val] = key;
	      });
	      var renderbufferCount = 0;
	      var renderbufferSet = {};

	      function REGLRenderbuffer(renderbuffer) {
	        this.id = renderbufferCount++;
	        this.refCount = 1;
	        this.renderbuffer = renderbuffer;
	        this.format = GL_RGBA4$1;
	        this.width = 0;
	        this.height = 0;

	        if (config.profile) {
	          this.stats = {
	            size: 0
	          };
	        }
	      }

	      REGLRenderbuffer.prototype.decRef = function () {
	        if (--this.refCount <= 0) {
	          destroy(this);
	        }
	      };

	      function destroy(rb) {
	        var handle = rb.renderbuffer;
	        check$1(handle, 'must not double destroy renderbuffer');
	        gl.bindRenderbuffer(GL_RENDERBUFFER, null);
	        gl.deleteRenderbuffer(handle);
	        rb.renderbuffer = null;
	        rb.refCount = 0;
	        delete renderbufferSet[rb.id];
	        stats.renderbufferCount--;
	      }

	      function createRenderbuffer(a, b) {
	        var renderbuffer = new REGLRenderbuffer(gl.createRenderbuffer());
	        renderbufferSet[renderbuffer.id] = renderbuffer;
	        stats.renderbufferCount++;

	        function reglRenderbuffer(a, b) {
	          var w = 0;
	          var h = 0;
	          var format = GL_RGBA4$1;

	          if (typeof a === 'object' && a) {
	            var options = a;

	            if ('shape' in options) {
	              var shape = options.shape;
	              check$1(Array.isArray(shape) && shape.length >= 2, 'invalid renderbuffer shape');
	              w = shape[0] | 0;
	              h = shape[1] | 0;
	            } else {
	              if ('radius' in options) {
	                w = h = options.radius | 0;
	              }

	              if ('width' in options) {
	                w = options.width | 0;
	              }

	              if ('height' in options) {
	                h = options.height | 0;
	              }
	            }

	            if ('format' in options) {
	              check$1.parameter(options.format, formatTypes, 'invalid renderbuffer format');
	              format = formatTypes[options.format];
	            }
	          } else if (typeof a === 'number') {
	            w = a | 0;

	            if (typeof b === 'number') {
	              h = b | 0;
	            } else {
	              h = w;
	            }
	          } else if (!a) {
	            w = h = 1;
	          } else {
	            check$1.raise('invalid arguments to renderbuffer constructor');
	          }

	          check$1(w > 0 && h > 0 && w <= limits.maxRenderbufferSize && h <= limits.maxRenderbufferSize, 'invalid renderbuffer size');

	          if (w === renderbuffer.width && h === renderbuffer.height && format === renderbuffer.format) {
	            return;
	          }

	          reglRenderbuffer.width = renderbuffer.width = w;
	          reglRenderbuffer.height = renderbuffer.height = h;
	          renderbuffer.format = format;
	          gl.bindRenderbuffer(GL_RENDERBUFFER, renderbuffer.renderbuffer);
	          gl.renderbufferStorage(GL_RENDERBUFFER, format, w, h);
	          check$1(gl.getError() === 0, 'invalid render buffer format');

	          if (config.profile) {
	            renderbuffer.stats.size = getRenderbufferSize(renderbuffer.format, renderbuffer.width, renderbuffer.height);
	          }

	          reglRenderbuffer.format = formatTypesInvert[renderbuffer.format];
	          return reglRenderbuffer;
	        }

	        function resize(w_, h_) {
	          var w = w_ | 0;
	          var h = h_ | 0 || w;

	          if (w === renderbuffer.width && h === renderbuffer.height) {
	            return reglRenderbuffer;
	          }

	          check$1(w > 0 && h > 0 && w <= limits.maxRenderbufferSize && h <= limits.maxRenderbufferSize, 'invalid renderbuffer size');
	          reglRenderbuffer.width = renderbuffer.width = w;
	          reglRenderbuffer.height = renderbuffer.height = h;
	          gl.bindRenderbuffer(GL_RENDERBUFFER, renderbuffer.renderbuffer);
	          gl.renderbufferStorage(GL_RENDERBUFFER, renderbuffer.format, w, h);
	          check$1(gl.getError() === 0, 'invalid render buffer format');

	          if (config.profile) {
	            renderbuffer.stats.size = getRenderbufferSize(renderbuffer.format, renderbuffer.width, renderbuffer.height);
	          }

	          return reglRenderbuffer;
	        }

	        reglRenderbuffer(a, b);
	        reglRenderbuffer.resize = resize;
	        reglRenderbuffer._reglType = 'renderbuffer';
	        reglRenderbuffer._renderbuffer = renderbuffer;

	        if (config.profile) {
	          reglRenderbuffer.stats = renderbuffer.stats;
	        }

	        reglRenderbuffer.destroy = function () {
	          renderbuffer.decRef();
	        };

	        return reglRenderbuffer;
	      }

	      if (config.profile) {
	        stats.getTotalRenderbufferSize = function () {
	          var total = 0;
	          Object.keys(renderbufferSet).forEach(function (key) {
	            total += renderbufferSet[key].stats.size;
	          });
	          return total;
	        };
	      }

	      function restoreRenderbuffers() {
	        values(renderbufferSet).forEach(function (rb) {
	          rb.renderbuffer = gl.createRenderbuffer();
	          gl.bindRenderbuffer(GL_RENDERBUFFER, rb.renderbuffer);
	          gl.renderbufferStorage(GL_RENDERBUFFER, rb.format, rb.width, rb.height);
	        });
	        gl.bindRenderbuffer(GL_RENDERBUFFER, null);
	      }

	      return {
	        create: createRenderbuffer,
	        clear: function clear() {
	          values(renderbufferSet).forEach(destroy);
	        },
	        restore: restoreRenderbuffers
	      };
	    };

	    var GL_FRAMEBUFFER$1 = 0x8D40;
	    var GL_RENDERBUFFER$1 = 0x8D41;
	    var GL_TEXTURE_2D$2 = 0x0DE1;
	    var GL_TEXTURE_CUBE_MAP_POSITIVE_X$2 = 0x8515;
	    var GL_COLOR_ATTACHMENT0$1 = 0x8CE0;
	    var GL_DEPTH_ATTACHMENT = 0x8D00;
	    var GL_STENCIL_ATTACHMENT = 0x8D20;
	    var GL_DEPTH_STENCIL_ATTACHMENT = 0x821A;
	    var GL_FRAMEBUFFER_COMPLETE$1 = 0x8CD5;
	    var GL_FRAMEBUFFER_INCOMPLETE_ATTACHMENT = 0x8CD6;
	    var GL_FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT = 0x8CD7;
	    var GL_FRAMEBUFFER_INCOMPLETE_DIMENSIONS = 0x8CD9;
	    var GL_FRAMEBUFFER_UNSUPPORTED = 0x8CDD;
	    var GL_HALF_FLOAT_OES$2 = 0x8D61;
	    var GL_UNSIGNED_BYTE$6 = 0x1401;
	    var GL_FLOAT$5 = 0x1406;
	    var GL_RGB$1 = 0x1907;
	    var GL_RGBA$2 = 0x1908;
	    var GL_DEPTH_COMPONENT$1 = 0x1902;
	    var colorTextureFormatEnums = [GL_RGB$1, GL_RGBA$2];
	    var textureFormatChannels = [];
	    textureFormatChannels[GL_RGBA$2] = 4;
	    textureFormatChannels[GL_RGB$1] = 3;
	    var textureTypeSizes = [];
	    textureTypeSizes[GL_UNSIGNED_BYTE$6] = 1;
	    textureTypeSizes[GL_FLOAT$5] = 4;
	    textureTypeSizes[GL_HALF_FLOAT_OES$2] = 2;
	    var GL_RGBA4$2 = 0x8056;
	    var GL_RGB5_A1$2 = 0x8057;
	    var GL_RGB565$2 = 0x8D62;
	    var GL_DEPTH_COMPONENT16$1 = 0x81A5;
	    var GL_STENCIL_INDEX8$1 = 0x8D48;
	    var GL_DEPTH_STENCIL$2 = 0x84F9;
	    var GL_SRGB8_ALPHA8_EXT$1 = 0x8C43;
	    var GL_RGBA32F_EXT$1 = 0x8814;
	    var GL_RGBA16F_EXT$1 = 0x881A;
	    var GL_RGB16F_EXT$1 = 0x881B;
	    var colorRenderbufferFormatEnums = [GL_RGBA4$2, GL_RGB5_A1$2, GL_RGB565$2, GL_SRGB8_ALPHA8_EXT$1, GL_RGBA16F_EXT$1, GL_RGB16F_EXT$1, GL_RGBA32F_EXT$1];
	    var statusCode = {};
	    statusCode[GL_FRAMEBUFFER_COMPLETE$1] = 'complete';
	    statusCode[GL_FRAMEBUFFER_INCOMPLETE_ATTACHMENT] = 'incomplete attachment';
	    statusCode[GL_FRAMEBUFFER_INCOMPLETE_DIMENSIONS] = 'incomplete dimensions';
	    statusCode[GL_FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT] = 'incomplete, missing attachment';
	    statusCode[GL_FRAMEBUFFER_UNSUPPORTED] = 'unsupported';

	    function wrapFBOState(gl, extensions, limits, textureState, renderbufferState, stats) {
	      var framebufferState = {
	        cur: null,
	        next: null,
	        dirty: false,
	        setFBO: null
	      };
	      var colorTextureFormats = ['rgba'];
	      var colorRenderbufferFormats = ['rgba4', 'rgb565', 'rgb5 a1'];

	      if (extensions.ext_srgb) {
	        colorRenderbufferFormats.push('srgba');
	      }

	      if (extensions.ext_color_buffer_half_float) {
	        colorRenderbufferFormats.push('rgba16f', 'rgb16f');
	      }

	      if (extensions.webgl_color_buffer_float) {
	        colorRenderbufferFormats.push('rgba32f');
	      }

	      var colorTypes = ['uint8'];

	      if (extensions.oes_texture_half_float) {
	        colorTypes.push('half float', 'float16');
	      }

	      if (extensions.oes_texture_float) {
	        colorTypes.push('float', 'float32');
	      }

	      function FramebufferAttachment(target, texture, renderbuffer) {
	        this.target = target;
	        this.texture = texture;
	        this.renderbuffer = renderbuffer;
	        var w = 0;
	        var h = 0;

	        if (texture) {
	          w = texture.width;
	          h = texture.height;
	        } else if (renderbuffer) {
	          w = renderbuffer.width;
	          h = renderbuffer.height;
	        }

	        this.width = w;
	        this.height = h;
	      }

	      function decRef(attachment) {
	        if (attachment) {
	          if (attachment.texture) {
	            attachment.texture._texture.decRef();
	          }

	          if (attachment.renderbuffer) {
	            attachment.renderbuffer._renderbuffer.decRef();
	          }
	        }
	      }

	      function incRefAndCheckShape(attachment, width, height) {
	        if (!attachment) {
	          return;
	        }

	        if (attachment.texture) {
	          var texture = attachment.texture._texture;
	          var tw = Math.max(1, texture.width);
	          var th = Math.max(1, texture.height);
	          check$1(tw === width && th === height, 'inconsistent width/height for supplied texture');
	          texture.refCount += 1;
	        } else {
	          var renderbuffer = attachment.renderbuffer._renderbuffer;
	          check$1(renderbuffer.width === width && renderbuffer.height === height, 'inconsistent width/height for renderbuffer');
	          renderbuffer.refCount += 1;
	        }
	      }

	      function attach(location, attachment) {
	        if (attachment) {
	          if (attachment.texture) {
	            gl.framebufferTexture2D(GL_FRAMEBUFFER$1, location, attachment.target, attachment.texture._texture.texture, 0);
	          } else {
	            gl.framebufferRenderbuffer(GL_FRAMEBUFFER$1, location, GL_RENDERBUFFER$1, attachment.renderbuffer._renderbuffer.renderbuffer);
	          }
	        }
	      }

	      function parseAttachment(attachment) {
	        var target = GL_TEXTURE_2D$2;
	        var texture = null;
	        var renderbuffer = null;
	        var data = attachment;

	        if (typeof attachment === 'object') {
	          data = attachment.data;

	          if ('target' in attachment) {
	            target = attachment.target | 0;
	          }
	        }

	        check$1.type(data, 'function', 'invalid attachment data');
	        var type = data._reglType;

	        if (type === 'texture2d') {
	          texture = data;
	          check$1(target === GL_TEXTURE_2D$2);
	        } else if (type === 'textureCube') {
	          texture = data;
	          check$1(target >= GL_TEXTURE_CUBE_MAP_POSITIVE_X$2 && target < GL_TEXTURE_CUBE_MAP_POSITIVE_X$2 + 6, 'invalid cube map target');
	        } else if (type === 'renderbuffer') {
	          renderbuffer = data;
	          target = GL_RENDERBUFFER$1;
	        } else {
	          check$1.raise('invalid regl object for attachment');
	        }

	        return new FramebufferAttachment(target, texture, renderbuffer);
	      }

	      function allocAttachment(width, height, isTexture, format, type) {
	        if (isTexture) {
	          var texture = textureState.create2D({
	            width: width,
	            height: height,
	            format: format,
	            type: type
	          });
	          texture._texture.refCount = 0;
	          return new FramebufferAttachment(GL_TEXTURE_2D$2, texture, null);
	        } else {
	          var rb = renderbufferState.create({
	            width: width,
	            height: height,
	            format: format
	          });
	          rb._renderbuffer.refCount = 0;
	          return new FramebufferAttachment(GL_RENDERBUFFER$1, null, rb);
	        }
	      }

	      function unwrapAttachment(attachment) {
	        return attachment && (attachment.texture || attachment.renderbuffer);
	      }

	      function resizeAttachment(attachment, w, h) {
	        if (attachment) {
	          if (attachment.texture) {
	            attachment.texture.resize(w, h);
	          } else if (attachment.renderbuffer) {
	            attachment.renderbuffer.resize(w, h);
	          }

	          attachment.width = w;
	          attachment.height = h;
	        }
	      }

	      var framebufferCount = 0;
	      var framebufferSet = {};

	      function REGLFramebuffer() {
	        this.id = framebufferCount++;
	        framebufferSet[this.id] = this;
	        this.framebuffer = gl.createFramebuffer();
	        this.width = 0;
	        this.height = 0;
	        this.colorAttachments = [];
	        this.depthAttachment = null;
	        this.stencilAttachment = null;
	        this.depthStencilAttachment = null;
	      }

	      function decFBORefs(framebuffer) {
	        framebuffer.colorAttachments.forEach(decRef);
	        decRef(framebuffer.depthAttachment);
	        decRef(framebuffer.stencilAttachment);
	        decRef(framebuffer.depthStencilAttachment);
	      }

	      function _destroy(framebuffer) {
	        var handle = framebuffer.framebuffer;
	        check$1(handle, 'must not double destroy framebuffer');
	        gl.deleteFramebuffer(handle);
	        framebuffer.framebuffer = null;
	        stats.framebufferCount--;
	        delete framebufferSet[framebuffer.id];
	      }

	      function updateFramebuffer(framebuffer) {
	        var i;
	        gl.bindFramebuffer(GL_FRAMEBUFFER$1, framebuffer.framebuffer);
	        var colorAttachments = framebuffer.colorAttachments;

	        for (i = 0; i < colorAttachments.length; ++i) {
	          attach(GL_COLOR_ATTACHMENT0$1 + i, colorAttachments[i]);
	        }

	        for (i = colorAttachments.length; i < limits.maxColorAttachments; ++i) {
	          gl.framebufferTexture2D(GL_FRAMEBUFFER$1, GL_COLOR_ATTACHMENT0$1 + i, GL_TEXTURE_2D$2, null, 0);
	        }

	        gl.framebufferTexture2D(GL_FRAMEBUFFER$1, GL_DEPTH_STENCIL_ATTACHMENT, GL_TEXTURE_2D$2, null, 0);
	        gl.framebufferTexture2D(GL_FRAMEBUFFER$1, GL_DEPTH_ATTACHMENT, GL_TEXTURE_2D$2, null, 0);
	        gl.framebufferTexture2D(GL_FRAMEBUFFER$1, GL_STENCIL_ATTACHMENT, GL_TEXTURE_2D$2, null, 0);
	        attach(GL_DEPTH_ATTACHMENT, framebuffer.depthAttachment);
	        attach(GL_STENCIL_ATTACHMENT, framebuffer.stencilAttachment);
	        attach(GL_DEPTH_STENCIL_ATTACHMENT, framebuffer.depthStencilAttachment);
	        var status = gl.checkFramebufferStatus(GL_FRAMEBUFFER$1);

	        if (!gl.isContextLost() && status !== GL_FRAMEBUFFER_COMPLETE$1) {
	          check$1.raise('framebuffer configuration not supported, status = ' + statusCode[status]);
	        }

	        gl.bindFramebuffer(GL_FRAMEBUFFER$1, framebufferState.next ? framebufferState.next.framebuffer : null);
	        framebufferState.cur = framebufferState.next;
	        gl.getError();
	      }

	      function createFBO(a0, a1) {
	        var framebuffer = new REGLFramebuffer();
	        stats.framebufferCount++;

	        function reglFramebuffer(a, b) {
	          var i;
	          check$1(framebufferState.next !== framebuffer, 'can not update framebuffer which is currently in use');
	          var width = 0;
	          var height = 0;
	          var needsDepth = true;
	          var needsStencil = true;
	          var colorBuffer = null;
	          var colorTexture = true;
	          var colorFormat = 'rgba';
	          var colorType = 'uint8';
	          var colorCount = 1;
	          var depthBuffer = null;
	          var stencilBuffer = null;
	          var depthStencilBuffer = null;
	          var depthStencilTexture = false;

	          if (typeof a === 'number') {
	            width = a | 0;
	            height = b | 0 || width;
	          } else if (!a) {
	            width = height = 1;
	          } else {
	            check$1.type(a, 'object', 'invalid arguments for framebuffer');
	            var options = a;

	            if ('shape' in options) {
	              var shape = options.shape;
	              check$1(Array.isArray(shape) && shape.length >= 2, 'invalid shape for framebuffer');
	              width = shape[0];
	              height = shape[1];
	            } else {
	              if ('radius' in options) {
	                width = height = options.radius;
	              }

	              if ('width' in options) {
	                width = options.width;
	              }

	              if ('height' in options) {
	                height = options.height;
	              }
	            }

	            if ('color' in options || 'colors' in options) {
	              colorBuffer = options.color || options.colors;

	              if (Array.isArray(colorBuffer)) {
	                check$1(colorBuffer.length === 1 || extensions.webgl_draw_buffers, 'multiple render targets not supported');
	              }
	            }

	            if (!colorBuffer) {
	              if ('colorCount' in options) {
	                colorCount = options.colorCount | 0;
	                check$1(colorCount > 0, 'invalid color buffer count');
	              }

	              if ('colorTexture' in options) {
	                colorTexture = !!options.colorTexture;
	                colorFormat = 'rgba4';
	              }

	              if ('colorType' in options) {
	                colorType = options.colorType;

	                if (!colorTexture) {
	                  if (colorType === 'half float' || colorType === 'float16') {
	                    check$1(extensions.ext_color_buffer_half_float, 'you must enable EXT_color_buffer_half_float to use 16-bit render buffers');
	                    colorFormat = 'rgba16f';
	                  } else if (colorType === 'float' || colorType === 'float32') {
	                    check$1(extensions.webgl_color_buffer_float, 'you must enable WEBGL_color_buffer_float in order to use 32-bit floating point renderbuffers');
	                    colorFormat = 'rgba32f';
	                  }
	                } else {
	                  check$1(extensions.oes_texture_float || !(colorType === 'float' || colorType === 'float32'), 'you must enable OES_texture_float in order to use floating point framebuffer objects');
	                  check$1(extensions.oes_texture_half_float || !(colorType === 'half float' || colorType === 'float16'), 'you must enable OES_texture_half_float in order to use 16-bit floating point framebuffer objects');
	                }

	                check$1.oneOf(colorType, colorTypes, 'invalid color type');
	              }

	              if ('colorFormat' in options) {
	                colorFormat = options.colorFormat;

	                if (colorTextureFormats.indexOf(colorFormat) >= 0) {
	                  colorTexture = true;
	                } else if (colorRenderbufferFormats.indexOf(colorFormat) >= 0) {
	                  colorTexture = false;
	                } else {
	                  if (colorTexture) {
	                    check$1.oneOf(options.colorFormat, colorTextureFormats, 'invalid color format for texture');
	                  } else {
	                    check$1.oneOf(options.colorFormat, colorRenderbufferFormats, 'invalid color format for renderbuffer');
	                  }
	                }
	              }
	            }

	            if ('depthTexture' in options || 'depthStencilTexture' in options) {
	              depthStencilTexture = !!(options.depthTexture || options.depthStencilTexture);
	              check$1(!depthStencilTexture || extensions.webgl_depth_texture, 'webgl_depth_texture extension not supported');
	            }

	            if ('depth' in options) {
	              if (typeof options.depth === 'boolean') {
	                needsDepth = options.depth;
	              } else {
	                depthBuffer = options.depth;
	                needsStencil = false;
	              }
	            }

	            if ('stencil' in options) {
	              if (typeof options.stencil === 'boolean') {
	                needsStencil = options.stencil;
	              } else {
	                stencilBuffer = options.stencil;
	                needsDepth = false;
	              }
	            }

	            if ('depthStencil' in options) {
	              if (typeof options.depthStencil === 'boolean') {
	                needsDepth = needsStencil = options.depthStencil;
	              } else {
	                depthStencilBuffer = options.depthStencil;
	                needsDepth = false;
	                needsStencil = false;
	              }
	            }
	          }

	          var colorAttachments = null;
	          var depthAttachment = null;
	          var stencilAttachment = null;
	          var depthStencilAttachment = null;

	          if (Array.isArray(colorBuffer)) {
	            colorAttachments = colorBuffer.map(parseAttachment);
	          } else if (colorBuffer) {
	            colorAttachments = [parseAttachment(colorBuffer)];
	          } else {
	            colorAttachments = new Array(colorCount);

	            for (i = 0; i < colorCount; ++i) {
	              colorAttachments[i] = allocAttachment(width, height, colorTexture, colorFormat, colorType);
	            }
	          }

	          check$1(extensions.webgl_draw_buffers || colorAttachments.length <= 1, 'you must enable the WEBGL_draw_buffers extension in order to use multiple color buffers.');
	          check$1(colorAttachments.length <= limits.maxColorAttachments, 'too many color attachments, not supported');
	          width = width || colorAttachments[0].width;
	          height = height || colorAttachments[0].height;

	          if (depthBuffer) {
	            depthAttachment = parseAttachment(depthBuffer);
	          } else if (needsDepth && !needsStencil) {
	            depthAttachment = allocAttachment(width, height, depthStencilTexture, 'depth', 'uint32');
	          }

	          if (stencilBuffer) {
	            stencilAttachment = parseAttachment(stencilBuffer);
	          } else if (needsStencil && !needsDepth) {
	            stencilAttachment = allocAttachment(width, height, false, 'stencil', 'uint8');
	          }

	          if (depthStencilBuffer) {
	            depthStencilAttachment = parseAttachment(depthStencilBuffer);
	          } else if (!depthBuffer && !stencilBuffer && needsStencil && needsDepth) {
	            depthStencilAttachment = allocAttachment(width, height, depthStencilTexture, 'depth stencil', 'depth stencil');
	          }

	          check$1(!!depthBuffer + !!stencilBuffer + !!depthStencilBuffer <= 1, 'invalid framebuffer configuration, can specify exactly one depth/stencil attachment');
	          var commonColorAttachmentSize = null;

	          for (i = 0; i < colorAttachments.length; ++i) {
	            incRefAndCheckShape(colorAttachments[i], width, height);
	            check$1(!colorAttachments[i] || colorAttachments[i].texture && colorTextureFormatEnums.indexOf(colorAttachments[i].texture._texture.format) >= 0 || colorAttachments[i].renderbuffer && colorRenderbufferFormatEnums.indexOf(colorAttachments[i].renderbuffer._renderbuffer.format) >= 0, 'framebuffer color attachment ' + i + ' is invalid');

	            if (colorAttachments[i] && colorAttachments[i].texture) {
	              var colorAttachmentSize = textureFormatChannels[colorAttachments[i].texture._texture.format] * textureTypeSizes[colorAttachments[i].texture._texture.type];

	              if (commonColorAttachmentSize === null) {
	                commonColorAttachmentSize = colorAttachmentSize;
	              } else {
	                check$1(commonColorAttachmentSize === colorAttachmentSize, 'all color attachments much have the same number of bits per pixel.');
	              }
	            }
	          }

	          incRefAndCheckShape(depthAttachment, width, height);
	          check$1(!depthAttachment || depthAttachment.texture && depthAttachment.texture._texture.format === GL_DEPTH_COMPONENT$1 || depthAttachment.renderbuffer && depthAttachment.renderbuffer._renderbuffer.format === GL_DEPTH_COMPONENT16$1, 'invalid depth attachment for framebuffer object');
	          incRefAndCheckShape(stencilAttachment, width, height);
	          check$1(!stencilAttachment || stencilAttachment.renderbuffer && stencilAttachment.renderbuffer._renderbuffer.format === GL_STENCIL_INDEX8$1, 'invalid stencil attachment for framebuffer object');
	          incRefAndCheckShape(depthStencilAttachment, width, height);
	          check$1(!depthStencilAttachment || depthStencilAttachment.texture && depthStencilAttachment.texture._texture.format === GL_DEPTH_STENCIL$2 || depthStencilAttachment.renderbuffer && depthStencilAttachment.renderbuffer._renderbuffer.format === GL_DEPTH_STENCIL$2, 'invalid depth-stencil attachment for framebuffer object');
	          decFBORefs(framebuffer);
	          framebuffer.width = width;
	          framebuffer.height = height;
	          framebuffer.colorAttachments = colorAttachments;
	          framebuffer.depthAttachment = depthAttachment;
	          framebuffer.stencilAttachment = stencilAttachment;
	          framebuffer.depthStencilAttachment = depthStencilAttachment;
	          reglFramebuffer.color = colorAttachments.map(unwrapAttachment);
	          reglFramebuffer.depth = unwrapAttachment(depthAttachment);
	          reglFramebuffer.stencil = unwrapAttachment(stencilAttachment);
	          reglFramebuffer.depthStencil = unwrapAttachment(depthStencilAttachment);
	          reglFramebuffer.width = framebuffer.width;
	          reglFramebuffer.height = framebuffer.height;
	          updateFramebuffer(framebuffer);
	          return reglFramebuffer;
	        }

	        function resize(w_, h_) {
	          check$1(framebufferState.next !== framebuffer, 'can not resize a framebuffer which is currently in use');
	          var w = Math.max(w_ | 0, 1);
	          var h = Math.max(h_ | 0 || w, 1);

	          if (w === framebuffer.width && h === framebuffer.height) {
	            return reglFramebuffer;
	          }

	          var colorAttachments = framebuffer.colorAttachments;

	          for (var i = 0; i < colorAttachments.length; ++i) {
	            resizeAttachment(colorAttachments[i], w, h);
	          }

	          resizeAttachment(framebuffer.depthAttachment, w, h);
	          resizeAttachment(framebuffer.stencilAttachment, w, h);
	          resizeAttachment(framebuffer.depthStencilAttachment, w, h);
	          framebuffer.width = reglFramebuffer.width = w;
	          framebuffer.height = reglFramebuffer.height = h;
	          updateFramebuffer(framebuffer);
	          return reglFramebuffer;
	        }

	        reglFramebuffer(a0, a1);
	        return extend(reglFramebuffer, {
	          resize: resize,
	          _reglType: 'framebuffer',
	          _framebuffer: framebuffer,
	          destroy: function destroy() {
	            _destroy(framebuffer);

	            decFBORefs(framebuffer);
	          },
	          use: function use(block) {
	            framebufferState.setFBO({
	              framebuffer: reglFramebuffer
	            }, block);
	          }
	        });
	      }

	      function createCubeFBO(options) {
	        var faces = Array(6);

	        function reglFramebufferCube(a) {
	          var i;
	          check$1(faces.indexOf(framebufferState.next) < 0, 'can not update framebuffer which is currently in use');
	          var params = {
	            color: null
	          };
	          var radius = 0;
	          var colorBuffer = null;
	          var colorFormat = 'rgba';
	          var colorType = 'uint8';
	          var colorCount = 1;

	          if (typeof a === 'number') {
	            radius = a | 0;
	          } else if (!a) {
	            radius = 1;
	          } else {
	            check$1.type(a, 'object', 'invalid arguments for framebuffer');
	            var options = a;

	            if ('shape' in options) {
	              var shape = options.shape;
	              check$1(Array.isArray(shape) && shape.length >= 2, 'invalid shape for framebuffer');
	              check$1(shape[0] === shape[1], 'cube framebuffer must be square');
	              radius = shape[0];
	            } else {
	              if ('radius' in options) {
	                radius = options.radius | 0;
	              }

	              if ('width' in options) {
	                radius = options.width | 0;

	                if ('height' in options) {
	                  check$1(options.height === radius, 'must be square');
	                }
	              } else if ('height' in options) {
	                radius = options.height | 0;
	              }
	            }

	            if ('color' in options || 'colors' in options) {
	              colorBuffer = options.color || options.colors;

	              if (Array.isArray(colorBuffer)) {
	                check$1(colorBuffer.length === 1 || extensions.webgl_draw_buffers, 'multiple render targets not supported');
	              }
	            }

	            if (!colorBuffer) {
	              if ('colorCount' in options) {
	                colorCount = options.colorCount | 0;
	                check$1(colorCount > 0, 'invalid color buffer count');
	              }

	              if ('colorType' in options) {
	                check$1.oneOf(options.colorType, colorTypes, 'invalid color type');
	                colorType = options.colorType;
	              }

	              if ('colorFormat' in options) {
	                colorFormat = options.colorFormat;
	                check$1.oneOf(options.colorFormat, colorTextureFormats, 'invalid color format for texture');
	              }
	            }

	            if ('depth' in options) {
	              params.depth = options.depth;
	            }

	            if ('stencil' in options) {
	              params.stencil = options.stencil;
	            }

	            if ('depthStencil' in options) {
	              params.depthStencil = options.depthStencil;
	            }
	          }

	          var colorCubes;

	          if (colorBuffer) {
	            if (Array.isArray(colorBuffer)) {
	              colorCubes = [];

	              for (i = 0; i < colorBuffer.length; ++i) {
	                colorCubes[i] = colorBuffer[i];
	              }
	            } else {
	              colorCubes = [colorBuffer];
	            }
	          } else {
	            colorCubes = Array(colorCount);
	            var cubeMapParams = {
	              radius: radius,
	              format: colorFormat,
	              type: colorType
	            };

	            for (i = 0; i < colorCount; ++i) {
	              colorCubes[i] = textureState.createCube(cubeMapParams);
	            }
	          }

	          params.color = Array(colorCubes.length);

	          for (i = 0; i < colorCubes.length; ++i) {
	            var cube = colorCubes[i];
	            check$1(typeof cube === 'function' && cube._reglType === 'textureCube', 'invalid cube map');
	            radius = radius || cube.width;
	            check$1(cube.width === radius && cube.height === radius, 'invalid cube map shape');
	            params.color[i] = {
	              target: GL_TEXTURE_CUBE_MAP_POSITIVE_X$2,
	              data: colorCubes[i]
	            };
	          }

	          for (i = 0; i < 6; ++i) {
	            for (var j = 0; j < colorCubes.length; ++j) {
	              params.color[j].target = GL_TEXTURE_CUBE_MAP_POSITIVE_X$2 + i;
	            }

	            if (i > 0) {
	              params.depth = faces[0].depth;
	              params.stencil = faces[0].stencil;
	              params.depthStencil = faces[0].depthStencil;
	            }

	            if (faces[i]) {
	              faces[i](params);
	            } else {
	              faces[i] = createFBO(params);
	            }
	          }

	          return extend(reglFramebufferCube, {
	            width: radius,
	            height: radius,
	            color: colorCubes
	          });
	        }

	        function resize(radius_) {
	          var i;
	          var radius = radius_ | 0;
	          check$1(radius > 0 && radius <= limits.maxCubeMapSize, 'invalid radius for cube fbo');

	          if (radius === reglFramebufferCube.width) {
	            return reglFramebufferCube;
	          }

	          var colors = reglFramebufferCube.color;

	          for (i = 0; i < colors.length; ++i) {
	            colors[i].resize(radius);
	          }

	          for (i = 0; i < 6; ++i) {
	            faces[i].resize(radius);
	          }

	          reglFramebufferCube.width = reglFramebufferCube.height = radius;
	          return reglFramebufferCube;
	        }

	        reglFramebufferCube(options);
	        return extend(reglFramebufferCube, {
	          faces: faces,
	          resize: resize,
	          _reglType: 'framebufferCube',
	          destroy: function destroy() {
	            faces.forEach(function (f) {
	              f.destroy();
	            });
	          }
	        });
	      }

	      function restoreFramebuffers() {
	        framebufferState.cur = null;
	        framebufferState.next = null;
	        framebufferState.dirty = true;
	        values(framebufferSet).forEach(function (fb) {
	          fb.framebuffer = gl.createFramebuffer();
	          updateFramebuffer(fb);
	        });
	      }

	      return extend(framebufferState, {
	        getFramebuffer: function getFramebuffer(object) {
	          if (typeof object === 'function' && object._reglType === 'framebuffer') {
	            var fbo = object._framebuffer;
	            return fbo;
	          }

	          return null;
	        },
	        create: createFBO,
	        createCube: createCubeFBO,
	        clear: function clear() {
	          values(framebufferSet).forEach(_destroy);
	        },
	        restore: restoreFramebuffers
	      });
	    }

	    var GL_FLOAT$6 = 5126;

	    function AttributeRecord() {
	      this.state = 0;
	      this.x = 0.0;
	      this.y = 0.0;
	      this.z = 0.0;
	      this.w = 0.0;
	      this.buffer = null;
	      this.size = 0;
	      this.normalized = false;
	      this.type = GL_FLOAT$6;
	      this.offset = 0;
	      this.stride = 0;
	      this.divisor = 0;
	    }

	    function wrapAttributeState(gl, extensions, limits, stringStore) {
	      var NUM_ATTRIBUTES = limits.maxAttributes;
	      var attributeBindings = new Array(NUM_ATTRIBUTES);

	      for (var i = 0; i < NUM_ATTRIBUTES; ++i) {
	        attributeBindings[i] = new AttributeRecord();
	      }

	      return {
	        Record: AttributeRecord,
	        scope: {},
	        state: attributeBindings
	      };
	    }

	    var GL_FRAGMENT_SHADER = 35632;
	    var GL_VERTEX_SHADER = 35633;
	    var GL_ACTIVE_UNIFORMS = 0x8B86;
	    var GL_ACTIVE_ATTRIBUTES = 0x8B89;

	    function wrapShaderState(gl, stringStore, stats, config) {
	      var fragShaders = {};
	      var vertShaders = {};

	      function ActiveInfo(name, id, location, info) {
	        this.name = name;
	        this.id = id;
	        this.location = location;
	        this.info = info;
	      }

	      function insertActiveInfo(list, info) {
	        for (var i = 0; i < list.length; ++i) {
	          if (list[i].id === info.id) {
	            list[i].location = info.location;
	            return;
	          }
	        }

	        list.push(info);
	      }

	      function getShader(type, id, command) {
	        var cache = type === GL_FRAGMENT_SHADER ? fragShaders : vertShaders;
	        var shader = cache[id];

	        if (!shader) {
	          var source = stringStore.str(id);
	          shader = gl.createShader(type);
	          gl.shaderSource(shader, source);
	          gl.compileShader(shader);
	          check$1.shaderError(gl, shader, source, type, command);
	          cache[id] = shader;
	        }

	        return shader;
	      }

	      var programCache = {};
	      var programList = [];
	      var PROGRAM_COUNTER = 0;

	      function REGLProgram(fragId, vertId) {
	        this.id = PROGRAM_COUNTER++;
	        this.fragId = fragId;
	        this.vertId = vertId;
	        this.program = null;
	        this.uniforms = [];
	        this.attributes = [];

	        if (config.profile) {
	          this.stats = {
	            uniformsCount: 0,
	            attributesCount: 0
	          };
	        }
	      }

	      function linkProgram(desc, command) {
	        var i, info;
	        var fragShader = getShader(GL_FRAGMENT_SHADER, desc.fragId);
	        var vertShader = getShader(GL_VERTEX_SHADER, desc.vertId);
	        var program = desc.program = gl.createProgram();
	        gl.attachShader(program, fragShader);
	        gl.attachShader(program, vertShader);
	        gl.linkProgram(program);
	        check$1.linkError(gl, program, stringStore.str(desc.fragId), stringStore.str(desc.vertId), command);
	        var numUniforms = gl.getProgramParameter(program, GL_ACTIVE_UNIFORMS);

	        if (config.profile) {
	          desc.stats.uniformsCount = numUniforms;
	        }

	        var uniforms = desc.uniforms;

	        for (i = 0; i < numUniforms; ++i) {
	          info = gl.getActiveUniform(program, i);

	          if (info) {
	            if (info.size > 1) {
	              for (var j = 0; j < info.size; ++j) {
	                var name = info.name.replace('[0]', '[' + j + ']');
	                insertActiveInfo(uniforms, new ActiveInfo(name, stringStore.id(name), gl.getUniformLocation(program, name), info));
	              }
	            } else {
	              insertActiveInfo(uniforms, new ActiveInfo(info.name, stringStore.id(info.name), gl.getUniformLocation(program, info.name), info));
	            }
	          }
	        }

	        var numAttributes = gl.getProgramParameter(program, GL_ACTIVE_ATTRIBUTES);

	        if (config.profile) {
	          desc.stats.attributesCount = numAttributes;
	        }

	        var attributes = desc.attributes;

	        for (i = 0; i < numAttributes; ++i) {
	          info = gl.getActiveAttrib(program, i);

	          if (info) {
	            insertActiveInfo(attributes, new ActiveInfo(info.name, stringStore.id(info.name), gl.getAttribLocation(program, info.name), info));
	          }
	        }
	      }

	      if (config.profile) {
	        stats.getMaxUniformsCount = function () {
	          var m = 0;
	          programList.forEach(function (desc) {
	            if (desc.stats.uniformsCount > m) {
	              m = desc.stats.uniformsCount;
	            }
	          });
	          return m;
	        };

	        stats.getMaxAttributesCount = function () {
	          var m = 0;
	          programList.forEach(function (desc) {
	            if (desc.stats.attributesCount > m) {
	              m = desc.stats.attributesCount;
	            }
	          });
	          return m;
	        };
	      }

	      function restoreShaders() {
	        fragShaders = {};
	        vertShaders = {};

	        for (var i = 0; i < programList.length; ++i) {
	          linkProgram(programList[i]);
	        }
	      }

	      return {
	        clear: function clear() {
	          var deleteShader = gl.deleteShader.bind(gl);
	          values(fragShaders).forEach(deleteShader);
	          fragShaders = {};
	          values(vertShaders).forEach(deleteShader);
	          vertShaders = {};
	          programList.forEach(function (desc) {
	            gl.deleteProgram(desc.program);
	          });
	          programList.length = 0;
	          programCache = {};
	          stats.shaderCount = 0;
	        },
	        program: function program(vertId, fragId, command) {
	          check$1.command(vertId >= 0, 'missing vertex shader', command);
	          check$1.command(fragId >= 0, 'missing fragment shader', command);
	          var cache = programCache[fragId];

	          if (!cache) {
	            cache = programCache[fragId] = {};
	          }

	          var program = cache[vertId];

	          if (!program) {
	            program = new REGLProgram(fragId, vertId);
	            stats.shaderCount++;
	            linkProgram(program, command);
	            cache[vertId] = program;
	            programList.push(program);
	          }

	          return program;
	        },
	        restore: restoreShaders,
	        shader: getShader,
	        frag: -1,
	        vert: -1
	      };
	    }

	    var GL_RGBA$3 = 6408;
	    var GL_UNSIGNED_BYTE$7 = 5121;
	    var GL_PACK_ALIGNMENT = 0x0D05;
	    var GL_FLOAT$7 = 0x1406;

	    function wrapReadPixels(gl, framebufferState, reglPoll, context, glAttributes, extensions, limits) {
	      function readPixelsImpl(input) {
	        var type;

	        if (framebufferState.next === null) {
	          check$1(glAttributes.preserveDrawingBuffer, 'you must create a webgl context with "preserveDrawingBuffer":true in order to read pixels from the drawing buffer');
	          type = GL_UNSIGNED_BYTE$7;
	        } else {
	          check$1(framebufferState.next.colorAttachments[0].texture !== null, 'You cannot read from a renderbuffer');
	          type = framebufferState.next.colorAttachments[0].texture._texture.type;

	          if (extensions.oes_texture_float) {
	            check$1(type === GL_UNSIGNED_BYTE$7 || type === GL_FLOAT$7, 'Reading from a framebuffer is only allowed for the types \'uint8\' and \'float\'');

	            if (type === GL_FLOAT$7) {
	              check$1(limits.readFloat, 'Reading \'float\' values is not permitted in your browser. For a fallback, please see: https://www.npmjs.com/package/glsl-read-float');
	            }
	          } else {
	            check$1(type === GL_UNSIGNED_BYTE$7, 'Reading from a framebuffer is only allowed for the type \'uint8\'');
	          }
	        }

	        var x = 0;
	        var y = 0;
	        var width = context.framebufferWidth;
	        var height = context.framebufferHeight;
	        var data = null;

	        if (isTypedArray(input)) {
	          data = input;
	        } else if (input) {
	          check$1.type(input, 'object', 'invalid arguments to regl.read()');
	          x = input.x | 0;
	          y = input.y | 0;
	          check$1(x >= 0 && x < context.framebufferWidth, 'invalid x offset for regl.read');
	          check$1(y >= 0 && y < context.framebufferHeight, 'invalid y offset for regl.read');
	          width = (input.width || context.framebufferWidth - x) | 0;
	          height = (input.height || context.framebufferHeight - y) | 0;
	          data = input.data || null;
	        }

	        if (data) {
	          if (type === GL_UNSIGNED_BYTE$7) {
	            check$1(data instanceof Uint8Array, 'buffer must be \'Uint8Array\' when reading from a framebuffer of type \'uint8\'');
	          } else if (type === GL_FLOAT$7) {
	            check$1(data instanceof Float32Array, 'buffer must be \'Float32Array\' when reading from a framebuffer of type \'float\'');
	          }
	        }

	        check$1(width > 0 && width + x <= context.framebufferWidth, 'invalid width for read pixels');
	        check$1(height > 0 && height + y <= context.framebufferHeight, 'invalid height for read pixels');
	        reglPoll();
	        var size = width * height * 4;

	        if (!data) {
	          if (type === GL_UNSIGNED_BYTE$7) {
	            data = new Uint8Array(size);
	          } else if (type === GL_FLOAT$7) {
	            data = data || new Float32Array(size);
	          }
	        }

	        check$1.isTypedArray(data, 'data buffer for regl.read() must be a typedarray');
	        check$1(data.byteLength >= size, 'data buffer for regl.read() too small');
	        gl.pixelStorei(GL_PACK_ALIGNMENT, 4);
	        gl.readPixels(x, y, width, height, GL_RGBA$3, type, data);
	        return data;
	      }

	      function readPixelsFBO(options) {
	        var result;
	        framebufferState.setFBO({
	          framebuffer: options.framebuffer
	        }, function () {
	          result = readPixelsImpl(options);
	        });
	        return result;
	      }

	      function readPixels(options) {
	        if (!options || !('framebuffer' in options)) {
	          return readPixelsImpl(options);
	        } else {
	          return readPixelsFBO(options);
	        }
	      }

	      return readPixels;
	    }

	    function slice(x) {
	      return Array.prototype.slice.call(x);
	    }

	    function join(x) {
	      return slice(x).join('');
	    }

	    function createEnvironment() {
	      var varCounter = 0;
	      var linkedNames = [];
	      var linkedValues = [];

	      function link(value) {
	        for (var i = 0; i < linkedValues.length; ++i) {
	          if (linkedValues[i] === value) {
	            return linkedNames[i];
	          }
	        }

	        var name = 'g' + varCounter++;
	        linkedNames.push(name);
	        linkedValues.push(value);
	        return name;
	      }

	      function block() {
	        var code = [];

	        function push() {
	          code.push.apply(code, slice(arguments));
	        }

	        var vars = [];

	        function def() {
	          var name = 'v' + varCounter++;
	          vars.push(name);

	          if (arguments.length > 0) {
	            code.push(name, '=');
	            code.push.apply(code, slice(arguments));
	            code.push(';');
	          }

	          return name;
	        }

	        return extend(push, {
	          def: def,
	          toString: function toString() {
	            return join([vars.length > 0 ? 'var ' + vars + ';' : '', join(code)]);
	          }
	        });
	      }

	      function scope() {
	        var entry = block();
	        var exit = block();
	        var entryToString = entry.toString;
	        var exitToString = exit.toString;

	        function save(object, prop) {
	          exit(object, prop, '=', entry.def(object, prop), ';');
	        }

	        return extend(function () {
	          entry.apply(entry, slice(arguments));
	        }, {
	          def: entry.def,
	          entry: entry,
	          exit: exit,
	          save: save,
	          set: function set(object, prop, value) {
	            save(object, prop);
	            entry(object, prop, '=', value, ';');
	          },
	          toString: function toString() {
	            return entryToString() + exitToString();
	          }
	        });
	      }

	      function conditional() {
	        var pred = join(arguments);
	        var thenBlock = scope();
	        var elseBlock = scope();
	        var thenToString = thenBlock.toString;
	        var elseToString = elseBlock.toString;
	        return extend(thenBlock, {
	          then: function then() {
	            thenBlock.apply(thenBlock, slice(arguments));
	            return this;
	          },
	          else: function _else() {
	            elseBlock.apply(elseBlock, slice(arguments));
	            return this;
	          },
	          toString: function toString() {
	            var elseClause = elseToString();

	            if (elseClause) {
	              elseClause = 'else{' + elseClause + '}';
	            }

	            return join(['if(', pred, '){', thenToString(), '}', elseClause]);
	          }
	        });
	      }

	      var globalBlock = block();
	      var procedures = {};

	      function proc(name, count) {
	        var args = [];

	        function arg() {
	          var name = 'a' + args.length;
	          args.push(name);
	          return name;
	        }

	        count = count || 0;

	        for (var i = 0; i < count; ++i) {
	          arg();
	        }

	        var body = scope();
	        var bodyToString = body.toString;
	        var result = procedures[name] = extend(body, {
	          arg: arg,
	          toString: function toString() {
	            return join(['function(', args.join(), '){', bodyToString(), '}']);
	          }
	        });
	        return result;
	      }

	      function compile() {
	        var code = ['"use strict";', globalBlock, 'return {'];
	        Object.keys(procedures).forEach(function (name) {
	          code.push('"', name, '":', procedures[name].toString(), ',');
	        });
	        code.push('}');
	        var src = join(code).replace(/;/g, ';\n').replace(/}/g, '}\n').replace(/{/g, '{\n');
	        var proc = Function.apply(null, linkedNames.concat(src));
	        return proc.apply(null, linkedValues);
	      }

	      return {
	        global: globalBlock,
	        link: link,
	        block: block,
	        proc: proc,
	        scope: scope,
	        cond: conditional,
	        compile: compile
	      };
	    }

	    var CUTE_COMPONENTS = 'xyzw'.split('');
	    var GL_UNSIGNED_BYTE$8 = 5121;
	    var ATTRIB_STATE_POINTER = 1;
	    var ATTRIB_STATE_CONSTANT = 2;
	    var DYN_FUNC$1 = 0;
	    var DYN_PROP$1 = 1;
	    var DYN_CONTEXT$1 = 2;
	    var DYN_STATE$1 = 3;
	    var DYN_THUNK = 4;
	    var S_DITHER = 'dither';
	    var S_BLEND_ENABLE = 'blend.enable';
	    var S_BLEND_COLOR = 'blend.color';
	    var S_BLEND_EQUATION = 'blend.equation';
	    var S_BLEND_FUNC = 'blend.func';
	    var S_DEPTH_ENABLE = 'depth.enable';
	    var S_DEPTH_FUNC = 'depth.func';
	    var S_DEPTH_RANGE = 'depth.range';
	    var S_DEPTH_MASK = 'depth.mask';
	    var S_COLOR_MASK = 'colorMask';
	    var S_CULL_ENABLE = 'cull.enable';
	    var S_CULL_FACE = 'cull.face';
	    var S_FRONT_FACE = 'frontFace';
	    var S_LINE_WIDTH = 'lineWidth';
	    var S_POLYGON_OFFSET_ENABLE = 'polygonOffset.enable';
	    var S_POLYGON_OFFSET_OFFSET = 'polygonOffset.offset';
	    var S_SAMPLE_ALPHA = 'sample.alpha';
	    var S_SAMPLE_ENABLE = 'sample.enable';
	    var S_SAMPLE_COVERAGE = 'sample.coverage';
	    var S_STENCIL_ENABLE = 'stencil.enable';
	    var S_STENCIL_MASK = 'stencil.mask';
	    var S_STENCIL_FUNC = 'stencil.func';
	    var S_STENCIL_OPFRONT = 'stencil.opFront';
	    var S_STENCIL_OPBACK = 'stencil.opBack';
	    var S_SCISSOR_ENABLE = 'scissor.enable';
	    var S_SCISSOR_BOX = 'scissor.box';
	    var S_VIEWPORT = 'viewport';
	    var S_PROFILE = 'profile';
	    var S_FRAMEBUFFER = 'framebuffer';
	    var S_VERT = 'vert';
	    var S_FRAG = 'frag';
	    var S_ELEMENTS = 'elements';
	    var S_PRIMITIVE = 'primitive';
	    var S_COUNT = 'count';
	    var S_OFFSET = 'offset';
	    var S_INSTANCES = 'instances';
	    var SUFFIX_WIDTH = 'Width';
	    var SUFFIX_HEIGHT = 'Height';
	    var S_FRAMEBUFFER_WIDTH = S_FRAMEBUFFER + SUFFIX_WIDTH;
	    var S_FRAMEBUFFER_HEIGHT = S_FRAMEBUFFER + SUFFIX_HEIGHT;
	    var S_VIEWPORT_WIDTH = S_VIEWPORT + SUFFIX_WIDTH;
	    var S_VIEWPORT_HEIGHT = S_VIEWPORT + SUFFIX_HEIGHT;
	    var S_DRAWINGBUFFER = 'drawingBuffer';
	    var S_DRAWINGBUFFER_WIDTH = S_DRAWINGBUFFER + SUFFIX_WIDTH;
	    var S_DRAWINGBUFFER_HEIGHT = S_DRAWINGBUFFER + SUFFIX_HEIGHT;
	    var NESTED_OPTIONS = [S_BLEND_FUNC, S_BLEND_EQUATION, S_STENCIL_FUNC, S_STENCIL_OPFRONT, S_STENCIL_OPBACK, S_SAMPLE_COVERAGE, S_VIEWPORT, S_SCISSOR_BOX, S_POLYGON_OFFSET_OFFSET];
	    var GL_ARRAY_BUFFER$1 = 34962;
	    var GL_ELEMENT_ARRAY_BUFFER$1 = 34963;
	    var GL_FRAGMENT_SHADER$1 = 35632;
	    var GL_VERTEX_SHADER$1 = 35633;
	    var GL_TEXTURE_2D$3 = 0x0DE1;
	    var GL_TEXTURE_CUBE_MAP$2 = 0x8513;
	    var GL_CULL_FACE = 0x0B44;
	    var GL_BLEND = 0x0BE2;
	    var GL_DITHER = 0x0BD0;
	    var GL_STENCIL_TEST = 0x0B90;
	    var GL_DEPTH_TEST = 0x0B71;
	    var GL_SCISSOR_TEST = 0x0C11;
	    var GL_POLYGON_OFFSET_FILL = 0x8037;
	    var GL_SAMPLE_ALPHA_TO_COVERAGE = 0x809E;
	    var GL_SAMPLE_COVERAGE = 0x80A0;
	    var GL_FLOAT$8 = 5126;
	    var GL_FLOAT_VEC2 = 35664;
	    var GL_FLOAT_VEC3 = 35665;
	    var GL_FLOAT_VEC4 = 35666;
	    var GL_INT$3 = 5124;
	    var GL_INT_VEC2 = 35667;
	    var GL_INT_VEC3 = 35668;
	    var GL_INT_VEC4 = 35669;
	    var GL_BOOL = 35670;
	    var GL_BOOL_VEC2 = 35671;
	    var GL_BOOL_VEC3 = 35672;
	    var GL_BOOL_VEC4 = 35673;
	    var GL_FLOAT_MAT2 = 35674;
	    var GL_FLOAT_MAT3 = 35675;
	    var GL_FLOAT_MAT4 = 35676;
	    var GL_SAMPLER_2D = 35678;
	    var GL_SAMPLER_CUBE = 35680;
	    var GL_TRIANGLES$1 = 4;
	    var GL_FRONT = 1028;
	    var GL_BACK = 1029;
	    var GL_CW = 0x0900;
	    var GL_CCW = 0x0901;
	    var GL_MIN_EXT = 0x8007;
	    var GL_MAX_EXT = 0x8008;
	    var GL_ALWAYS = 519;
	    var GL_KEEP = 7680;
	    var GL_ZERO = 0;
	    var GL_ONE = 1;
	    var GL_FUNC_ADD = 0x8006;
	    var GL_LESS = 513;
	    var GL_FRAMEBUFFER$2 = 0x8D40;
	    var GL_COLOR_ATTACHMENT0$2 = 0x8CE0;
	    var blendFuncs = {
	      '0': 0,
	      '1': 1,
	      'zero': 0,
	      'one': 1,
	      'src color': 768,
	      'one minus src color': 769,
	      'src alpha': 770,
	      'one minus src alpha': 771,
	      'dst color': 774,
	      'one minus dst color': 775,
	      'dst alpha': 772,
	      'one minus dst alpha': 773,
	      'constant color': 32769,
	      'one minus constant color': 32770,
	      'constant alpha': 32771,
	      'one minus constant alpha': 32772,
	      'src alpha saturate': 776
	    };
	    var invalidBlendCombinations = ['constant color, constant alpha', 'one minus constant color, constant alpha', 'constant color, one minus constant alpha', 'one minus constant color, one minus constant alpha', 'constant alpha, constant color', 'constant alpha, one minus constant color', 'one minus constant alpha, constant color', 'one minus constant alpha, one minus constant color'];
	    var compareFuncs = {
	      'never': 512,
	      'less': 513,
	      '<': 513,
	      'equal': 514,
	      '=': 514,
	      '==': 514,
	      '===': 514,
	      'lequal': 515,
	      '<=': 515,
	      'greater': 516,
	      '>': 516,
	      'notequal': 517,
	      '!=': 517,
	      '!==': 517,
	      'gequal': 518,
	      '>=': 518,
	      'always': 519
	    };
	    var stencilOps = {
	      '0': 0,
	      'zero': 0,
	      'keep': 7680,
	      'replace': 7681,
	      'increment': 7682,
	      'decrement': 7683,
	      'increment wrap': 34055,
	      'decrement wrap': 34056,
	      'invert': 5386
	    };
	    var shaderType = {
	      'frag': GL_FRAGMENT_SHADER$1,
	      'vert': GL_VERTEX_SHADER$1
	    };
	    var orientationType = {
	      'cw': GL_CW,
	      'ccw': GL_CCW
	    };

	    function isBufferArgs(x) {
	      return Array.isArray(x) || isTypedArray(x) || isNDArrayLike(x);
	    }

	    function sortState(state) {
	      return state.sort(function (a, b) {
	        if (a === S_VIEWPORT) {
	          return -1;
	        } else if (b === S_VIEWPORT) {
	          return 1;
	        }

	        return a < b ? -1 : 1;
	      });
	    }

	    function Declaration(thisDep, contextDep, propDep, append) {
	      this.thisDep = thisDep;
	      this.contextDep = contextDep;
	      this.propDep = propDep;
	      this.append = append;
	    }

	    function isStatic(decl) {
	      return decl && !(decl.thisDep || decl.contextDep || decl.propDep);
	    }

	    function createStaticDecl(append) {
	      return new Declaration(false, false, false, append);
	    }

	    function createDynamicDecl(dyn, append) {
	      var type = dyn.type;

	      if (type === DYN_FUNC$1) {
	        var numArgs = dyn.data.length;
	        return new Declaration(true, numArgs >= 1, numArgs >= 2, append);
	      } else if (type === DYN_THUNK) {
	        var data = dyn.data;
	        return new Declaration(data.thisDep, data.contextDep, data.propDep, append);
	      } else {
	        return new Declaration(type === DYN_STATE$1, type === DYN_CONTEXT$1, type === DYN_PROP$1, append);
	      }
	    }

	    var SCOPE_DECL = new Declaration(false, false, false, function () {});

	    function reglCore(gl, stringStore, extensions, limits, bufferState, elementState, textureState, framebufferState, uniformState, attributeState, shaderState, drawState, contextState, timer, config) {
	      var AttributeRecord = attributeState.Record;
	      var blendEquations = {
	        'add': 32774,
	        'subtract': 32778,
	        'reverse subtract': 32779
	      };

	      if (extensions.ext_blend_minmax) {
	        blendEquations.min = GL_MIN_EXT;
	        blendEquations.max = GL_MAX_EXT;
	      }

	      var extInstancing = extensions.angle_instanced_arrays;
	      var extDrawBuffers = extensions.webgl_draw_buffers;
	      var currentState = {
	        dirty: true,
	        profile: config.profile
	      };
	      var nextState = {};
	      var GL_STATE_NAMES = [];
	      var GL_FLAGS = {};
	      var GL_VARIABLES = {};

	      function propName(name) {
	        return name.replace('.', '_');
	      }

	      function stateFlag(sname, cap, init) {
	        var name = propName(sname);
	        GL_STATE_NAMES.push(sname);
	        nextState[name] = currentState[name] = !!init;
	        GL_FLAGS[name] = cap;
	      }

	      function stateVariable(sname, func, init) {
	        var name = propName(sname);
	        GL_STATE_NAMES.push(sname);

	        if (Array.isArray(init)) {
	          currentState[name] = init.slice();
	          nextState[name] = init.slice();
	        } else {
	          currentState[name] = nextState[name] = init;
	        }

	        GL_VARIABLES[name] = func;
	      }

	      stateFlag(S_DITHER, GL_DITHER);
	      stateFlag(S_BLEND_ENABLE, GL_BLEND);
	      stateVariable(S_BLEND_COLOR, 'blendColor', [0, 0, 0, 0]);
	      stateVariable(S_BLEND_EQUATION, 'blendEquationSeparate', [GL_FUNC_ADD, GL_FUNC_ADD]);
	      stateVariable(S_BLEND_FUNC, 'blendFuncSeparate', [GL_ONE, GL_ZERO, GL_ONE, GL_ZERO]);
	      stateFlag(S_DEPTH_ENABLE, GL_DEPTH_TEST, true);
	      stateVariable(S_DEPTH_FUNC, 'depthFunc', GL_LESS);
	      stateVariable(S_DEPTH_RANGE, 'depthRange', [0, 1]);
	      stateVariable(S_DEPTH_MASK, 'depthMask', true);
	      stateVariable(S_COLOR_MASK, S_COLOR_MASK, [true, true, true, true]);
	      stateFlag(S_CULL_ENABLE, GL_CULL_FACE);
	      stateVariable(S_CULL_FACE, 'cullFace', GL_BACK);
	      stateVariable(S_FRONT_FACE, S_FRONT_FACE, GL_CCW);
	      stateVariable(S_LINE_WIDTH, S_LINE_WIDTH, 1);
	      stateFlag(S_POLYGON_OFFSET_ENABLE, GL_POLYGON_OFFSET_FILL);
	      stateVariable(S_POLYGON_OFFSET_OFFSET, 'polygonOffset', [0, 0]);
	      stateFlag(S_SAMPLE_ALPHA, GL_SAMPLE_ALPHA_TO_COVERAGE);
	      stateFlag(S_SAMPLE_ENABLE, GL_SAMPLE_COVERAGE);
	      stateVariable(S_SAMPLE_COVERAGE, 'sampleCoverage', [1, false]);
	      stateFlag(S_STENCIL_ENABLE, GL_STENCIL_TEST);
	      stateVariable(S_STENCIL_MASK, 'stencilMask', -1);
	      stateVariable(S_STENCIL_FUNC, 'stencilFunc', [GL_ALWAYS, 0, -1]);
	      stateVariable(S_STENCIL_OPFRONT, 'stencilOpSeparate', [GL_FRONT, GL_KEEP, GL_KEEP, GL_KEEP]);
	      stateVariable(S_STENCIL_OPBACK, 'stencilOpSeparate', [GL_BACK, GL_KEEP, GL_KEEP, GL_KEEP]);
	      stateFlag(S_SCISSOR_ENABLE, GL_SCISSOR_TEST);
	      stateVariable(S_SCISSOR_BOX, 'scissor', [0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight]);
	      stateVariable(S_VIEWPORT, S_VIEWPORT, [0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight]);
	      var sharedState = {
	        gl: gl,
	        context: contextState,
	        strings: stringStore,
	        next: nextState,
	        current: currentState,
	        draw: drawState,
	        elements: elementState,
	        buffer: bufferState,
	        shader: shaderState,
	        attributes: attributeState.state,
	        uniforms: uniformState,
	        framebuffer: framebufferState,
	        extensions: extensions,
	        timer: timer,
	        isBufferArgs: isBufferArgs
	      };
	      var sharedConstants = {
	        primTypes: primTypes,
	        compareFuncs: compareFuncs,
	        blendFuncs: blendFuncs,
	        blendEquations: blendEquations,
	        stencilOps: stencilOps,
	        glTypes: glTypes,
	        orientationType: orientationType
	      };
	      check$1.optional(function () {
	        sharedState.isArrayLike = isArrayLike;
	      });

	      if (extDrawBuffers) {
	        sharedConstants.backBuffer = [GL_BACK];
	        sharedConstants.drawBuffer = loop(limits.maxDrawbuffers, function (i) {
	          if (i === 0) {
	            return [0];
	          }

	          return loop(i, function (j) {
	            return GL_COLOR_ATTACHMENT0$2 + j;
	          });
	        });
	      }

	      var drawCallCounter = 0;

	      function createREGLEnvironment() {
	        var env = createEnvironment();
	        var link = env.link;
	        var global = env.global;
	        env.id = drawCallCounter++;
	        env.batchId = '0';
	        var SHARED = link(sharedState);
	        var shared = env.shared = {
	          props: 'a0'
	        };
	        Object.keys(sharedState).forEach(function (prop) {
	          shared[prop] = global.def(SHARED, '.', prop);
	        });
	        check$1.optional(function () {
	          env.CHECK = link(check$1);
	          env.commandStr = check$1.guessCommand();
	          env.command = link(env.commandStr);

	          env.assert = function (block, pred, message) {
	            block('if(!(', pred, '))', this.CHECK, '.commandRaise(', link(message), ',', this.command, ');');
	          };

	          sharedConstants.invalidBlendCombinations = invalidBlendCombinations;
	        });
	        var nextVars = env.next = {};
	        var currentVars = env.current = {};
	        Object.keys(GL_VARIABLES).forEach(function (variable) {
	          if (Array.isArray(currentState[variable])) {
	            nextVars[variable] = global.def(shared.next, '.', variable);
	            currentVars[variable] = global.def(shared.current, '.', variable);
	          }
	        });
	        var constants = env.constants = {};
	        Object.keys(sharedConstants).forEach(function (name) {
	          constants[name] = global.def(JSON.stringify(sharedConstants[name]));
	        });

	        env.invoke = function (block, x) {
	          switch (x.type) {
	            case DYN_FUNC$1:
	              var argList = ['this', shared.context, shared.props, env.batchId];
	              return block.def(link(x.data), '.call(', argList.slice(0, Math.max(x.data.length + 1, 4)), ')');

	            case DYN_PROP$1:
	              return block.def(shared.props, x.data);

	            case DYN_CONTEXT$1:
	              return block.def(shared.context, x.data);

	            case DYN_STATE$1:
	              return block.def('this', x.data);

	            case DYN_THUNK:
	              x.data.append(env, block);
	              return x.data.ref;
	          }
	        };

	        env.attribCache = {};
	        var scopeAttribs = {};

	        env.scopeAttrib = function (name) {
	          var id = stringStore.id(name);

	          if (id in scopeAttribs) {
	            return scopeAttribs[id];
	          }

	          var binding = attributeState.scope[id];

	          if (!binding) {
	            binding = attributeState.scope[id] = new AttributeRecord();
	          }

	          var result = scopeAttribs[id] = link(binding);
	          return result;
	        };

	        return env;
	      }

	      function parseProfile(options) {
	        var staticOptions = options.static;
	        var dynamicOptions = options.dynamic;
	        var profileEnable;

	        if (S_PROFILE in staticOptions) {
	          var value = !!staticOptions[S_PROFILE];
	          profileEnable = createStaticDecl(function (env, scope) {
	            return value;
	          });
	          profileEnable.enable = value;
	        } else if (S_PROFILE in dynamicOptions) {
	          var dyn = dynamicOptions[S_PROFILE];
	          profileEnable = createDynamicDecl(dyn, function (env, scope) {
	            return env.invoke(scope, dyn);
	          });
	        }

	        return profileEnable;
	      }

	      function parseFramebuffer(options, env) {
	        var staticOptions = options.static;
	        var dynamicOptions = options.dynamic;

	        if (S_FRAMEBUFFER in staticOptions) {
	          var framebuffer = staticOptions[S_FRAMEBUFFER];

	          if (framebuffer) {
	            framebuffer = framebufferState.getFramebuffer(framebuffer);
	            check$1.command(framebuffer, 'invalid framebuffer object');
	            return createStaticDecl(function (env, block) {
	              var FRAMEBUFFER = env.link(framebuffer);
	              var shared = env.shared;
	              block.set(shared.framebuffer, '.next', FRAMEBUFFER);
	              var CONTEXT = shared.context;
	              block.set(CONTEXT, '.' + S_FRAMEBUFFER_WIDTH, FRAMEBUFFER + '.width');
	              block.set(CONTEXT, '.' + S_FRAMEBUFFER_HEIGHT, FRAMEBUFFER + '.height');
	              return FRAMEBUFFER;
	            });
	          } else {
	            return createStaticDecl(function (env, scope) {
	              var shared = env.shared;
	              scope.set(shared.framebuffer, '.next', 'null');
	              var CONTEXT = shared.context;
	              scope.set(CONTEXT, '.' + S_FRAMEBUFFER_WIDTH, CONTEXT + '.' + S_DRAWINGBUFFER_WIDTH);
	              scope.set(CONTEXT, '.' + S_FRAMEBUFFER_HEIGHT, CONTEXT + '.' + S_DRAWINGBUFFER_HEIGHT);
	              return 'null';
	            });
	          }
	        } else if (S_FRAMEBUFFER in dynamicOptions) {
	          var dyn = dynamicOptions[S_FRAMEBUFFER];
	          return createDynamicDecl(dyn, function (env, scope) {
	            var FRAMEBUFFER_FUNC = env.invoke(scope, dyn);
	            var shared = env.shared;
	            var FRAMEBUFFER_STATE = shared.framebuffer;
	            var FRAMEBUFFER = scope.def(FRAMEBUFFER_STATE, '.getFramebuffer(', FRAMEBUFFER_FUNC, ')');
	            check$1.optional(function () {
	              env.assert(scope, '!' + FRAMEBUFFER_FUNC + '||' + FRAMEBUFFER, 'invalid framebuffer object');
	            });
	            scope.set(FRAMEBUFFER_STATE, '.next', FRAMEBUFFER);
	            var CONTEXT = shared.context;
	            scope.set(CONTEXT, '.' + S_FRAMEBUFFER_WIDTH, FRAMEBUFFER + '?' + FRAMEBUFFER + '.width:' + CONTEXT + '.' + S_DRAWINGBUFFER_WIDTH);
	            scope.set(CONTEXT, '.' + S_FRAMEBUFFER_HEIGHT, FRAMEBUFFER + '?' + FRAMEBUFFER + '.height:' + CONTEXT + '.' + S_DRAWINGBUFFER_HEIGHT);
	            return FRAMEBUFFER;
	          });
	        } else {
	          return null;
	        }
	      }

	      function parseViewportScissor(options, framebuffer, env) {
	        var staticOptions = options.static;
	        var dynamicOptions = options.dynamic;

	        function parseBox(param) {
	          if (param in staticOptions) {
	            var box = staticOptions[param];
	            check$1.commandType(box, 'object', 'invalid ' + param, env.commandStr);
	            var isStatic = true;
	            var x = box.x | 0;
	            var y = box.y | 0;
	            var w, h;

	            if ('width' in box) {
	              w = box.width | 0;
	              check$1.command(w >= 0, 'invalid ' + param, env.commandStr);
	            } else {
	              isStatic = false;
	            }

	            if ('height' in box) {
	              h = box.height | 0;
	              check$1.command(h >= 0, 'invalid ' + param, env.commandStr);
	            } else {
	              isStatic = false;
	            }

	            return new Declaration(!isStatic && framebuffer && framebuffer.thisDep, !isStatic && framebuffer && framebuffer.contextDep, !isStatic && framebuffer && framebuffer.propDep, function (env, scope) {
	              var CONTEXT = env.shared.context;
	              var BOX_W = w;

	              if (!('width' in box)) {
	                BOX_W = scope.def(CONTEXT, '.', S_FRAMEBUFFER_WIDTH, '-', x);
	              }

	              var BOX_H = h;

	              if (!('height' in box)) {
	                BOX_H = scope.def(CONTEXT, '.', S_FRAMEBUFFER_HEIGHT, '-', y);
	              }

	              return [x, y, BOX_W, BOX_H];
	            });
	          } else if (param in dynamicOptions) {
	            var dynBox = dynamicOptions[param];
	            var result = createDynamicDecl(dynBox, function (env, scope) {
	              var BOX = env.invoke(scope, dynBox);
	              check$1.optional(function () {
	                env.assert(scope, BOX + '&&typeof ' + BOX + '==="object"', 'invalid ' + param);
	              });
	              var CONTEXT = env.shared.context;
	              var BOX_X = scope.def(BOX, '.x|0');
	              var BOX_Y = scope.def(BOX, '.y|0');
	              var BOX_W = scope.def('"width" in ', BOX, '?', BOX, '.width|0:', '(', CONTEXT, '.', S_FRAMEBUFFER_WIDTH, '-', BOX_X, ')');
	              var BOX_H = scope.def('"height" in ', BOX, '?', BOX, '.height|0:', '(', CONTEXT, '.', S_FRAMEBUFFER_HEIGHT, '-', BOX_Y, ')');
	              check$1.optional(function () {
	                env.assert(scope, BOX_W + '>=0&&' + BOX_H + '>=0', 'invalid ' + param);
	              });
	              return [BOX_X, BOX_Y, BOX_W, BOX_H];
	            });

	            if (framebuffer) {
	              result.thisDep = result.thisDep || framebuffer.thisDep;
	              result.contextDep = result.contextDep || framebuffer.contextDep;
	              result.propDep = result.propDep || framebuffer.propDep;
	            }

	            return result;
	          } else if (framebuffer) {
	            return new Declaration(framebuffer.thisDep, framebuffer.contextDep, framebuffer.propDep, function (env, scope) {
	              var CONTEXT = env.shared.context;
	              return [0, 0, scope.def(CONTEXT, '.', S_FRAMEBUFFER_WIDTH), scope.def(CONTEXT, '.', S_FRAMEBUFFER_HEIGHT)];
	            });
	          } else {
	            return null;
	          }
	        }

	        var viewport = parseBox(S_VIEWPORT);

	        if (viewport) {
	          var prevViewport = viewport;
	          viewport = new Declaration(viewport.thisDep, viewport.contextDep, viewport.propDep, function (env, scope) {
	            var VIEWPORT = prevViewport.append(env, scope);
	            var CONTEXT = env.shared.context;
	            scope.set(CONTEXT, '.' + S_VIEWPORT_WIDTH, VIEWPORT[2]);
	            scope.set(CONTEXT, '.' + S_VIEWPORT_HEIGHT, VIEWPORT[3]);
	            return VIEWPORT;
	          });
	        }

	        return {
	          viewport: viewport,
	          scissor_box: parseBox(S_SCISSOR_BOX)
	        };
	      }

	      function parseProgram(options) {
	        var staticOptions = options.static;
	        var dynamicOptions = options.dynamic;

	        function parseShader(name) {
	          if (name in staticOptions) {
	            var id = stringStore.id(staticOptions[name]);
	            check$1.optional(function () {
	              shaderState.shader(shaderType[name], id, check$1.guessCommand());
	            });
	            var result = createStaticDecl(function () {
	              return id;
	            });
	            result.id = id;
	            return result;
	          } else if (name in dynamicOptions) {
	            var dyn = dynamicOptions[name];
	            return createDynamicDecl(dyn, function (env, scope) {
	              var str = env.invoke(scope, dyn);
	              var id = scope.def(env.shared.strings, '.id(', str, ')');
	              check$1.optional(function () {
	                scope(env.shared.shader, '.shader(', shaderType[name], ',', id, ',', env.command, ');');
	              });
	              return id;
	            });
	          }

	          return null;
	        }

	        var frag = parseShader(S_FRAG);
	        var vert = parseShader(S_VERT);
	        var program = null;
	        var progVar;

	        if (isStatic(frag) && isStatic(vert)) {
	          program = shaderState.program(vert.id, frag.id);
	          progVar = createStaticDecl(function (env, scope) {
	            return env.link(program);
	          });
	        } else {
	          progVar = new Declaration(frag && frag.thisDep || vert && vert.thisDep, frag && frag.contextDep || vert && vert.contextDep, frag && frag.propDep || vert && vert.propDep, function (env, scope) {
	            var SHADER_STATE = env.shared.shader;
	            var fragId;

	            if (frag) {
	              fragId = frag.append(env, scope);
	            } else {
	              fragId = scope.def(SHADER_STATE, '.', S_FRAG);
	            }

	            var vertId;

	            if (vert) {
	              vertId = vert.append(env, scope);
	            } else {
	              vertId = scope.def(SHADER_STATE, '.', S_VERT);
	            }

	            var progDef = SHADER_STATE + '.program(' + vertId + ',' + fragId;
	            check$1.optional(function () {
	              progDef += ',' + env.command;
	            });
	            return scope.def(progDef + ')');
	          });
	        }

	        return {
	          frag: frag,
	          vert: vert,
	          progVar: progVar,
	          program: program
	        };
	      }

	      function parseDraw(options, env) {
	        var staticOptions = options.static;
	        var dynamicOptions = options.dynamic;

	        function parseElements() {
	          if (S_ELEMENTS in staticOptions) {
	            var elements = staticOptions[S_ELEMENTS];

	            if (isBufferArgs(elements)) {
	              elements = elementState.getElements(elementState.create(elements, true));
	            } else if (elements) {
	              elements = elementState.getElements(elements);
	              check$1.command(elements, 'invalid elements', env.commandStr);
	            }

	            var result = createStaticDecl(function (env, scope) {
	              if (elements) {
	                var result = env.link(elements);
	                env.ELEMENTS = result;
	                return result;
	              }

	              env.ELEMENTS = null;
	              return null;
	            });
	            result.value = elements;
	            return result;
	          } else if (S_ELEMENTS in dynamicOptions) {
	            var dyn = dynamicOptions[S_ELEMENTS];
	            return createDynamicDecl(dyn, function (env, scope) {
	              var shared = env.shared;
	              var IS_BUFFER_ARGS = shared.isBufferArgs;
	              var ELEMENT_STATE = shared.elements;
	              var elementDefn = env.invoke(scope, dyn);
	              var elements = scope.def('null');
	              var elementStream = scope.def(IS_BUFFER_ARGS, '(', elementDefn, ')');
	              var ifte = env.cond(elementStream).then(elements, '=', ELEMENT_STATE, '.createStream(', elementDefn, ');').else(elements, '=', ELEMENT_STATE, '.getElements(', elementDefn, ');');
	              check$1.optional(function () {
	                env.assert(ifte.else, '!' + elementDefn + '||' + elements, 'invalid elements');
	              });
	              scope.entry(ifte);
	              scope.exit(env.cond(elementStream).then(ELEMENT_STATE, '.destroyStream(', elements, ');'));
	              env.ELEMENTS = elements;
	              return elements;
	            });
	          }

	          return null;
	        }

	        var elements = parseElements();

	        function parsePrimitive() {
	          if (S_PRIMITIVE in staticOptions) {
	            var primitive = staticOptions[S_PRIMITIVE];
	            check$1.commandParameter(primitive, primTypes, 'invalid primitve', env.commandStr);
	            return createStaticDecl(function (env, scope) {
	              return primTypes[primitive];
	            });
	          } else if (S_PRIMITIVE in dynamicOptions) {
	            var dynPrimitive = dynamicOptions[S_PRIMITIVE];
	            return createDynamicDecl(dynPrimitive, function (env, scope) {
	              var PRIM_TYPES = env.constants.primTypes;
	              var prim = env.invoke(scope, dynPrimitive);
	              check$1.optional(function () {
	                env.assert(scope, prim + ' in ' + PRIM_TYPES, 'invalid primitive, must be one of ' + Object.keys(primTypes));
	              });
	              return scope.def(PRIM_TYPES, '[', prim, ']');
	            });
	          } else if (elements) {
	            if (isStatic(elements)) {
	              if (elements.value) {
	                return createStaticDecl(function (env, scope) {
	                  return scope.def(env.ELEMENTS, '.primType');
	                });
	              } else {
	                return createStaticDecl(function () {
	                  return GL_TRIANGLES$1;
	                });
	              }
	            } else {
	              return new Declaration(elements.thisDep, elements.contextDep, elements.propDep, function (env, scope) {
	                var elements = env.ELEMENTS;
	                return scope.def(elements, '?', elements, '.primType:', GL_TRIANGLES$1);
	              });
	            }
	          }

	          return null;
	        }

	        function parseParam(param, isOffset) {
	          if (param in staticOptions) {
	            var value = staticOptions[param] | 0;
	            check$1.command(!isOffset || value >= 0, 'invalid ' + param, env.commandStr);
	            return createStaticDecl(function (env, scope) {
	              if (isOffset) {
	                env.OFFSET = value;
	              }

	              return value;
	            });
	          } else if (param in dynamicOptions) {
	            var dynValue = dynamicOptions[param];
	            return createDynamicDecl(dynValue, function (env, scope) {
	              var result = env.invoke(scope, dynValue);

	              if (isOffset) {
	                env.OFFSET = result;
	                check$1.optional(function () {
	                  env.assert(scope, result + '>=0', 'invalid ' + param);
	                });
	              }

	              return result;
	            });
	          } else if (isOffset && elements) {
	            return createStaticDecl(function (env, scope) {
	              env.OFFSET = '0';
	              return 0;
	            });
	          }

	          return null;
	        }

	        var OFFSET = parseParam(S_OFFSET, true);

	        function parseVertCount() {
	          if (S_COUNT in staticOptions) {
	            var count = staticOptions[S_COUNT] | 0;
	            check$1.command(typeof count === 'number' && count >= 0, 'invalid vertex count', env.commandStr);
	            return createStaticDecl(function () {
	              return count;
	            });
	          } else if (S_COUNT in dynamicOptions) {
	            var dynCount = dynamicOptions[S_COUNT];
	            return createDynamicDecl(dynCount, function (env, scope) {
	              var result = env.invoke(scope, dynCount);
	              check$1.optional(function () {
	                env.assert(scope, 'typeof ' + result + '==="number"&&' + result + '>=0&&' + result + '===(' + result + '|0)', 'invalid vertex count');
	              });
	              return result;
	            });
	          } else if (elements) {
	            if (isStatic(elements)) {
	              if (elements) {
	                if (OFFSET) {
	                  return new Declaration(OFFSET.thisDep, OFFSET.contextDep, OFFSET.propDep, function (env, scope) {
	                    var result = scope.def(env.ELEMENTS, '.vertCount-', env.OFFSET);
	                    check$1.optional(function () {
	                      env.assert(scope, result + '>=0', 'invalid vertex offset/element buffer too small');
	                    });
	                    return result;
	                  });
	                } else {
	                  return createStaticDecl(function (env, scope) {
	                    return scope.def(env.ELEMENTS, '.vertCount');
	                  });
	                }
	              } else {
	                var result = createStaticDecl(function () {
	                  return -1;
	                });
	                check$1.optional(function () {
	                  result.MISSING = true;
	                });
	                return result;
	              }
	            } else {
	              var variable = new Declaration(elements.thisDep || OFFSET.thisDep, elements.contextDep || OFFSET.contextDep, elements.propDep || OFFSET.propDep, function (env, scope) {
	                var elements = env.ELEMENTS;

	                if (env.OFFSET) {
	                  return scope.def(elements, '?', elements, '.vertCount-', env.OFFSET, ':-1');
	                }

	                return scope.def(elements, '?', elements, '.vertCount:-1');
	              });
	              check$1.optional(function () {
	                variable.DYNAMIC = true;
	              });
	              return variable;
	            }
	          }

	          return null;
	        }

	        return {
	          elements: elements,
	          primitive: parsePrimitive(),
	          count: parseVertCount(),
	          instances: parseParam(S_INSTANCES, false),
	          offset: OFFSET
	        };
	      }

	      function parseGLState(options, env) {
	        var staticOptions = options.static;
	        var dynamicOptions = options.dynamic;
	        var STATE = {};
	        GL_STATE_NAMES.forEach(function (prop) {
	          var param = propName(prop);

	          function parseParam(parseStatic, parseDynamic) {
	            if (prop in staticOptions) {
	              var value = parseStatic(staticOptions[prop]);
	              STATE[param] = createStaticDecl(function () {
	                return value;
	              });
	            } else if (prop in dynamicOptions) {
	              var dyn = dynamicOptions[prop];
	              STATE[param] = createDynamicDecl(dyn, function (env, scope) {
	                return parseDynamic(env, scope, env.invoke(scope, dyn));
	              });
	            }
	          }

	          switch (prop) {
	            case S_CULL_ENABLE:
	            case S_BLEND_ENABLE:
	            case S_DITHER:
	            case S_STENCIL_ENABLE:
	            case S_DEPTH_ENABLE:
	            case S_SCISSOR_ENABLE:
	            case S_POLYGON_OFFSET_ENABLE:
	            case S_SAMPLE_ALPHA:
	            case S_SAMPLE_ENABLE:
	            case S_DEPTH_MASK:
	              return parseParam(function (value) {
	                check$1.commandType(value, 'boolean', prop, env.commandStr);
	                return value;
	              }, function (env, scope, value) {
	                check$1.optional(function () {
	                  env.assert(scope, 'typeof ' + value + '==="boolean"', 'invalid flag ' + prop, env.commandStr);
	                });
	                return value;
	              });

	            case S_DEPTH_FUNC:
	              return parseParam(function (value) {
	                check$1.commandParameter(value, compareFuncs, 'invalid ' + prop, env.commandStr);
	                return compareFuncs[value];
	              }, function (env, scope, value) {
	                var COMPARE_FUNCS = env.constants.compareFuncs;
	                check$1.optional(function () {
	                  env.assert(scope, value + ' in ' + COMPARE_FUNCS, 'invalid ' + prop + ', must be one of ' + Object.keys(compareFuncs));
	                });
	                return scope.def(COMPARE_FUNCS, '[', value, ']');
	              });

	            case S_DEPTH_RANGE:
	              return parseParam(function (value) {
	                check$1.command(isArrayLike(value) && value.length === 2 && typeof value[0] === 'number' && typeof value[1] === 'number' && value[0] <= value[1], 'depth range is 2d array', env.commandStr);
	                return value;
	              }, function (env, scope, value) {
	                check$1.optional(function () {
	                  env.assert(scope, env.shared.isArrayLike + '(' + value + ')&&' + value + '.length===2&&' + 'typeof ' + value + '[0]==="number"&&' + 'typeof ' + value + '[1]==="number"&&' + value + '[0]<=' + value + '[1]', 'depth range must be a 2d array');
	                });
	                var Z_NEAR = scope.def('+', value, '[0]');
	                var Z_FAR = scope.def('+', value, '[1]');
	                return [Z_NEAR, Z_FAR];
	              });

	            case S_BLEND_FUNC:
	              return parseParam(function (value) {
	                check$1.commandType(value, 'object', 'blend.func', env.commandStr);
	                var srcRGB = 'srcRGB' in value ? value.srcRGB : value.src;
	                var srcAlpha = 'srcAlpha' in value ? value.srcAlpha : value.src;
	                var dstRGB = 'dstRGB' in value ? value.dstRGB : value.dst;
	                var dstAlpha = 'dstAlpha' in value ? value.dstAlpha : value.dst;
	                check$1.commandParameter(srcRGB, blendFuncs, param + '.srcRGB', env.commandStr);
	                check$1.commandParameter(srcAlpha, blendFuncs, param + '.srcAlpha', env.commandStr);
	                check$1.commandParameter(dstRGB, blendFuncs, param + '.dstRGB', env.commandStr);
	                check$1.commandParameter(dstAlpha, blendFuncs, param + '.dstAlpha', env.commandStr);
	                check$1.command(invalidBlendCombinations.indexOf(srcRGB + ', ' + dstRGB) === -1, 'unallowed blending combination (srcRGB, dstRGB) = (' + srcRGB + ', ' + dstRGB + ')', env.commandStr);
	                return [blendFuncs[srcRGB], blendFuncs[dstRGB], blendFuncs[srcAlpha], blendFuncs[dstAlpha]];
	              }, function (env, scope, value) {
	                var BLEND_FUNCS = env.constants.blendFuncs;
	                check$1.optional(function () {
	                  env.assert(scope, value + '&&typeof ' + value + '==="object"', 'invalid blend func, must be an object');
	                });

	                function read(prefix, suffix) {
	                  var func = scope.def('"', prefix, suffix, '" in ', value, '?', value, '.', prefix, suffix, ':', value, '.', prefix);
	                  check$1.optional(function () {
	                    env.assert(scope, func + ' in ' + BLEND_FUNCS, 'invalid ' + prop + '.' + prefix + suffix + ', must be one of ' + Object.keys(blendFuncs));
	                  });
	                  return func;
	                }

	                var srcRGB = read('src', 'RGB');
	                var dstRGB = read('dst', 'RGB');
	                check$1.optional(function () {
	                  var INVALID_BLEND_COMBINATIONS = env.constants.invalidBlendCombinations;
	                  env.assert(scope, INVALID_BLEND_COMBINATIONS + '.indexOf(' + srcRGB + '+", "+' + dstRGB + ') === -1 ', 'unallowed blending combination for (srcRGB, dstRGB)');
	                });
	                var SRC_RGB = scope.def(BLEND_FUNCS, '[', srcRGB, ']');
	                var SRC_ALPHA = scope.def(BLEND_FUNCS, '[', read('src', 'Alpha'), ']');
	                var DST_RGB = scope.def(BLEND_FUNCS, '[', dstRGB, ']');
	                var DST_ALPHA = scope.def(BLEND_FUNCS, '[', read('dst', 'Alpha'), ']');
	                return [SRC_RGB, DST_RGB, SRC_ALPHA, DST_ALPHA];
	              });

	            case S_BLEND_EQUATION:
	              return parseParam(function (value) {
	                if (typeof value === 'string') {
	                  check$1.commandParameter(value, blendEquations, 'invalid ' + prop, env.commandStr);
	                  return [blendEquations[value], blendEquations[value]];
	                } else if (typeof value === 'object') {
	                  check$1.commandParameter(value.rgb, blendEquations, prop + '.rgb', env.commandStr);
	                  check$1.commandParameter(value.alpha, blendEquations, prop + '.alpha', env.commandStr);
	                  return [blendEquations[value.rgb], blendEquations[value.alpha]];
	                } else {
	                  check$1.commandRaise('invalid blend.equation', env.commandStr);
	                }
	              }, function (env, scope, value) {
	                var BLEND_EQUATIONS = env.constants.blendEquations;
	                var RGB = scope.def();
	                var ALPHA = scope.def();
	                var ifte = env.cond('typeof ', value, '==="string"');
	                check$1.optional(function () {
	                  function checkProp(block, name, value) {
	                    env.assert(block, value + ' in ' + BLEND_EQUATIONS, 'invalid ' + name + ', must be one of ' + Object.keys(blendEquations));
	                  }

	                  checkProp(ifte.then, prop, value);
	                  env.assert(ifte.else, value + '&&typeof ' + value + '==="object"', 'invalid ' + prop);
	                  checkProp(ifte.else, prop + '.rgb', value + '.rgb');
	                  checkProp(ifte.else, prop + '.alpha', value + '.alpha');
	                });
	                ifte.then(RGB, '=', ALPHA, '=', BLEND_EQUATIONS, '[', value, '];');
	                ifte.else(RGB, '=', BLEND_EQUATIONS, '[', value, '.rgb];', ALPHA, '=', BLEND_EQUATIONS, '[', value, '.alpha];');
	                scope(ifte);
	                return [RGB, ALPHA];
	              });

	            case S_BLEND_COLOR:
	              return parseParam(function (value) {
	                check$1.command(isArrayLike(value) && value.length === 4, 'blend.color must be a 4d array', env.commandStr);
	                return loop(4, function (i) {
	                  return +value[i];
	                });
	              }, function (env, scope, value) {
	                check$1.optional(function () {
	                  env.assert(scope, env.shared.isArrayLike + '(' + value + ')&&' + value + '.length===4', 'blend.color must be a 4d array');
	                });
	                return loop(4, function (i) {
	                  return scope.def('+', value, '[', i, ']');
	                });
	              });

	            case S_STENCIL_MASK:
	              return parseParam(function (value) {
	                check$1.commandType(value, 'number', param, env.commandStr);
	                return value | 0;
	              }, function (env, scope, value) {
	                check$1.optional(function () {
	                  env.assert(scope, 'typeof ' + value + '==="number"', 'invalid stencil.mask');
	                });
	                return scope.def(value, '|0');
	              });

	            case S_STENCIL_FUNC:
	              return parseParam(function (value) {
	                check$1.commandType(value, 'object', param, env.commandStr);
	                var cmp = value.cmp || 'keep';
	                var ref = value.ref || 0;
	                var mask = 'mask' in value ? value.mask : -1;
	                check$1.commandParameter(cmp, compareFuncs, prop + '.cmp', env.commandStr);
	                check$1.commandType(ref, 'number', prop + '.ref', env.commandStr);
	                check$1.commandType(mask, 'number', prop + '.mask', env.commandStr);
	                return [compareFuncs[cmp], ref, mask];
	              }, function (env, scope, value) {
	                var COMPARE_FUNCS = env.constants.compareFuncs;
	                check$1.optional(function () {
	                  function assert$$1() {
	                    env.assert(scope, Array.prototype.join.call(arguments, ''), 'invalid stencil.func');
	                  }

	                  assert$$1(value + '&&typeof ', value, '==="object"');
	                  assert$$1('!("cmp" in ', value, ')||(', value, '.cmp in ', COMPARE_FUNCS, ')');
	                });
	                var cmp = scope.def('"cmp" in ', value, '?', COMPARE_FUNCS, '[', value, '.cmp]', ':', GL_KEEP);
	                var ref = scope.def(value, '.ref|0');
	                var mask = scope.def('"mask" in ', value, '?', value, '.mask|0:-1');
	                return [cmp, ref, mask];
	              });

	            case S_STENCIL_OPFRONT:
	            case S_STENCIL_OPBACK:
	              return parseParam(function (value) {
	                check$1.commandType(value, 'object', param, env.commandStr);
	                var fail = value.fail || 'keep';
	                var zfail = value.zfail || 'keep';
	                var zpass = value.zpass || 'keep';
	                check$1.commandParameter(fail, stencilOps, prop + '.fail', env.commandStr);
	                check$1.commandParameter(zfail, stencilOps, prop + '.zfail', env.commandStr);
	                check$1.commandParameter(zpass, stencilOps, prop + '.zpass', env.commandStr);
	                return [prop === S_STENCIL_OPBACK ? GL_BACK : GL_FRONT, stencilOps[fail], stencilOps[zfail], stencilOps[zpass]];
	              }, function (env, scope, value) {
	                var STENCIL_OPS = env.constants.stencilOps;
	                check$1.optional(function () {
	                  env.assert(scope, value + '&&typeof ' + value + '==="object"', 'invalid ' + prop);
	                });

	                function read(name) {
	                  check$1.optional(function () {
	                    env.assert(scope, '!("' + name + '" in ' + value + ')||' + '(' + value + '.' + name + ' in ' + STENCIL_OPS + ')', 'invalid ' + prop + '.' + name + ', must be one of ' + Object.keys(stencilOps));
	                  });
	                  return scope.def('"', name, '" in ', value, '?', STENCIL_OPS, '[', value, '.', name, ']:', GL_KEEP);
	                }

	                return [prop === S_STENCIL_OPBACK ? GL_BACK : GL_FRONT, read('fail'), read('zfail'), read('zpass')];
	              });

	            case S_POLYGON_OFFSET_OFFSET:
	              return parseParam(function (value) {
	                check$1.commandType(value, 'object', param, env.commandStr);
	                var factor = value.factor | 0;
	                var units = value.units | 0;
	                check$1.commandType(factor, 'number', param + '.factor', env.commandStr);
	                check$1.commandType(units, 'number', param + '.units', env.commandStr);
	                return [factor, units];
	              }, function (env, scope, value) {
	                check$1.optional(function () {
	                  env.assert(scope, value + '&&typeof ' + value + '==="object"', 'invalid ' + prop);
	                });
	                var FACTOR = scope.def(value, '.factor|0');
	                var UNITS = scope.def(value, '.units|0');
	                return [FACTOR, UNITS];
	              });

	            case S_CULL_FACE:
	              return parseParam(function (value) {
	                var face = 0;

	                if (value === 'front') {
	                  face = GL_FRONT;
	                } else if (value === 'back') {
	                  face = GL_BACK;
	                }

	                check$1.command(!!face, param, env.commandStr);
	                return face;
	              }, function (env, scope, value) {
	                check$1.optional(function () {
	                  env.assert(scope, value + '==="front"||' + value + '==="back"', 'invalid cull.face');
	                });
	                return scope.def(value, '==="front"?', GL_FRONT, ':', GL_BACK);
	              });

	            case S_LINE_WIDTH:
	              return parseParam(function (value) {
	                check$1.command(typeof value === 'number' && value >= limits.lineWidthDims[0] && value <= limits.lineWidthDims[1], 'invalid line width, must be a positive number between ' + limits.lineWidthDims[0] + ' and ' + limits.lineWidthDims[1], env.commandStr);
	                return value;
	              }, function (env, scope, value) {
	                check$1.optional(function () {
	                  env.assert(scope, 'typeof ' + value + '==="number"&&' + value + '>=' + limits.lineWidthDims[0] + '&&' + value + '<=' + limits.lineWidthDims[1], 'invalid line width');
	                });
	                return value;
	              });

	            case S_FRONT_FACE:
	              return parseParam(function (value) {
	                check$1.commandParameter(value, orientationType, param, env.commandStr);
	                return orientationType[value];
	              }, function (env, scope, value) {
	                check$1.optional(function () {
	                  env.assert(scope, value + '==="cw"||' + value + '==="ccw"', 'invalid frontFace, must be one of cw,ccw');
	                });
	                return scope.def(value + '==="cw"?' + GL_CW + ':' + GL_CCW);
	              });

	            case S_COLOR_MASK:
	              return parseParam(function (value) {
	                check$1.command(isArrayLike(value) && value.length === 4, 'color.mask must be length 4 array', env.commandStr);
	                return value.map(function (v) {
	                  return !!v;
	                });
	              }, function (env, scope, value) {
	                check$1.optional(function () {
	                  env.assert(scope, env.shared.isArrayLike + '(' + value + ')&&' + value + '.length===4', 'invalid color.mask');
	                });
	                return loop(4, function (i) {
	                  return '!!' + value + '[' + i + ']';
	                });
	              });

	            case S_SAMPLE_COVERAGE:
	              return parseParam(function (value) {
	                check$1.command(typeof value === 'object' && value, param, env.commandStr);
	                var sampleValue = 'value' in value ? value.value : 1;
	                var sampleInvert = !!value.invert;
	                check$1.command(typeof sampleValue === 'number' && sampleValue >= 0 && sampleValue <= 1, 'sample.coverage.value must be a number between 0 and 1', env.commandStr);
	                return [sampleValue, sampleInvert];
	              }, function (env, scope, value) {
	                check$1.optional(function () {
	                  env.assert(scope, value + '&&typeof ' + value + '==="object"', 'invalid sample.coverage');
	                });
	                var VALUE = scope.def('"value" in ', value, '?+', value, '.value:1');
	                var INVERT = scope.def('!!', value, '.invert');
	                return [VALUE, INVERT];
	              });
	          }
	        });
	        return STATE;
	      }

	      function parseUniforms(uniforms, env) {
	        var staticUniforms = uniforms.static;
	        var dynamicUniforms = uniforms.dynamic;
	        var UNIFORMS = {};
	        Object.keys(staticUniforms).forEach(function (name) {
	          var value = staticUniforms[name];
	          var result;

	          if (typeof value === 'number' || typeof value === 'boolean') {
	            result = createStaticDecl(function () {
	              return value;
	            });
	          } else if (typeof value === 'function') {
	            var reglType = value._reglType;

	            if (reglType === 'texture2d' || reglType === 'textureCube') {
	              result = createStaticDecl(function (env) {
	                return env.link(value);
	              });
	            } else if (reglType === 'framebuffer' || reglType === 'framebufferCube') {
	              check$1.command(value.color.length > 0, 'missing color attachment for framebuffer sent to uniform "' + name + '"', env.commandStr);
	              result = createStaticDecl(function (env) {
	                return env.link(value.color[0]);
	              });
	            } else {
	              check$1.commandRaise('invalid data for uniform "' + name + '"', env.commandStr);
	            }
	          } else if (isArrayLike(value)) {
	            result = createStaticDecl(function (env) {
	              var ITEM = env.global.def('[', loop(value.length, function (i) {
	                check$1.command(typeof value[i] === 'number' || typeof value[i] === 'boolean', 'invalid uniform ' + name, env.commandStr);
	                return value[i];
	              }), ']');
	              return ITEM;
	            });
	          } else {
	            check$1.commandRaise('invalid or missing data for uniform "' + name + '"', env.commandStr);
	          }

	          result.value = value;
	          UNIFORMS[name] = result;
	        });
	        Object.keys(dynamicUniforms).forEach(function (key) {
	          var dyn = dynamicUniforms[key];
	          UNIFORMS[key] = createDynamicDecl(dyn, function (env, scope) {
	            return env.invoke(scope, dyn);
	          });
	        });
	        return UNIFORMS;
	      }

	      function parseAttributes(attributes, env) {
	        var staticAttributes = attributes.static;
	        var dynamicAttributes = attributes.dynamic;
	        var attributeDefs = {};
	        Object.keys(staticAttributes).forEach(function (attribute) {
	          var value = staticAttributes[attribute];
	          var id = stringStore.id(attribute);
	          var record = new AttributeRecord();

	          if (isBufferArgs(value)) {
	            record.state = ATTRIB_STATE_POINTER;
	            record.buffer = bufferState.getBuffer(bufferState.create(value, GL_ARRAY_BUFFER$1, false, true));
	            record.type = 0;
	          } else {
	            var buffer = bufferState.getBuffer(value);

	            if (buffer) {
	              record.state = ATTRIB_STATE_POINTER;
	              record.buffer = buffer;
	              record.type = 0;
	            } else {
	              check$1.command(typeof value === 'object' && value, 'invalid data for attribute ' + attribute, env.commandStr);

	              if ('constant' in value) {
	                var constant = value.constant;
	                record.buffer = 'null';
	                record.state = ATTRIB_STATE_CONSTANT;

	                if (typeof constant === 'number') {
	                  record.x = constant;
	                } else {
	                  check$1.command(isArrayLike(constant) && constant.length > 0 && constant.length <= 4, 'invalid constant for attribute ' + attribute, env.commandStr);
	                  CUTE_COMPONENTS.forEach(function (c, i) {
	                    if (i < constant.length) {
	                      record[c] = constant[i];
	                    }
	                  });
	                }
	              } else {
	                if (isBufferArgs(value.buffer)) {
	                  buffer = bufferState.getBuffer(bufferState.create(value.buffer, GL_ARRAY_BUFFER$1, false, true));
	                } else {
	                  buffer = bufferState.getBuffer(value.buffer);
	                }

	                check$1.command(!!buffer, 'missing buffer for attribute "' + attribute + '"', env.commandStr);
	                var offset = value.offset | 0;
	                check$1.command(offset >= 0, 'invalid offset for attribute "' + attribute + '"', env.commandStr);
	                var stride = value.stride | 0;
	                check$1.command(stride >= 0 && stride < 256, 'invalid stride for attribute "' + attribute + '", must be integer betweeen [0, 255]', env.commandStr);
	                var size = value.size | 0;
	                check$1.command(!('size' in value) || size > 0 && size <= 4, 'invalid size for attribute "' + attribute + '", must be 1,2,3,4', env.commandStr);
	                var normalized = !!value.normalized;
	                var type = 0;

	                if ('type' in value) {
	                  check$1.commandParameter(value.type, glTypes, 'invalid type for attribute ' + attribute, env.commandStr);
	                  type = glTypes[value.type];
	                }

	                var divisor = value.divisor | 0;

	                if ('divisor' in value) {
	                  check$1.command(divisor === 0 || extInstancing, 'cannot specify divisor for attribute "' + attribute + '", instancing not supported', env.commandStr);
	                  check$1.command(divisor >= 0, 'invalid divisor for attribute "' + attribute + '"', env.commandStr);
	                }

	                check$1.optional(function () {
	                  var command = env.commandStr;
	                  var VALID_KEYS = ['buffer', 'offset', 'divisor', 'normalized', 'type', 'size', 'stride'];
	                  Object.keys(value).forEach(function (prop) {
	                    check$1.command(VALID_KEYS.indexOf(prop) >= 0, 'unknown parameter "' + prop + '" for attribute pointer "' + attribute + '" (valid parameters are ' + VALID_KEYS + ')', command);
	                  });
	                });
	                record.buffer = buffer;
	                record.state = ATTRIB_STATE_POINTER;
	                record.size = size;
	                record.normalized = normalized;
	                record.type = type || buffer.dtype;
	                record.offset = offset;
	                record.stride = stride;
	                record.divisor = divisor;
	              }
	            }
	          }

	          attributeDefs[attribute] = createStaticDecl(function (env, scope) {
	            var cache = env.attribCache;

	            if (id in cache) {
	              return cache[id];
	            }

	            var result = {
	              isStream: false
	            };
	            Object.keys(record).forEach(function (key) {
	              result[key] = record[key];
	            });

	            if (record.buffer) {
	              result.buffer = env.link(record.buffer);
	              result.type = result.type || result.buffer + '.dtype';
	            }

	            cache[id] = result;
	            return result;
	          });
	        });
	        Object.keys(dynamicAttributes).forEach(function (attribute) {
	          var dyn = dynamicAttributes[attribute];

	          function appendAttributeCode(env, block) {
	            var VALUE = env.invoke(block, dyn);
	            var shared = env.shared;
	            var constants = env.constants;
	            var IS_BUFFER_ARGS = shared.isBufferArgs;
	            var BUFFER_STATE = shared.buffer;
	            check$1.optional(function () {
	              env.assert(block, VALUE + '&&(typeof ' + VALUE + '==="object"||typeof ' + VALUE + '==="function")&&(' + IS_BUFFER_ARGS + '(' + VALUE + ')||' + BUFFER_STATE + '.getBuffer(' + VALUE + ')||' + BUFFER_STATE + '.getBuffer(' + VALUE + '.buffer)||' + IS_BUFFER_ARGS + '(' + VALUE + '.buffer)||' + '("constant" in ' + VALUE + '&&(typeof ' + VALUE + '.constant==="number"||' + shared.isArrayLike + '(' + VALUE + '.constant))))', 'invalid dynamic attribute "' + attribute + '"');
	            });
	            var result = {
	              isStream: block.def(false)
	            };
	            var defaultRecord = new AttributeRecord();
	            defaultRecord.state = ATTRIB_STATE_POINTER;
	            Object.keys(defaultRecord).forEach(function (key) {
	              result[key] = block.def('' + defaultRecord[key]);
	            });
	            var BUFFER = result.buffer;
	            var TYPE = result.type;
	            block('if(', IS_BUFFER_ARGS, '(', VALUE, ')){', result.isStream, '=true;', BUFFER, '=', BUFFER_STATE, '.createStream(', GL_ARRAY_BUFFER$1, ',', VALUE, ');', TYPE, '=', BUFFER, '.dtype;', '}else{', BUFFER, '=', BUFFER_STATE, '.getBuffer(', VALUE, ');', 'if(', BUFFER, '){', TYPE, '=', BUFFER, '.dtype;', '}else if("constant" in ', VALUE, '){', result.state, '=', ATTRIB_STATE_CONSTANT, ';', 'if(typeof ' + VALUE + '.constant === "number"){', result[CUTE_COMPONENTS[0]], '=', VALUE, '.constant;', CUTE_COMPONENTS.slice(1).map(function (n) {
	              return result[n];
	            }).join('='), '=0;', '}else{', CUTE_COMPONENTS.map(function (name, i) {
	              return result[name] + '=' + VALUE + '.constant.length>' + i + '?' + VALUE + '.constant[' + i + ']:0;';
	            }).join(''), '}}else{', 'if(', IS_BUFFER_ARGS, '(', VALUE, '.buffer)){', BUFFER, '=', BUFFER_STATE, '.createStream(', GL_ARRAY_BUFFER$1, ',', VALUE, '.buffer);', '}else{', BUFFER, '=', BUFFER_STATE, '.getBuffer(', VALUE, '.buffer);', '}', TYPE, '="type" in ', VALUE, '?', constants.glTypes, '[', VALUE, '.type]:', BUFFER, '.dtype;', result.normalized, '=!!', VALUE, '.normalized;');

	            function emitReadRecord(name) {
	              block(result[name], '=', VALUE, '.', name, '|0;');
	            }

	            emitReadRecord('size');
	            emitReadRecord('offset');
	            emitReadRecord('stride');
	            emitReadRecord('divisor');
	            block('}}');
	            block.exit('if(', result.isStream, '){', BUFFER_STATE, '.destroyStream(', BUFFER, ');', '}');
	            return result;
	          }

	          attributeDefs[attribute] = createDynamicDecl(dyn, appendAttributeCode);
	        });
	        return attributeDefs;
	      }

	      function parseContext(context) {
	        var staticContext = context.static;
	        var dynamicContext = context.dynamic;
	        var result = {};
	        Object.keys(staticContext).forEach(function (name) {
	          var value = staticContext[name];
	          result[name] = createStaticDecl(function (env, scope) {
	            if (typeof value === 'number' || typeof value === 'boolean') {
	              return '' + value;
	            } else {
	              return env.link(value);
	            }
	          });
	        });
	        Object.keys(dynamicContext).forEach(function (name) {
	          var dyn = dynamicContext[name];
	          result[name] = createDynamicDecl(dyn, function (env, scope) {
	            return env.invoke(scope, dyn);
	          });
	        });
	        return result;
	      }

	      function parseArguments(options, attributes, uniforms, context, env) {
	        var staticOptions = options.static;
	        var dynamicOptions = options.dynamic;
	        check$1.optional(function () {
	          var KEY_NAMES = [S_FRAMEBUFFER, S_VERT, S_FRAG, S_ELEMENTS, S_PRIMITIVE, S_OFFSET, S_COUNT, S_INSTANCES, S_PROFILE].concat(GL_STATE_NAMES);

	          function checkKeys(dict) {
	            Object.keys(dict).forEach(function (key) {
	              check$1.command(KEY_NAMES.indexOf(key) >= 0, 'unknown parameter "' + key + '"', env.commandStr);
	            });
	          }

	          checkKeys(staticOptions);
	          checkKeys(dynamicOptions);
	        });
	        var framebuffer = parseFramebuffer(options, env);
	        var viewportAndScissor = parseViewportScissor(options, framebuffer, env);
	        var draw = parseDraw(options, env);
	        var state = parseGLState(options, env);
	        var shader = parseProgram(options, env);

	        function copyBox(name) {
	          var defn = viewportAndScissor[name];

	          if (defn) {
	            state[name] = defn;
	          }
	        }

	        copyBox(S_VIEWPORT);
	        copyBox(propName(S_SCISSOR_BOX));
	        var dirty = Object.keys(state).length > 0;
	        var result = {
	          framebuffer: framebuffer,
	          draw: draw,
	          shader: shader,
	          state: state,
	          dirty: dirty
	        };
	        result.profile = parseProfile(options, env);
	        result.uniforms = parseUniforms(uniforms, env);
	        result.attributes = parseAttributes(attributes, env);
	        result.context = parseContext(context, env);
	        return result;
	      }

	      function emitContext(env, scope, context) {
	        var shared = env.shared;
	        var CONTEXT = shared.context;
	        var contextEnter = env.scope();
	        Object.keys(context).forEach(function (name) {
	          scope.save(CONTEXT, '.' + name);
	          var defn = context[name];
	          contextEnter(CONTEXT, '.', name, '=', defn.append(env, scope), ';');
	        });
	        scope(contextEnter);
	      }

	      function emitPollFramebuffer(env, scope, framebuffer, skipCheck) {
	        var shared = env.shared;
	        var GL = shared.gl;
	        var FRAMEBUFFER_STATE = shared.framebuffer;
	        var EXT_DRAW_BUFFERS;

	        if (extDrawBuffers) {
	          EXT_DRAW_BUFFERS = scope.def(shared.extensions, '.webgl_draw_buffers');
	        }

	        var constants = env.constants;
	        var DRAW_BUFFERS = constants.drawBuffer;
	        var BACK_BUFFER = constants.backBuffer;
	        var NEXT;

	        if (framebuffer) {
	          NEXT = framebuffer.append(env, scope);
	        } else {
	          NEXT = scope.def(FRAMEBUFFER_STATE, '.next');
	        }

	        if (!skipCheck) {
	          scope('if(', NEXT, '!==', FRAMEBUFFER_STATE, '.cur){');
	        }

	        scope('if(', NEXT, '){', GL, '.bindFramebuffer(', GL_FRAMEBUFFER$2, ',', NEXT, '.framebuffer);');

	        if (extDrawBuffers) {
	          scope(EXT_DRAW_BUFFERS, '.drawBuffersWEBGL(', DRAW_BUFFERS, '[', NEXT, '.colorAttachments.length]);');
	        }

	        scope('}else{', GL, '.bindFramebuffer(', GL_FRAMEBUFFER$2, ',null);');

	        if (extDrawBuffers) {
	          scope(EXT_DRAW_BUFFERS, '.drawBuffersWEBGL(', BACK_BUFFER, ');');
	        }

	        scope('}', FRAMEBUFFER_STATE, '.cur=', NEXT, ';');

	        if (!skipCheck) {
	          scope('}');
	        }
	      }

	      function emitPollState(env, scope, args) {
	        var shared = env.shared;
	        var GL = shared.gl;
	        var CURRENT_VARS = env.current;
	        var NEXT_VARS = env.next;
	        var CURRENT_STATE = shared.current;
	        var NEXT_STATE = shared.next;
	        var block = env.cond(CURRENT_STATE, '.dirty');
	        GL_STATE_NAMES.forEach(function (prop) {
	          var param = propName(prop);

	          if (param in args.state) {
	            return;
	          }

	          var NEXT, CURRENT;

	          if (param in NEXT_VARS) {
	            NEXT = NEXT_VARS[param];
	            CURRENT = CURRENT_VARS[param];
	            var parts = loop(currentState[param].length, function (i) {
	              return block.def(NEXT, '[', i, ']');
	            });
	            block(env.cond(parts.map(function (p, i) {
	              return p + '!==' + CURRENT + '[' + i + ']';
	            }).join('||')).then(GL, '.', GL_VARIABLES[param], '(', parts, ');', parts.map(function (p, i) {
	              return CURRENT + '[' + i + ']=' + p;
	            }).join(';'), ';'));
	          } else {
	            NEXT = block.def(NEXT_STATE, '.', param);
	            var ifte = env.cond(NEXT, '!==', CURRENT_STATE, '.', param);
	            block(ifte);

	            if (param in GL_FLAGS) {
	              ifte(env.cond(NEXT).then(GL, '.enable(', GL_FLAGS[param], ');').else(GL, '.disable(', GL_FLAGS[param], ');'), CURRENT_STATE, '.', param, '=', NEXT, ';');
	            } else {
	              ifte(GL, '.', GL_VARIABLES[param], '(', NEXT, ');', CURRENT_STATE, '.', param, '=', NEXT, ';');
	            }
	          }
	        });

	        if (Object.keys(args.state).length === 0) {
	          block(CURRENT_STATE, '.dirty=false;');
	        }

	        scope(block);
	      }

	      function emitSetOptions(env, scope, options, filter) {
	        var shared = env.shared;
	        var CURRENT_VARS = env.current;
	        var CURRENT_STATE = shared.current;
	        var GL = shared.gl;
	        sortState(Object.keys(options)).forEach(function (param) {
	          var defn = options[param];

	          if (filter && !filter(defn)) {
	            return;
	          }

	          var variable = defn.append(env, scope);

	          if (GL_FLAGS[param]) {
	            var flag = GL_FLAGS[param];

	            if (isStatic(defn)) {
	              if (variable) {
	                scope(GL, '.enable(', flag, ');');
	              } else {
	                scope(GL, '.disable(', flag, ');');
	              }
	            } else {
	              scope(env.cond(variable).then(GL, '.enable(', flag, ');').else(GL, '.disable(', flag, ');'));
	            }

	            scope(CURRENT_STATE, '.', param, '=', variable, ';');
	          } else if (isArrayLike(variable)) {
	            var CURRENT = CURRENT_VARS[param];
	            scope(GL, '.', GL_VARIABLES[param], '(', variable, ');', variable.map(function (v, i) {
	              return CURRENT + '[' + i + ']=' + v;
	            }).join(';'), ';');
	          } else {
	            scope(GL, '.', GL_VARIABLES[param], '(', variable, ');', CURRENT_STATE, '.', param, '=', variable, ';');
	          }
	        });
	      }

	      function injectExtensions(env, scope) {
	        if (extInstancing) {
	          env.instancing = scope.def(env.shared.extensions, '.angle_instanced_arrays');
	        }
	      }

	      function emitProfile(env, scope, args, useScope, incrementCounter) {
	        var shared = env.shared;
	        var STATS = env.stats;
	        var CURRENT_STATE = shared.current;
	        var TIMER = shared.timer;
	        var profileArg = args.profile;

	        function perfCounter() {
	          if (typeof performance === 'undefined') {
	            return 'Date.now()';
	          } else {
	            return 'performance.now()';
	          }
	        }

	        var CPU_START, QUERY_COUNTER;

	        function emitProfileStart(block) {
	          CPU_START = scope.def();
	          block(CPU_START, '=', perfCounter(), ';');

	          if (typeof incrementCounter === 'string') {
	            block(STATS, '.count+=', incrementCounter, ';');
	          } else {
	            block(STATS, '.count++;');
	          }

	          if (timer) {
	            if (useScope) {
	              QUERY_COUNTER = scope.def();
	              block(QUERY_COUNTER, '=', TIMER, '.getNumPendingQueries();');
	            } else {
	              block(TIMER, '.beginQuery(', STATS, ');');
	            }
	          }
	        }

	        function emitProfileEnd(block) {
	          block(STATS, '.cpuTime+=', perfCounter(), '-', CPU_START, ';');

	          if (timer) {
	            if (useScope) {
	              block(TIMER, '.pushScopeStats(', QUERY_COUNTER, ',', TIMER, '.getNumPendingQueries(),', STATS, ');');
	            } else {
	              block(TIMER, '.endQuery();');
	            }
	          }
	        }

	        function scopeProfile(value) {
	          var prev = scope.def(CURRENT_STATE, '.profile');
	          scope(CURRENT_STATE, '.profile=', value, ';');
	          scope.exit(CURRENT_STATE, '.profile=', prev, ';');
	        }

	        var USE_PROFILE;

	        if (profileArg) {
	          if (isStatic(profileArg)) {
	            if (profileArg.enable) {
	              emitProfileStart(scope);
	              emitProfileEnd(scope.exit);
	              scopeProfile('true');
	            } else {
	              scopeProfile('false');
	            }

	            return;
	          }

	          USE_PROFILE = profileArg.append(env, scope);
	          scopeProfile(USE_PROFILE);
	        } else {
	          USE_PROFILE = scope.def(CURRENT_STATE, '.profile');
	        }

	        var start = env.block();
	        emitProfileStart(start);
	        scope('if(', USE_PROFILE, '){', start, '}');
	        var end = env.block();
	        emitProfileEnd(end);
	        scope.exit('if(', USE_PROFILE, '){', end, '}');
	      }

	      function emitAttributes(env, scope, args, attributes, filter) {
	        var shared = env.shared;

	        function typeLength(x) {
	          switch (x) {
	            case GL_FLOAT_VEC2:
	            case GL_INT_VEC2:
	            case GL_BOOL_VEC2:
	              return 2;

	            case GL_FLOAT_VEC3:
	            case GL_INT_VEC3:
	            case GL_BOOL_VEC3:
	              return 3;

	            case GL_FLOAT_VEC4:
	            case GL_INT_VEC4:
	            case GL_BOOL_VEC4:
	              return 4;

	            default:
	              return 1;
	          }
	        }

	        function emitBindAttribute(ATTRIBUTE, size, record) {
	          var GL = shared.gl;
	          var LOCATION = scope.def(ATTRIBUTE, '.location');
	          var BINDING = scope.def(shared.attributes, '[', LOCATION, ']');
	          var STATE = record.state;
	          var BUFFER = record.buffer;
	          var CONST_COMPONENTS = [record.x, record.y, record.z, record.w];
	          var COMMON_KEYS = ['buffer', 'normalized', 'offset', 'stride'];

	          function emitBuffer() {
	            scope('if(!', BINDING, '.buffer){', GL, '.enableVertexAttribArray(', LOCATION, ');}');
	            var TYPE = record.type;
	            var SIZE;

	            if (!record.size) {
	              SIZE = size;
	            } else {
	              SIZE = scope.def(record.size, '||', size);
	            }

	            scope('if(', BINDING, '.type!==', TYPE, '||', BINDING, '.size!==', SIZE, '||', COMMON_KEYS.map(function (key) {
	              return BINDING + '.' + key + '!==' + record[key];
	            }).join('||'), '){', GL, '.bindBuffer(', GL_ARRAY_BUFFER$1, ',', BUFFER, '.buffer);', GL, '.vertexAttribPointer(', [LOCATION, SIZE, TYPE, record.normalized, record.stride, record.offset], ');', BINDING, '.type=', TYPE, ';', BINDING, '.size=', SIZE, ';', COMMON_KEYS.map(function (key) {
	              return BINDING + '.' + key + '=' + record[key] + ';';
	            }).join(''), '}');

	            if (extInstancing) {
	              var DIVISOR = record.divisor;
	              scope('if(', BINDING, '.divisor!==', DIVISOR, '){', env.instancing, '.vertexAttribDivisorANGLE(', [LOCATION, DIVISOR], ');', BINDING, '.divisor=', DIVISOR, ';}');
	            }
	          }

	          function emitConstant() {
	            scope('if(', BINDING, '.buffer){', GL, '.disableVertexAttribArray(', LOCATION, ');', '}if(', CUTE_COMPONENTS.map(function (c, i) {
	              return BINDING + '.' + c + '!==' + CONST_COMPONENTS[i];
	            }).join('||'), '){', GL, '.vertexAttrib4f(', LOCATION, ',', CONST_COMPONENTS, ');', CUTE_COMPONENTS.map(function (c, i) {
	              return BINDING + '.' + c + '=' + CONST_COMPONENTS[i] + ';';
	            }).join(''), '}');
	          }

	          if (STATE === ATTRIB_STATE_POINTER) {
	            emitBuffer();
	          } else if (STATE === ATTRIB_STATE_CONSTANT) {
	            emitConstant();
	          } else {
	            scope('if(', STATE, '===', ATTRIB_STATE_POINTER, '){');
	            emitBuffer();
	            scope('}else{');
	            emitConstant();
	            scope('}');
	          }
	        }

	        attributes.forEach(function (attribute) {
	          var name = attribute.name;
	          var arg = args.attributes[name];
	          var record;

	          if (arg) {
	            if (!filter(arg)) {
	              return;
	            }

	            record = arg.append(env, scope);
	          } else {
	            if (!filter(SCOPE_DECL)) {
	              return;
	            }

	            var scopeAttrib = env.scopeAttrib(name);
	            check$1.optional(function () {
	              env.assert(scope, scopeAttrib + '.state', 'missing attribute ' + name);
	            });
	            record = {};
	            Object.keys(new AttributeRecord()).forEach(function (key) {
	              record[key] = scope.def(scopeAttrib, '.', key);
	            });
	          }

	          emitBindAttribute(env.link(attribute), typeLength(attribute.info.type), record);
	        });
	      }

	      function emitUniforms(env, scope, args, uniforms, filter) {
	        var shared = env.shared;
	        var GL = shared.gl;
	        var infix;

	        for (var i = 0; i < uniforms.length; ++i) {
	          var uniform = uniforms[i];
	          var name = uniform.name;
	          var type = uniform.info.type;
	          var arg = args.uniforms[name];
	          var UNIFORM = env.link(uniform);
	          var LOCATION = UNIFORM + '.location';
	          var VALUE;

	          if (arg) {
	            if (!filter(arg)) {
	              continue;
	            }

	            if (isStatic(arg)) {
	              var value = arg.value;
	              check$1.command(value !== null && typeof value !== 'undefined', 'missing uniform "' + name + '"', env.commandStr);

	              if (type === GL_SAMPLER_2D || type === GL_SAMPLER_CUBE) {
	                check$1.command(typeof value === 'function' && (type === GL_SAMPLER_2D && (value._reglType === 'texture2d' || value._reglType === 'framebuffer') || type === GL_SAMPLER_CUBE && (value._reglType === 'textureCube' || value._reglType === 'framebufferCube')), 'invalid texture for uniform ' + name, env.commandStr);
	                var TEX_VALUE = env.link(value._texture || value.color[0]._texture);
	                scope(GL, '.uniform1i(', LOCATION, ',', TEX_VALUE + '.bind());');
	                scope.exit(TEX_VALUE, '.unbind();');
	              } else if (type === GL_FLOAT_MAT2 || type === GL_FLOAT_MAT3 || type === GL_FLOAT_MAT4) {
	                check$1.optional(function () {
	                  check$1.command(isArrayLike(value), 'invalid matrix for uniform ' + name, env.commandStr);
	                  check$1.command(type === GL_FLOAT_MAT2 && value.length === 4 || type === GL_FLOAT_MAT3 && value.length === 9 || type === GL_FLOAT_MAT4 && value.length === 16, 'invalid length for matrix uniform ' + name, env.commandStr);
	                });
	                var MAT_VALUE = env.global.def('new Float32Array([' + Array.prototype.slice.call(value) + '])');
	                var dim = 2;

	                if (type === GL_FLOAT_MAT3) {
	                  dim = 3;
	                } else if (type === GL_FLOAT_MAT4) {
	                  dim = 4;
	                }

	                scope(GL, '.uniformMatrix', dim, 'fv(', LOCATION, ',false,', MAT_VALUE, ');');
	              } else {
	                switch (type) {
	                  case GL_FLOAT$8:
	                    check$1.commandType(value, 'number', 'uniform ' + name, env.commandStr);
	                    infix = '1f';
	                    break;

	                  case GL_FLOAT_VEC2:
	                    check$1.command(isArrayLike(value) && value.length === 2, 'uniform ' + name, env.commandStr);
	                    infix = '2f';
	                    break;

	                  case GL_FLOAT_VEC3:
	                    check$1.command(isArrayLike(value) && value.length === 3, 'uniform ' + name, env.commandStr);
	                    infix = '3f';
	                    break;

	                  case GL_FLOAT_VEC4:
	                    check$1.command(isArrayLike(value) && value.length === 4, 'uniform ' + name, env.commandStr);
	                    infix = '4f';
	                    break;

	                  case GL_BOOL:
	                    check$1.commandType(value, 'boolean', 'uniform ' + name, env.commandStr);
	                    infix = '1i';
	                    break;

	                  case GL_INT$3:
	                    check$1.commandType(value, 'number', 'uniform ' + name, env.commandStr);
	                    infix = '1i';
	                    break;

	                  case GL_BOOL_VEC2:
	                    check$1.command(isArrayLike(value) && value.length === 2, 'uniform ' + name, env.commandStr);
	                    infix = '2i';
	                    break;

	                  case GL_INT_VEC2:
	                    check$1.command(isArrayLike(value) && value.length === 2, 'uniform ' + name, env.commandStr);
	                    infix = '2i';
	                    break;

	                  case GL_BOOL_VEC3:
	                    check$1.command(isArrayLike(value) && value.length === 3, 'uniform ' + name, env.commandStr);
	                    infix = '3i';
	                    break;

	                  case GL_INT_VEC3:
	                    check$1.command(isArrayLike(value) && value.length === 3, 'uniform ' + name, env.commandStr);
	                    infix = '3i';
	                    break;

	                  case GL_BOOL_VEC4:
	                    check$1.command(isArrayLike(value) && value.length === 4, 'uniform ' + name, env.commandStr);
	                    infix = '4i';
	                    break;

	                  case GL_INT_VEC4:
	                    check$1.command(isArrayLike(value) && value.length === 4, 'uniform ' + name, env.commandStr);
	                    infix = '4i';
	                    break;
	                }

	                scope(GL, '.uniform', infix, '(', LOCATION, ',', isArrayLike(value) ? Array.prototype.slice.call(value) : value, ');');
	              }

	              continue;
	            } else {
	              VALUE = arg.append(env, scope);
	            }
	          } else {
	            if (!filter(SCOPE_DECL)) {
	              continue;
	            }

	            VALUE = scope.def(shared.uniforms, '[', stringStore.id(name), ']');
	          }

	          if (type === GL_SAMPLER_2D) {
	            scope('if(', VALUE, '&&', VALUE, '._reglType==="framebuffer"){', VALUE, '=', VALUE, '.color[0];', '}');
	          } else if (type === GL_SAMPLER_CUBE) {
	            scope('if(', VALUE, '&&', VALUE, '._reglType==="framebufferCube"){', VALUE, '=', VALUE, '.color[0];', '}');
	          }

	          check$1.optional(function () {
	            function check(pred, message) {
	              env.assert(scope, pred, 'bad data or missing for uniform "' + name + '".  ' + message);
	            }

	            function checkType(type) {
	              check('typeof ' + VALUE + '==="' + type + '"', 'invalid type, expected ' + type);
	            }

	            function checkVector(n, type) {
	              check(shared.isArrayLike + '(' + VALUE + ')&&' + VALUE + '.length===' + n, 'invalid vector, should have length ' + n, env.commandStr);
	            }

	            function checkTexture(target) {
	              check('typeof ' + VALUE + '==="function"&&' + VALUE + '._reglType==="texture' + (target === GL_TEXTURE_2D$3 ? '2d' : 'Cube') + '"', 'invalid texture type', env.commandStr);
	            }

	            switch (type) {
	              case GL_INT$3:
	                checkType('number');
	                break;

	              case GL_INT_VEC2:
	                checkVector(2, 'number');
	                break;

	              case GL_INT_VEC3:
	                checkVector(3, 'number');
	                break;

	              case GL_INT_VEC4:
	                checkVector(4, 'number');
	                break;

	              case GL_FLOAT$8:
	                checkType('number');
	                break;

	              case GL_FLOAT_VEC2:
	                checkVector(2, 'number');
	                break;

	              case GL_FLOAT_VEC3:
	                checkVector(3, 'number');
	                break;

	              case GL_FLOAT_VEC4:
	                checkVector(4, 'number');
	                break;

	              case GL_BOOL:
	                checkType('boolean');
	                break;

	              case GL_BOOL_VEC2:
	                checkVector(2, 'boolean');
	                break;

	              case GL_BOOL_VEC3:
	                checkVector(3, 'boolean');
	                break;

	              case GL_BOOL_VEC4:
	                checkVector(4, 'boolean');
	                break;

	              case GL_FLOAT_MAT2:
	                checkVector(4, 'number');
	                break;

	              case GL_FLOAT_MAT3:
	                checkVector(9, 'number');
	                break;

	              case GL_FLOAT_MAT4:
	                checkVector(16, 'number');
	                break;

	              case GL_SAMPLER_2D:
	                checkTexture(GL_TEXTURE_2D$3);
	                break;

	              case GL_SAMPLER_CUBE:
	                checkTexture(GL_TEXTURE_CUBE_MAP$2);
	                break;
	            }
	          });
	          var unroll = 1;

	          switch (type) {
	            case GL_SAMPLER_2D:
	            case GL_SAMPLER_CUBE:
	              var TEX = scope.def(VALUE, '._texture');
	              scope(GL, '.uniform1i(', LOCATION, ',', TEX, '.bind());');
	              scope.exit(TEX, '.unbind();');
	              continue;

	            case GL_INT$3:
	            case GL_BOOL:
	              infix = '1i';
	              break;

	            case GL_INT_VEC2:
	            case GL_BOOL_VEC2:
	              infix = '2i';
	              unroll = 2;
	              break;

	            case GL_INT_VEC3:
	            case GL_BOOL_VEC3:
	              infix = '3i';
	              unroll = 3;
	              break;

	            case GL_INT_VEC4:
	            case GL_BOOL_VEC4:
	              infix = '4i';
	              unroll = 4;
	              break;

	            case GL_FLOAT$8:
	              infix = '1f';
	              break;

	            case GL_FLOAT_VEC2:
	              infix = '2f';
	              unroll = 2;
	              break;

	            case GL_FLOAT_VEC3:
	              infix = '3f';
	              unroll = 3;
	              break;

	            case GL_FLOAT_VEC4:
	              infix = '4f';
	              unroll = 4;
	              break;

	            case GL_FLOAT_MAT2:
	              infix = 'Matrix2fv';
	              break;

	            case GL_FLOAT_MAT3:
	              infix = 'Matrix3fv';
	              break;

	            case GL_FLOAT_MAT4:
	              infix = 'Matrix4fv';
	              break;
	          }

	          scope(GL, '.uniform', infix, '(', LOCATION, ',');

	          if (infix.charAt(0) === 'M') {
	            var matSize = Math.pow(type - GL_FLOAT_MAT2 + 2, 2);
	            var STORAGE = env.global.def('new Float32Array(', matSize, ')');
	            scope('false,(Array.isArray(', VALUE, ')||', VALUE, ' instanceof Float32Array)?', VALUE, ':(', loop(matSize, function (i) {
	              return STORAGE + '[' + i + ']=' + VALUE + '[' + i + ']';
	            }), ',', STORAGE, ')');
	          } else if (unroll > 1) {
	            scope(loop(unroll, function (i) {
	              return VALUE + '[' + i + ']';
	            }));
	          } else {
	            scope(VALUE);
	          }

	          scope(');');
	        }
	      }

	      function emitDraw(env, outer, inner, args) {
	        var shared = env.shared;
	        var GL = shared.gl;
	        var DRAW_STATE = shared.draw;
	        var drawOptions = args.draw;

	        function emitElements() {
	          var defn = drawOptions.elements;
	          var ELEMENTS;
	          var scope = outer;

	          if (defn) {
	            if (defn.contextDep && args.contextDynamic || defn.propDep) {
	              scope = inner;
	            }

	            ELEMENTS = defn.append(env, scope);
	          } else {
	            ELEMENTS = scope.def(DRAW_STATE, '.', S_ELEMENTS);
	          }

	          if (ELEMENTS) {
	            scope('if(' + ELEMENTS + ')' + GL + '.bindBuffer(' + GL_ELEMENT_ARRAY_BUFFER$1 + ',' + ELEMENTS + '.buffer.buffer);');
	          }

	          return ELEMENTS;
	        }

	        function emitCount() {
	          var defn = drawOptions.count;
	          var COUNT;
	          var scope = outer;

	          if (defn) {
	            if (defn.contextDep && args.contextDynamic || defn.propDep) {
	              scope = inner;
	            }

	            COUNT = defn.append(env, scope);
	            check$1.optional(function () {
	              if (defn.MISSING) {
	                env.assert(outer, 'false', 'missing vertex count');
	              }

	              if (defn.DYNAMIC) {
	                env.assert(scope, COUNT + '>=0', 'missing vertex count');
	              }
	            });
	          } else {
	            COUNT = scope.def(DRAW_STATE, '.', S_COUNT);
	            check$1.optional(function () {
	              env.assert(scope, COUNT + '>=0', 'missing vertex count');
	            });
	          }

	          return COUNT;
	        }

	        var ELEMENTS = emitElements();

	        function emitValue(name) {
	          var defn = drawOptions[name];

	          if (defn) {
	            if (defn.contextDep && args.contextDynamic || defn.propDep) {
	              return defn.append(env, inner);
	            } else {
	              return defn.append(env, outer);
	            }
	          } else {
	            return outer.def(DRAW_STATE, '.', name);
	          }
	        }

	        var PRIMITIVE = emitValue(S_PRIMITIVE);
	        var OFFSET = emitValue(S_OFFSET);
	        var COUNT = emitCount();

	        if (typeof COUNT === 'number') {
	          if (COUNT === 0) {
	            return;
	          }
	        } else {
	          inner('if(', COUNT, '){');
	          inner.exit('}');
	        }

	        var INSTANCES, EXT_INSTANCING;

	        if (extInstancing) {
	          INSTANCES = emitValue(S_INSTANCES);
	          EXT_INSTANCING = env.instancing;
	        }

	        var ELEMENT_TYPE = ELEMENTS + '.type';
	        var elementsStatic = drawOptions.elements && isStatic(drawOptions.elements);

	        function emitInstancing() {
	          function drawElements() {
	            inner(EXT_INSTANCING, '.drawElementsInstancedANGLE(', [PRIMITIVE, COUNT, ELEMENT_TYPE, OFFSET + '<<((' + ELEMENT_TYPE + '-' + GL_UNSIGNED_BYTE$8 + ')>>1)', INSTANCES], ');');
	          }

	          function drawArrays() {
	            inner(EXT_INSTANCING, '.drawArraysInstancedANGLE(', [PRIMITIVE, OFFSET, COUNT, INSTANCES], ');');
	          }

	          if (ELEMENTS) {
	            if (!elementsStatic) {
	              inner('if(', ELEMENTS, '){');
	              drawElements();
	              inner('}else{');
	              drawArrays();
	              inner('}');
	            } else {
	              drawElements();
	            }
	          } else {
	            drawArrays();
	          }
	        }

	        function emitRegular() {
	          function drawElements() {
	            inner(GL + '.drawElements(' + [PRIMITIVE, COUNT, ELEMENT_TYPE, OFFSET + '<<((' + ELEMENT_TYPE + '-' + GL_UNSIGNED_BYTE$8 + ')>>1)'] + ');');
	          }

	          function drawArrays() {
	            inner(GL + '.drawArrays(' + [PRIMITIVE, OFFSET, COUNT] + ');');
	          }

	          if (ELEMENTS) {
	            if (!elementsStatic) {
	              inner('if(', ELEMENTS, '){');
	              drawElements();
	              inner('}else{');
	              drawArrays();
	              inner('}');
	            } else {
	              drawElements();
	            }
	          } else {
	            drawArrays();
	          }
	        }

	        if (extInstancing && (typeof INSTANCES !== 'number' || INSTANCES >= 0)) {
	          if (typeof INSTANCES === 'string') {
	            inner('if(', INSTANCES, '>0){');
	            emitInstancing();
	            inner('}else if(', INSTANCES, '<0){');
	            emitRegular();
	            inner('}');
	          } else {
	            emitInstancing();
	          }
	        } else {
	          emitRegular();
	        }
	      }

	      function createBody(emitBody, parentEnv, args, program, count) {
	        var env = createREGLEnvironment();
	        var scope = env.proc('body', count);
	        check$1.optional(function () {
	          env.commandStr = parentEnv.commandStr;
	          env.command = env.link(parentEnv.commandStr);
	        });

	        if (extInstancing) {
	          env.instancing = scope.def(env.shared.extensions, '.angle_instanced_arrays');
	        }

	        emitBody(env, scope, args, program);
	        return env.compile().body;
	      }

	      function emitDrawBody(env, draw, args, program) {
	        injectExtensions(env, draw);
	        emitAttributes(env, draw, args, program.attributes, function () {
	          return true;
	        });
	        emitUniforms(env, draw, args, program.uniforms, function () {
	          return true;
	        });
	        emitDraw(env, draw, draw, args);
	      }

	      function emitDrawProc(env, args) {
	        var draw = env.proc('draw', 1);
	        injectExtensions(env, draw);
	        emitContext(env, draw, args.context);
	        emitPollFramebuffer(env, draw, args.framebuffer);
	        emitPollState(env, draw, args);
	        emitSetOptions(env, draw, args.state);
	        emitProfile(env, draw, args, false, true);
	        var program = args.shader.progVar.append(env, draw);
	        draw(env.shared.gl, '.useProgram(', program, '.program);');

	        if (args.shader.program) {
	          emitDrawBody(env, draw, args, args.shader.program);
	        } else {
	          var drawCache = env.global.def('{}');
	          var PROG_ID = draw.def(program, '.id');
	          var CACHED_PROC = draw.def(drawCache, '[', PROG_ID, ']');
	          draw(env.cond(CACHED_PROC).then(CACHED_PROC, '.call(this,a0);').else(CACHED_PROC, '=', drawCache, '[', PROG_ID, ']=', env.link(function (program) {
	            return createBody(emitDrawBody, env, args, program, 1);
	          }), '(', program, ');', CACHED_PROC, '.call(this,a0);'));
	        }

	        if (Object.keys(args.state).length > 0) {
	          draw(env.shared.current, '.dirty=true;');
	        }
	      }

	      function emitBatchDynamicShaderBody(env, scope, args, program) {
	        env.batchId = 'a1';
	        injectExtensions(env, scope);

	        function all() {
	          return true;
	        }

	        emitAttributes(env, scope, args, program.attributes, all);
	        emitUniforms(env, scope, args, program.uniforms, all);
	        emitDraw(env, scope, scope, args);
	      }

	      function emitBatchBody(env, scope, args, program) {
	        injectExtensions(env, scope);
	        var contextDynamic = args.contextDep;
	        var BATCH_ID = scope.def();
	        var PROP_LIST = 'a0';
	        var NUM_PROPS = 'a1';
	        var PROPS = scope.def();
	        env.shared.props = PROPS;
	        env.batchId = BATCH_ID;
	        var outer = env.scope();
	        var inner = env.scope();
	        scope(outer.entry, 'for(', BATCH_ID, '=0;', BATCH_ID, '<', NUM_PROPS, ';++', BATCH_ID, '){', PROPS, '=', PROP_LIST, '[', BATCH_ID, '];', inner, '}', outer.exit);

	        function isInnerDefn(defn) {
	          return defn.contextDep && contextDynamic || defn.propDep;
	        }

	        function isOuterDefn(defn) {
	          return !isInnerDefn(defn);
	        }

	        if (args.needsContext) {
	          emitContext(env, inner, args.context);
	        }

	        if (args.needsFramebuffer) {
	          emitPollFramebuffer(env, inner, args.framebuffer);
	        }

	        emitSetOptions(env, inner, args.state, isInnerDefn);

	        if (args.profile && isInnerDefn(args.profile)) {
	          emitProfile(env, inner, args, false, true);
	        }

	        if (!program) {
	          var progCache = env.global.def('{}');
	          var PROGRAM = args.shader.progVar.append(env, inner);
	          var PROG_ID = inner.def(PROGRAM, '.id');
	          var CACHED_PROC = inner.def(progCache, '[', PROG_ID, ']');
	          inner(env.shared.gl, '.useProgram(', PROGRAM, '.program);', 'if(!', CACHED_PROC, '){', CACHED_PROC, '=', progCache, '[', PROG_ID, ']=', env.link(function (program) {
	            return createBody(emitBatchDynamicShaderBody, env, args, program, 2);
	          }), '(', PROGRAM, ');}', CACHED_PROC, '.call(this,a0[', BATCH_ID, '],', BATCH_ID, ');');
	        } else {
	          emitAttributes(env, outer, args, program.attributes, isOuterDefn);
	          emitAttributes(env, inner, args, program.attributes, isInnerDefn);
	          emitUniforms(env, outer, args, program.uniforms, isOuterDefn);
	          emitUniforms(env, inner, args, program.uniforms, isInnerDefn);
	          emitDraw(env, outer, inner, args);
	        }
	      }

	      function emitBatchProc(env, args) {
	        var batch = env.proc('batch', 2);
	        env.batchId = '0';
	        injectExtensions(env, batch);
	        var contextDynamic = false;
	        var needsContext = true;
	        Object.keys(args.context).forEach(function (name) {
	          contextDynamic = contextDynamic || args.context[name].propDep;
	        });

	        if (!contextDynamic) {
	          emitContext(env, batch, args.context);
	          needsContext = false;
	        }

	        var framebuffer = args.framebuffer;
	        var needsFramebuffer = false;

	        if (framebuffer) {
	          if (framebuffer.propDep) {
	            contextDynamic = needsFramebuffer = true;
	          } else if (framebuffer.contextDep && contextDynamic) {
	            needsFramebuffer = true;
	          }

	          if (!needsFramebuffer) {
	            emitPollFramebuffer(env, batch, framebuffer);
	          }
	        } else {
	          emitPollFramebuffer(env, batch, null);
	        }

	        if (args.state.viewport && args.state.viewport.propDep) {
	          contextDynamic = true;
	        }

	        function isInnerDefn(defn) {
	          return defn.contextDep && contextDynamic || defn.propDep;
	        }

	        emitPollState(env, batch, args);
	        emitSetOptions(env, batch, args.state, function (defn) {
	          return !isInnerDefn(defn);
	        });

	        if (!args.profile || !isInnerDefn(args.profile)) {
	          emitProfile(env, batch, args, false, 'a1');
	        }

	        args.contextDep = contextDynamic;
	        args.needsContext = needsContext;
	        args.needsFramebuffer = needsFramebuffer;
	        var progDefn = args.shader.progVar;

	        if (progDefn.contextDep && contextDynamic || progDefn.propDep) {
	          emitBatchBody(env, batch, args, null);
	        } else {
	          var PROGRAM = progDefn.append(env, batch);
	          batch(env.shared.gl, '.useProgram(', PROGRAM, '.program);');

	          if (args.shader.program) {
	            emitBatchBody(env, batch, args, args.shader.program);
	          } else {
	            var batchCache = env.global.def('{}');
	            var PROG_ID = batch.def(PROGRAM, '.id');
	            var CACHED_PROC = batch.def(batchCache, '[', PROG_ID, ']');
	            batch(env.cond(CACHED_PROC).then(CACHED_PROC, '.call(this,a0,a1);').else(CACHED_PROC, '=', batchCache, '[', PROG_ID, ']=', env.link(function (program) {
	              return createBody(emitBatchBody, env, args, program, 2);
	            }), '(', PROGRAM, ');', CACHED_PROC, '.call(this,a0,a1);'));
	          }
	        }

	        if (Object.keys(args.state).length > 0) {
	          batch(env.shared.current, '.dirty=true;');
	        }
	      }

	      function emitScopeProc(env, args) {
	        var scope = env.proc('scope', 3);
	        env.batchId = 'a2';
	        var shared = env.shared;
	        var CURRENT_STATE = shared.current;
	        emitContext(env, scope, args.context);

	        if (args.framebuffer) {
	          args.framebuffer.append(env, scope);
	        }

	        sortState(Object.keys(args.state)).forEach(function (name) {
	          var defn = args.state[name];
	          var value = defn.append(env, scope);

	          if (isArrayLike(value)) {
	            value.forEach(function (v, i) {
	              scope.set(env.next[name], '[' + i + ']', v);
	            });
	          } else {
	            scope.set(shared.next, '.' + name, value);
	          }
	        });
	        emitProfile(env, scope, args, true, true);
	        [S_ELEMENTS, S_OFFSET, S_COUNT, S_INSTANCES, S_PRIMITIVE].forEach(function (opt) {
	          var variable = args.draw[opt];

	          if (!variable) {
	            return;
	          }

	          scope.set(shared.draw, '.' + opt, '' + variable.append(env, scope));
	        });
	        Object.keys(args.uniforms).forEach(function (opt) {
	          scope.set(shared.uniforms, '[' + stringStore.id(opt) + ']', args.uniforms[opt].append(env, scope));
	        });
	        Object.keys(args.attributes).forEach(function (name) {
	          var record = args.attributes[name].append(env, scope);
	          var scopeAttrib = env.scopeAttrib(name);
	          Object.keys(new AttributeRecord()).forEach(function (prop) {
	            scope.set(scopeAttrib, '.' + prop, record[prop]);
	          });
	        });

	        function saveShader(name) {
	          var shader = args.shader[name];

	          if (shader) {
	            scope.set(shared.shader, '.' + name, shader.append(env, scope));
	          }
	        }

	        saveShader(S_VERT);
	        saveShader(S_FRAG);

	        if (Object.keys(args.state).length > 0) {
	          scope(CURRENT_STATE, '.dirty=true;');
	          scope.exit(CURRENT_STATE, '.dirty=true;');
	        }

	        scope('a1(', env.shared.context, ',a0,', env.batchId, ');');
	      }

	      function isDynamicObject(object) {
	        if (typeof object !== 'object' || isArrayLike(object)) {
	          return;
	        }

	        var props = Object.keys(object);

	        for (var i = 0; i < props.length; ++i) {
	          if (dynamic.isDynamic(object[props[i]])) {
	            return true;
	          }
	        }

	        return false;
	      }

	      function splatObject(env, options, name) {
	        var object = options.static[name];

	        if (!object || !isDynamicObject(object)) {
	          return;
	        }

	        var globals = env.global;
	        var keys = Object.keys(object);
	        var thisDep = false;
	        var contextDep = false;
	        var propDep = false;
	        var objectRef = env.global.def('{}');
	        keys.forEach(function (key) {
	          var value = object[key];

	          if (dynamic.isDynamic(value)) {
	            if (typeof value === 'function') {
	              value = object[key] = dynamic.unbox(value);
	            }

	            var deps = createDynamicDecl(value, null);
	            thisDep = thisDep || deps.thisDep;
	            propDep = propDep || deps.propDep;
	            contextDep = contextDep || deps.contextDep;
	          } else {
	            globals(objectRef, '.', key, '=');

	            switch (typeof value) {
	              case 'number':
	                globals(value);
	                break;

	              case 'string':
	                globals('"', value, '"');
	                break;

	              case 'object':
	                if (Array.isArray(value)) {
	                  globals('[', value.join(), ']');
	                }

	                break;

	              default:
	                globals(env.link(value));
	                break;
	            }

	            globals(';');
	          }
	        });

	        function appendBlock(env, block) {
	          keys.forEach(function (key) {
	            var value = object[key];

	            if (!dynamic.isDynamic(value)) {
	              return;
	            }

	            var ref = env.invoke(block, value);
	            block(objectRef, '.', key, '=', ref, ';');
	          });
	        }

	        options.dynamic[name] = new dynamic.DynamicVariable(DYN_THUNK, {
	          thisDep: thisDep,
	          contextDep: contextDep,
	          propDep: propDep,
	          ref: objectRef,
	          append: appendBlock
	        });
	        delete options.static[name];
	      }

	      function compileCommand(options, attributes, uniforms, context, stats) {
	        var env = createREGLEnvironment();
	        env.stats = env.link(stats);
	        Object.keys(attributes.static).forEach(function (key) {
	          splatObject(env, attributes, key);
	        });
	        NESTED_OPTIONS.forEach(function (name) {
	          splatObject(env, options, name);
	        });
	        var args = parseArguments(options, attributes, uniforms, context, env);
	        emitDrawProc(env, args);
	        emitScopeProc(env, args);
	        emitBatchProc(env, args);
	        return env.compile();
	      }

	      return {
	        next: nextState,
	        current: currentState,
	        procs: function () {
	          var env = createREGLEnvironment();
	          var poll = env.proc('poll');
	          var refresh = env.proc('refresh');
	          var common = env.block();
	          poll(common);
	          refresh(common);
	          var shared = env.shared;
	          var GL = shared.gl;
	          var NEXT_STATE = shared.next;
	          var CURRENT_STATE = shared.current;
	          common(CURRENT_STATE, '.dirty=false;');
	          emitPollFramebuffer(env, poll);
	          emitPollFramebuffer(env, refresh, null, true);
	          var INSTANCING;

	          if (extInstancing) {
	            INSTANCING = env.link(extInstancing);
	          }

	          for (var i = 0; i < limits.maxAttributes; ++i) {
	            var BINDING = refresh.def(shared.attributes, '[', i, ']');
	            var ifte = env.cond(BINDING, '.buffer');
	            ifte.then(GL, '.enableVertexAttribArray(', i, ');', GL, '.bindBuffer(', GL_ARRAY_BUFFER$1, ',', BINDING, '.buffer.buffer);', GL, '.vertexAttribPointer(', i, ',', BINDING, '.size,', BINDING, '.type,', BINDING, '.normalized,', BINDING, '.stride,', BINDING, '.offset);').else(GL, '.disableVertexAttribArray(', i, ');', GL, '.vertexAttrib4f(', i, ',', BINDING, '.x,', BINDING, '.y,', BINDING, '.z,', BINDING, '.w);', BINDING, '.buffer=null;');
	            refresh(ifte);

	            if (extInstancing) {
	              refresh(INSTANCING, '.vertexAttribDivisorANGLE(', i, ',', BINDING, '.divisor);');
	            }
	          }

	          Object.keys(GL_FLAGS).forEach(function (flag) {
	            var cap = GL_FLAGS[flag];
	            var NEXT = common.def(NEXT_STATE, '.', flag);
	            var block = env.block();
	            block('if(', NEXT, '){', GL, '.enable(', cap, ')}else{', GL, '.disable(', cap, ')}', CURRENT_STATE, '.', flag, '=', NEXT, ';');
	            refresh(block);
	            poll('if(', NEXT, '!==', CURRENT_STATE, '.', flag, '){', block, '}');
	          });
	          Object.keys(GL_VARIABLES).forEach(function (name) {
	            var func = GL_VARIABLES[name];
	            var init = currentState[name];
	            var NEXT, CURRENT;
	            var block = env.block();
	            block(GL, '.', func, '(');

	            if (isArrayLike(init)) {
	              var n = init.length;
	              NEXT = env.global.def(NEXT_STATE, '.', name);
	              CURRENT = env.global.def(CURRENT_STATE, '.', name);
	              block(loop(n, function (i) {
	                return NEXT + '[' + i + ']';
	              }), ');', loop(n, function (i) {
	                return CURRENT + '[' + i + ']=' + NEXT + '[' + i + '];';
	              }).join(''));
	              poll('if(', loop(n, function (i) {
	                return NEXT + '[' + i + ']!==' + CURRENT + '[' + i + ']';
	              }).join('||'), '){', block, '}');
	            } else {
	              NEXT = common.def(NEXT_STATE, '.', name);
	              CURRENT = common.def(CURRENT_STATE, '.', name);
	              block(NEXT, ');', CURRENT_STATE, '.', name, '=', NEXT, ';');
	              poll('if(', NEXT, '!==', CURRENT, '){', block, '}');
	            }

	            refresh(block);
	          });
	          return env.compile();
	        }(),
	        compile: compileCommand
	      };
	    }

	    function stats() {
	      return {
	        bufferCount: 0,
	        elementsCount: 0,
	        framebufferCount: 0,
	        shaderCount: 0,
	        textureCount: 0,
	        cubeCount: 0,
	        renderbufferCount: 0,
	        maxTextureUnits: 0
	      };
	    }

	    var GL_QUERY_RESULT_EXT = 0x8866;
	    var GL_QUERY_RESULT_AVAILABLE_EXT = 0x8867;
	    var GL_TIME_ELAPSED_EXT = 0x88BF;

	    var createTimer = function createTimer(gl, extensions) {
	      if (!extensions.ext_disjoint_timer_query) {
	        return null;
	      }

	      var queryPool = [];

	      function allocQuery() {
	        return queryPool.pop() || extensions.ext_disjoint_timer_query.createQueryEXT();
	      }

	      function freeQuery(query) {
	        queryPool.push(query);
	      }

	      var pendingQueries = [];

	      function beginQuery(stats) {
	        var query = allocQuery();
	        extensions.ext_disjoint_timer_query.beginQueryEXT(GL_TIME_ELAPSED_EXT, query);
	        pendingQueries.push(query);
	        pushScopeStats(pendingQueries.length - 1, pendingQueries.length, stats);
	      }

	      function endQuery() {
	        extensions.ext_disjoint_timer_query.endQueryEXT(GL_TIME_ELAPSED_EXT);
	      }

	      function PendingStats() {
	        this.startQueryIndex = -1;
	        this.endQueryIndex = -1;
	        this.sum = 0;
	        this.stats = null;
	      }

	      var pendingStatsPool = [];

	      function allocPendingStats() {
	        return pendingStatsPool.pop() || new PendingStats();
	      }

	      function freePendingStats(pendingStats) {
	        pendingStatsPool.push(pendingStats);
	      }

	      var pendingStats = [];

	      function pushScopeStats(start, end, stats) {
	        var ps = allocPendingStats();
	        ps.startQueryIndex = start;
	        ps.endQueryIndex = end;
	        ps.sum = 0;
	        ps.stats = stats;
	        pendingStats.push(ps);
	      }

	      var timeSum = [];
	      var queryPtr = [];

	      function update() {
	        var ptr, i;
	        var n = pendingQueries.length;

	        if (n === 0) {
	          return;
	        }

	        queryPtr.length = Math.max(queryPtr.length, n + 1);
	        timeSum.length = Math.max(timeSum.length, n + 1);
	        timeSum[0] = 0;
	        queryPtr[0] = 0;
	        var queryTime = 0;
	        ptr = 0;

	        for (i = 0; i < pendingQueries.length; ++i) {
	          var query = pendingQueries[i];

	          if (extensions.ext_disjoint_timer_query.getQueryObjectEXT(query, GL_QUERY_RESULT_AVAILABLE_EXT)) {
	            queryTime += extensions.ext_disjoint_timer_query.getQueryObjectEXT(query, GL_QUERY_RESULT_EXT);
	            freeQuery(query);
	          } else {
	            pendingQueries[ptr++] = query;
	          }

	          timeSum[i + 1] = queryTime;
	          queryPtr[i + 1] = ptr;
	        }

	        pendingQueries.length = ptr;
	        ptr = 0;

	        for (i = 0; i < pendingStats.length; ++i) {
	          var stats = pendingStats[i];
	          var start = stats.startQueryIndex;
	          var end = stats.endQueryIndex;
	          stats.sum += timeSum[end] - timeSum[start];
	          var startPtr = queryPtr[start];
	          var endPtr = queryPtr[end];

	          if (endPtr === startPtr) {
	            stats.stats.gpuTime += stats.sum / 1e6;
	            freePendingStats(stats);
	          } else {
	            stats.startQueryIndex = startPtr;
	            stats.endQueryIndex = endPtr;
	            pendingStats[ptr++] = stats;
	          }
	        }

	        pendingStats.length = ptr;
	      }

	      return {
	        beginQuery: beginQuery,
	        endQuery: endQuery,
	        pushScopeStats: pushScopeStats,
	        update: update,
	        getNumPendingQueries: function getNumPendingQueries() {
	          return pendingQueries.length;
	        },
	        clear: function clear() {
	          queryPool.push.apply(queryPool, pendingQueries);

	          for (var i = 0; i < queryPool.length; i++) {
	            extensions.ext_disjoint_timer_query.deleteQueryEXT(queryPool[i]);
	          }

	          pendingQueries.length = 0;
	          queryPool.length = 0;
	        },
	        restore: function restore() {
	          pendingQueries.length = 0;
	          queryPool.length = 0;
	        }
	      };
	    };

	    var GL_COLOR_BUFFER_BIT = 16384;
	    var GL_DEPTH_BUFFER_BIT = 256;
	    var GL_STENCIL_BUFFER_BIT = 1024;
	    var GL_ARRAY_BUFFER = 34962;
	    var CONTEXT_LOST_EVENT = 'webglcontextlost';
	    var CONTEXT_RESTORED_EVENT = 'webglcontextrestored';
	    var DYN_PROP = 1;
	    var DYN_CONTEXT = 2;
	    var DYN_STATE = 3;

	    function find(haystack, needle) {
	      for (var i = 0; i < haystack.length; ++i) {
	        if (haystack[i] === needle) {
	          return i;
	        }
	      }

	      return -1;
	    }

	    function wrapREGL(args) {
	      var config = parseArgs(args);

	      if (!config) {
	        return null;
	      }

	      var gl = config.gl;
	      var glAttributes = gl.getContextAttributes();
	      var contextLost = gl.isContextLost();
	      var extensionState = createExtensionCache(gl, config);

	      if (!extensionState) {
	        return null;
	      }

	      var stringStore = createStringStore();
	      var stats$$1 = stats();
	      var extensions = extensionState.extensions;
	      var timer = createTimer(gl, extensions);
	      var START_TIME = clock();
	      var WIDTH = gl.drawingBufferWidth;
	      var HEIGHT = gl.drawingBufferHeight;
	      var contextState = {
	        tick: 0,
	        time: 0,
	        viewportWidth: WIDTH,
	        viewportHeight: HEIGHT,
	        framebufferWidth: WIDTH,
	        framebufferHeight: HEIGHT,
	        drawingBufferWidth: WIDTH,
	        drawingBufferHeight: HEIGHT,
	        pixelRatio: config.pixelRatio
	      };
	      var uniformState = {};
	      var drawState = {
	        elements: null,
	        primitive: 4,
	        count: -1,
	        offset: 0,
	        instances: -1
	      };
	      var limits = wrapLimits(gl, extensions);
	      var attributeState = wrapAttributeState(gl, extensions, limits, stringStore);
	      var bufferState = wrapBufferState(gl, stats$$1, config, attributeState);
	      var elementState = wrapElementsState(gl, extensions, bufferState, stats$$1);
	      var shaderState = wrapShaderState(gl, stringStore, stats$$1, config);
	      var textureState = createTextureSet(gl, extensions, limits, function () {
	        core.procs.poll();
	      }, contextState, stats$$1, config);
	      var renderbufferState = wrapRenderbuffers(gl, extensions, limits, stats$$1, config);
	      var framebufferState = wrapFBOState(gl, extensions, limits, textureState, renderbufferState, stats$$1);
	      var core = reglCore(gl, stringStore, extensions, limits, bufferState, elementState, textureState, framebufferState, uniformState, attributeState, shaderState, drawState, contextState, timer, config);
	      var readPixels = wrapReadPixels(gl, framebufferState, core.procs.poll, contextState, glAttributes, extensions, limits);
	      var nextState = core.next;
	      var canvas = gl.canvas;
	      var rafCallbacks = [];
	      var lossCallbacks = [];
	      var restoreCallbacks = [];
	      var destroyCallbacks = [config.onDestroy];
	      var activeRAF = null;

	      function handleRAF() {
	        if (rafCallbacks.length === 0) {
	          if (timer) {
	            timer.update();
	          }

	          activeRAF = null;
	          return;
	        }

	        activeRAF = raf.next(handleRAF);

	        _poll();

	        for (var i = rafCallbacks.length - 1; i >= 0; --i) {
	          var cb = rafCallbacks[i];

	          if (cb) {
	            cb(contextState, null, 0);
	          }
	        }

	        gl.flush();

	        if (timer) {
	          timer.update();
	        }
	      }

	      function startRAF() {
	        if (!activeRAF && rafCallbacks.length > 0) {
	          activeRAF = raf.next(handleRAF);
	        }
	      }

	      function stopRAF() {
	        if (activeRAF) {
	          raf.cancel(handleRAF);
	          activeRAF = null;
	        }
	      }

	      function handleContextLoss(event) {
	        event.preventDefault();
	        contextLost = true;
	        stopRAF();
	        lossCallbacks.forEach(function (cb) {
	          cb();
	        });
	      }

	      function handleContextRestored(event) {
	        gl.getError();
	        contextLost = false;
	        extensionState.restore();
	        shaderState.restore();
	        bufferState.restore();
	        textureState.restore();
	        renderbufferState.restore();
	        framebufferState.restore();

	        if (timer) {
	          timer.restore();
	        }

	        core.procs.refresh();
	        startRAF();
	        restoreCallbacks.forEach(function (cb) {
	          cb();
	        });
	      }

	      if (canvas) {
	        canvas.addEventListener(CONTEXT_LOST_EVENT, handleContextLoss, false);
	        canvas.addEventListener(CONTEXT_RESTORED_EVENT, handleContextRestored, false);
	      }

	      function destroy() {
	        rafCallbacks.length = 0;
	        stopRAF();

	        if (canvas) {
	          canvas.removeEventListener(CONTEXT_LOST_EVENT, handleContextLoss);
	          canvas.removeEventListener(CONTEXT_RESTORED_EVENT, handleContextRestored);
	        }

	        shaderState.clear();
	        framebufferState.clear();
	        renderbufferState.clear();
	        textureState.clear();
	        elementState.clear();
	        bufferState.clear();

	        if (timer) {
	          timer.clear();
	        }

	        destroyCallbacks.forEach(function (cb) {
	          cb();
	        });
	      }

	      function compileProcedure(options) {
	        check$1(!!options, 'invalid args to regl({...})');
	        check$1.type(options, 'object', 'invalid args to regl({...})');

	        function flattenNestedOptions(options) {
	          var result = extend({}, options);
	          delete result.uniforms;
	          delete result.attributes;
	          delete result.context;

	          if ('stencil' in result && result.stencil.op) {
	            result.stencil.opBack = result.stencil.opFront = result.stencil.op;
	            delete result.stencil.op;
	          }

	          function merge(name) {
	            if (name in result) {
	              var child = result[name];
	              delete result[name];
	              Object.keys(child).forEach(function (prop) {
	                result[name + '.' + prop] = child[prop];
	              });
	            }
	          }

	          merge('blend');
	          merge('depth');
	          merge('cull');
	          merge('stencil');
	          merge('polygonOffset');
	          merge('scissor');
	          merge('sample');
	          return result;
	        }

	        function separateDynamic(object) {
	          var staticItems = {};
	          var dynamicItems = {};
	          Object.keys(object).forEach(function (option) {
	            var value = object[option];

	            if (dynamic.isDynamic(value)) {
	              dynamicItems[option] = dynamic.unbox(value, option);
	            } else {
	              staticItems[option] = value;
	            }
	          });
	          return {
	            dynamic: dynamicItems,
	            static: staticItems
	          };
	        }

	        var context = separateDynamic(options.context || {});
	        var uniforms = separateDynamic(options.uniforms || {});
	        var attributes = separateDynamic(options.attributes || {});
	        var opts = separateDynamic(flattenNestedOptions(options));
	        var stats$$1 = {
	          gpuTime: 0.0,
	          cpuTime: 0.0,
	          count: 0
	        };
	        var compiled = core.compile(opts, attributes, uniforms, context, stats$$1);
	        var draw = compiled.draw;
	        var batch = compiled.batch;
	        var scope = compiled.scope;
	        var EMPTY_ARRAY = [];

	        function reserve(count) {
	          while (EMPTY_ARRAY.length < count) {
	            EMPTY_ARRAY.push(null);
	          }

	          return EMPTY_ARRAY;
	        }

	        function REGLCommand(args, body) {
	          var i;

	          if (contextLost) {
	            check$1.raise('context lost');
	          }

	          if (typeof args === 'function') {
	            return scope.call(this, null, args, 0);
	          } else if (typeof body === 'function') {
	            if (typeof args === 'number') {
	              for (i = 0; i < args; ++i) {
	                scope.call(this, null, body, i);
	              }

	              return;
	            } else if (Array.isArray(args)) {
	              for (i = 0; i < args.length; ++i) {
	                scope.call(this, args[i], body, i);
	              }

	              return;
	            } else {
	              return scope.call(this, args, body, 0);
	            }
	          } else if (typeof args === 'number') {
	            if (args > 0) {
	              return batch.call(this, reserve(args | 0), args | 0);
	            }
	          } else if (Array.isArray(args)) {
	            if (args.length) {
	              return batch.call(this, args, args.length);
	            }
	          } else {
	            return draw.call(this, args);
	          }
	        }

	        return extend(REGLCommand, {
	          stats: stats$$1
	        });
	      }

	      var setFBO = framebufferState.setFBO = compileProcedure({
	        framebuffer: dynamic.define.call(null, DYN_PROP, 'framebuffer')
	      });

	      function clearImpl(_, options) {
	        var clearFlags = 0;
	        core.procs.poll();
	        var c = options.color;

	        if (c) {
	          gl.clearColor(+c[0] || 0, +c[1] || 0, +c[2] || 0, +c[3] || 0);
	          clearFlags |= GL_COLOR_BUFFER_BIT;
	        }

	        if ('depth' in options) {
	          gl.clearDepth(+options.depth);
	          clearFlags |= GL_DEPTH_BUFFER_BIT;
	        }

	        if ('stencil' in options) {
	          gl.clearStencil(options.stencil | 0);
	          clearFlags |= GL_STENCIL_BUFFER_BIT;
	        }

	        check$1(!!clearFlags, 'called regl.clear with no buffer specified');
	        gl.clear(clearFlags);
	      }

	      function clear(options) {
	        check$1(typeof options === 'object' && options, 'regl.clear() takes an object as input');

	        if ('framebuffer' in options) {
	          if (options.framebuffer && options.framebuffer_reglType === 'framebufferCube') {
	            for (var i = 0; i < 6; ++i) {
	              setFBO(extend({
	                framebuffer: options.framebuffer.faces[i]
	              }, options), clearImpl);
	            }
	          } else {
	            setFBO(options, clearImpl);
	          }
	        } else {
	          clearImpl(null, options);
	        }
	      }

	      function frame(cb) {
	        check$1.type(cb, 'function', 'regl.frame() callback must be a function');
	        rafCallbacks.push(cb);

	        function cancel() {
	          var i = find(rafCallbacks, cb);
	          check$1(i >= 0, 'cannot cancel a frame twice');

	          function pendingCancel() {
	            var index = find(rafCallbacks, pendingCancel);
	            rafCallbacks[index] = rafCallbacks[rafCallbacks.length - 1];
	            rafCallbacks.length -= 1;

	            if (rafCallbacks.length <= 0) {
	              stopRAF();
	            }
	          }

	          rafCallbacks[i] = pendingCancel;
	        }

	        startRAF();
	        return {
	          cancel: cancel
	        };
	      }

	      function pollViewport() {
	        var viewport = nextState.viewport;
	        var scissorBox = nextState.scissor_box;
	        viewport[0] = viewport[1] = scissorBox[0] = scissorBox[1] = 0;
	        contextState.viewportWidth = contextState.framebufferWidth = contextState.drawingBufferWidth = viewport[2] = scissorBox[2] = gl.drawingBufferWidth;
	        contextState.viewportHeight = contextState.framebufferHeight = contextState.drawingBufferHeight = viewport[3] = scissorBox[3] = gl.drawingBufferHeight;
	      }

	      function _poll() {
	        contextState.tick += 1;
	        contextState.time = now();
	        pollViewport();
	        core.procs.poll();
	      }

	      function refresh() {
	        pollViewport();
	        core.procs.refresh();

	        if (timer) {
	          timer.update();
	        }
	      }

	      function now() {
	        return (clock() - START_TIME) / 1000.0;
	      }

	      refresh();

	      function addListener(event, callback) {
	        check$1.type(callback, 'function', 'listener callback must be a function');
	        var callbacks;

	        switch (event) {
	          case 'frame':
	            return frame(callback);

	          case 'lost':
	            callbacks = lossCallbacks;
	            break;

	          case 'restore':
	            callbacks = restoreCallbacks;
	            break;

	          case 'destroy':
	            callbacks = destroyCallbacks;
	            break;

	          default:
	            check$1.raise('invalid event, must be one of frame,lost,restore,destroy');
	        }

	        callbacks.push(callback);
	        return {
	          cancel: function cancel() {
	            for (var i = 0; i < callbacks.length; ++i) {
	              if (callbacks[i] === callback) {
	                callbacks[i] = callbacks[callbacks.length - 1];
	                callbacks.pop();
	                return;
	              }
	            }
	          }
	        };
	      }

	      var regl = extend(compileProcedure, {
	        clear: clear,
	        prop: dynamic.define.bind(null, DYN_PROP),
	        context: dynamic.define.bind(null, DYN_CONTEXT),
	        this: dynamic.define.bind(null, DYN_STATE),
	        draw: compileProcedure({}),
	        buffer: function buffer(options) {
	          return bufferState.create(options, GL_ARRAY_BUFFER, false, false);
	        },
	        elements: function elements(options) {
	          return elementState.create(options, false);
	        },
	        texture: textureState.create2D,
	        cube: textureState.createCube,
	        renderbuffer: renderbufferState.create,
	        framebuffer: framebufferState.create,
	        framebufferCube: framebufferState.createCube,
	        attributes: glAttributes,
	        frame: frame,
	        on: addListener,
	        limits: limits,
	        hasExtension: function hasExtension(name) {
	          return limits.extensions.indexOf(name.toLowerCase()) >= 0;
	        },
	        read: readPixels,
	        destroy: destroy,
	        _gl: gl,
	        _refresh: refresh,
	        poll: function poll() {
	          _poll();

	          if (timer) {
	            timer.update();
	          }
	        },
	        now: now,
	        stats: stats$$1
	      });
	      config.onDone(null, regl);
	      return regl;
	    }

	    return wrapREGL;
	  });
	});

	function _defineProperties(target, props) {
	  for (var i = 0; i < props.length; i++) {
	    var descriptor = props[i];
	    descriptor.enumerable = descriptor.enumerable || false;
	    descriptor.configurable = true;
	    if ("value" in descriptor) descriptor.writable = true;
	    Object.defineProperty(target, descriptor.key, descriptor);
	  }
	}

	function _createClass(Constructor, protoProps, staticProps) {
	  if (protoProps) _defineProperties(Constructor.prototype, protoProps);
	  if (staticProps) _defineProperties(Constructor, staticProps);
	  return Constructor;
	}

	function _inheritsLoose(subClass, superClass) {
	  subClass.prototype = Object.create(superClass.prototype);
	  subClass.prototype.constructor = subClass;
	  subClass.__proto__ = superClass;
	}

	var EPSILON = 0.000001;
	var ARRAY_TYPE = typeof Float32Array !== 'undefined' ? Float32Array : Array;
	var degree = Math.PI / 180;

	function create$2() {
	  var out = new ARRAY_TYPE(9);

	  if (ARRAY_TYPE != Float32Array) {
	    out[1] = 0;
	    out[2] = 0;
	    out[3] = 0;
	    out[5] = 0;
	    out[6] = 0;
	    out[7] = 0;
	  }

	  out[0] = 1;
	  out[4] = 1;
	  out[8] = 1;
	  return out;
	}
	function fromMat4(out, a) {
	  out[0] = a[0];
	  out[1] = a[1];
	  out[2] = a[2];
	  out[3] = a[4];
	  out[4] = a[5];
	  out[5] = a[6];
	  out[6] = a[8];
	  out[7] = a[9];
	  out[8] = a[10];
	  return out;
	}

	function identity$3(out) {
	  out[0] = 1;
	  out[1] = 0;
	  out[2] = 0;
	  out[3] = 0;
	  out[4] = 0;
	  out[5] = 1;
	  out[6] = 0;
	  out[7] = 0;
	  out[8] = 0;
	  out[9] = 0;
	  out[10] = 1;
	  out[11] = 0;
	  out[12] = 0;
	  out[13] = 0;
	  out[14] = 0;
	  out[15] = 1;
	  return out;
	}
	function transpose$2(out, a) {
	  if (out === a) {
	    var a01 = a[1],
	        a02 = a[2],
	        a03 = a[3];
	    var a12 = a[6],
	        a13 = a[7];
	    var a23 = a[11];
	    out[1] = a[4];
	    out[2] = a[8];
	    out[3] = a[12];
	    out[4] = a01;
	    out[6] = a[9];
	    out[7] = a[13];
	    out[8] = a02;
	    out[9] = a12;
	    out[11] = a[14];
	    out[12] = a03;
	    out[13] = a13;
	    out[14] = a23;
	  } else {
	    out[0] = a[0];
	    out[1] = a[4];
	    out[2] = a[8];
	    out[3] = a[12];
	    out[4] = a[1];
	    out[5] = a[5];
	    out[6] = a[9];
	    out[7] = a[13];
	    out[8] = a[2];
	    out[9] = a[6];
	    out[10] = a[10];
	    out[11] = a[14];
	    out[12] = a[3];
	    out[13] = a[7];
	    out[14] = a[11];
	    out[15] = a[15];
	  }

	  return out;
	}
	function invert$3(out, a) {
	  var a00 = a[0],
	      a01 = a[1],
	      a02 = a[2],
	      a03 = a[3];
	  var a10 = a[4],
	      a11 = a[5],
	      a12 = a[6],
	      a13 = a[7];
	  var a20 = a[8],
	      a21 = a[9],
	      a22 = a[10],
	      a23 = a[11];
	  var a30 = a[12],
	      a31 = a[13],
	      a32 = a[14],
	      a33 = a[15];
	  var b00 = a00 * a11 - a01 * a10;
	  var b01 = a00 * a12 - a02 * a10;
	  var b02 = a00 * a13 - a03 * a10;
	  var b03 = a01 * a12 - a02 * a11;
	  var b04 = a01 * a13 - a03 * a11;
	  var b05 = a02 * a13 - a03 * a12;
	  var b06 = a20 * a31 - a21 * a30;
	  var b07 = a20 * a32 - a22 * a30;
	  var b08 = a20 * a33 - a23 * a30;
	  var b09 = a21 * a32 - a22 * a31;
	  var b10 = a21 * a33 - a23 * a31;
	  var b11 = a22 * a33 - a23 * a32;
	  var det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;

	  if (!det) {
	    return null;
	  }

	  det = 1.0 / det;
	  out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
	  out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
	  out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
	  out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
	  out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
	  out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
	  out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
	  out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
	  out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
	  out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
	  out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
	  out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
	  out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
	  out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
	  out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
	  out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
	  return out;
	}
	function multiply$3(out, a, b) {
	  var a00 = a[0],
	      a01 = a[1],
	      a02 = a[2],
	      a03 = a[3];
	  var a10 = a[4],
	      a11 = a[5],
	      a12 = a[6],
	      a13 = a[7];
	  var a20 = a[8],
	      a21 = a[9],
	      a22 = a[10],
	      a23 = a[11];
	  var a30 = a[12],
	      a31 = a[13],
	      a32 = a[14],
	      a33 = a[15];
	  var b0 = b[0],
	      b1 = b[1],
	      b2 = b[2],
	      b3 = b[3];
	  out[0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
	  out[1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
	  out[2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
	  out[3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
	  b0 = b[4];
	  b1 = b[5];
	  b2 = b[6];
	  b3 = b[7];
	  out[4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
	  out[5] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
	  out[6] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
	  out[7] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
	  b0 = b[8];
	  b1 = b[9];
	  b2 = b[10];
	  b3 = b[11];
	  out[8] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
	  out[9] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
	  out[10] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
	  out[11] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
	  b0 = b[12];
	  b1 = b[13];
	  b2 = b[14];
	  b3 = b[15];
	  out[12] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
	  out[13] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
	  out[14] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
	  out[15] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
	  return out;
	}
	function translate$2(out, a, v) {
	  var x = v[0],
	      y = v[1],
	      z = v[2];
	  var a00 = void 0,
	      a01 = void 0,
	      a02 = void 0,
	      a03 = void 0;
	  var a10 = void 0,
	      a11 = void 0,
	      a12 = void 0,
	      a13 = void 0;
	  var a20 = void 0,
	      a21 = void 0,
	      a22 = void 0,
	      a23 = void 0;

	  if (a === out) {
	    out[12] = a[0] * x + a[4] * y + a[8] * z + a[12];
	    out[13] = a[1] * x + a[5] * y + a[9] * z + a[13];
	    out[14] = a[2] * x + a[6] * y + a[10] * z + a[14];
	    out[15] = a[3] * x + a[7] * y + a[11] * z + a[15];
	  } else {
	    a00 = a[0];
	    a01 = a[1];
	    a02 = a[2];
	    a03 = a[3];
	    a10 = a[4];
	    a11 = a[5];
	    a12 = a[6];
	    a13 = a[7];
	    a20 = a[8];
	    a21 = a[9];
	    a22 = a[10];
	    a23 = a[11];
	    out[0] = a00;
	    out[1] = a01;
	    out[2] = a02;
	    out[3] = a03;
	    out[4] = a10;
	    out[5] = a11;
	    out[6] = a12;
	    out[7] = a13;
	    out[8] = a20;
	    out[9] = a21;
	    out[10] = a22;
	    out[11] = a23;
	    out[12] = a00 * x + a10 * y + a20 * z + a[12];
	    out[13] = a01 * x + a11 * y + a21 * z + a[13];
	    out[14] = a02 * x + a12 * y + a22 * z + a[14];
	    out[15] = a03 * x + a13 * y + a23 * z + a[15];
	  }

	  return out;
	}
	function scale$3(out, a, v) {
	  var x = v[0],
	      y = v[1],
	      z = v[2];
	  out[0] = a[0] * x;
	  out[1] = a[1] * x;
	  out[2] = a[2] * x;
	  out[3] = a[3] * x;
	  out[4] = a[4] * y;
	  out[5] = a[5] * y;
	  out[6] = a[6] * y;
	  out[7] = a[7] * y;
	  out[8] = a[8] * z;
	  out[9] = a[9] * z;
	  out[10] = a[10] * z;
	  out[11] = a[11] * z;
	  out[12] = a[12];
	  out[13] = a[13];
	  out[14] = a[14];
	  out[15] = a[15];
	  return out;
	}
	function perspective(out, fovy, aspect, near, far) {
	  var f = 1.0 / Math.tan(fovy / 2),
	      nf = void 0;
	  out[0] = f / aspect;
	  out[1] = 0;
	  out[2] = 0;
	  out[3] = 0;
	  out[4] = 0;
	  out[5] = f;
	  out[6] = 0;
	  out[7] = 0;
	  out[8] = 0;
	  out[9] = 0;
	  out[11] = -1;
	  out[12] = 0;
	  out[13] = 0;
	  out[15] = 0;

	  if (far != null && far !== Infinity) {
	    nf = 1 / (near - far);
	    out[10] = (far + near) * nf;
	    out[14] = 2 * far * near * nf;
	  } else {
	    out[10] = -1;
	    out[14] = -2 * near;
	  }

	  return out;
	}
	function ortho(out, left, right, bottom, top, near, far) {
	  var lr = 1 / (left - right);
	  var bt = 1 / (bottom - top);
	  var nf = 1 / (near - far);
	  out[0] = -2 * lr;
	  out[1] = 0;
	  out[2] = 0;
	  out[3] = 0;
	  out[4] = 0;
	  out[5] = -2 * bt;
	  out[6] = 0;
	  out[7] = 0;
	  out[8] = 0;
	  out[9] = 0;
	  out[10] = 2 * nf;
	  out[11] = 0;
	  out[12] = (left + right) * lr;
	  out[13] = (top + bottom) * bt;
	  out[14] = (far + near) * nf;
	  out[15] = 1;
	  return out;
	}
	function lookAt(out, eye, center, up) {
	  var x0 = void 0,
	      x1 = void 0,
	      x2 = void 0,
	      y0 = void 0,
	      y1 = void 0,
	      y2 = void 0,
	      z0 = void 0,
	      z1 = void 0,
	      z2 = void 0,
	      len = void 0;
	  var eyex = eye[0];
	  var eyey = eye[1];
	  var eyez = eye[2];
	  var upx = up[0];
	  var upy = up[1];
	  var upz = up[2];
	  var centerx = center[0];
	  var centery = center[1];
	  var centerz = center[2];

	  if (Math.abs(eyex - centerx) < EPSILON && Math.abs(eyey - centery) < EPSILON && Math.abs(eyez - centerz) < EPSILON) {
	    return identity$3(out);
	  }

	  z0 = eyex - centerx;
	  z1 = eyey - centery;
	  z2 = eyez - centerz;
	  len = 1 / Math.sqrt(z0 * z0 + z1 * z1 + z2 * z2);
	  z0 *= len;
	  z1 *= len;
	  z2 *= len;
	  x0 = upy * z2 - upz * z1;
	  x1 = upz * z0 - upx * z2;
	  x2 = upx * z1 - upy * z0;
	  len = Math.sqrt(x0 * x0 + x1 * x1 + x2 * x2);

	  if (!len) {
	    x0 = 0;
	    x1 = 0;
	    x2 = 0;
	  } else {
	    len = 1 / len;
	    x0 *= len;
	    x1 *= len;
	    x2 *= len;
	  }

	  y0 = z1 * x2 - z2 * x1;
	  y1 = z2 * x0 - z0 * x2;
	  y2 = z0 * x1 - z1 * x0;
	  len = Math.sqrt(y0 * y0 + y1 * y1 + y2 * y2);

	  if (!len) {
	    y0 = 0;
	    y1 = 0;
	    y2 = 0;
	  } else {
	    len = 1 / len;
	    y0 *= len;
	    y1 *= len;
	    y2 *= len;
	  }

	  out[0] = x0;
	  out[1] = y0;
	  out[2] = z0;
	  out[3] = 0;
	  out[4] = x1;
	  out[5] = y1;
	  out[6] = z1;
	  out[7] = 0;
	  out[8] = x2;
	  out[9] = y2;
	  out[10] = z2;
	  out[11] = 0;
	  out[12] = -(x0 * eyex + x1 * eyey + x2 * eyez);
	  out[13] = -(y0 * eyex + y1 * eyey + y2 * eyez);
	  out[14] = -(z0 * eyex + z1 * eyey + z2 * eyez);
	  out[15] = 1;
	  return out;
	}

	function create$4() {
	  var out = new ARRAY_TYPE(3);

	  if (ARRAY_TYPE != Float32Array) {
	    out[0] = 0;
	    out[1] = 0;
	    out[2] = 0;
	  }

	  return out;
	}
	function length(a) {
	  var x = a[0];
	  var y = a[1];
	  var z = a[2];
	  return Math.sqrt(x * x + y * y + z * z);
	}
	function fromValues$4(x, y, z) {
	  var out = new ARRAY_TYPE(3);
	  out[0] = x;
	  out[1] = y;
	  out[2] = z;
	  return out;
	}
	function copy$4(out, a) {
	  out[0] = a[0];
	  out[1] = a[1];
	  out[2] = a[2];
	  return out;
	}
	function set$5(out, x, y, z) {
	  out[0] = x;
	  out[1] = y;
	  out[2] = z;
	  return out;
	}
	function add$4(out, a, b) {
	  out[0] = a[0] + b[0];
	  out[1] = a[1] + b[1];
	  out[2] = a[2] + b[2];
	  return out;
	}
	function subtract$4(out, a, b) {
	  out[0] = a[0] - b[0];
	  out[1] = a[1] - b[1];
	  out[2] = a[2] - b[2];
	  return out;
	}
	function scale$4(out, a, b) {
	  out[0] = a[0] * b;
	  out[1] = a[1] * b;
	  out[2] = a[2] * b;
	  return out;
	}
	function distance(a, b) {
	  var x = b[0] - a[0];
	  var y = b[1] - a[1];
	  var z = b[2] - a[2];
	  return Math.sqrt(x * x + y * y + z * z);
	}
	function normalize(out, a) {
	  var x = a[0];
	  var y = a[1];
	  var z = a[2];
	  var len = x * x + y * y + z * z;

	  if (len > 0) {
	    len = 1 / Math.sqrt(len);
	    out[0] = a[0] * len;
	    out[1] = a[1] * len;
	    out[2] = a[2] * len;
	  }

	  return out;
	}
	function dot(a, b) {
	  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
	}
	function cross(out, a, b) {
	  var ax = a[0],
	      ay = a[1],
	      az = a[2];
	  var bx = b[0],
	      by = b[1],
	      bz = b[2];
	  out[0] = ay * bz - az * by;
	  out[1] = az * bx - ax * bz;
	  out[2] = ax * by - ay * bx;
	  return out;
	}
	function transformMat4(out, a, m) {
	  var x = a[0],
	      y = a[1],
	      z = a[2];
	  var w = m[3] * x + m[7] * y + m[11] * z + m[15];
	  w = w || 1.0;
	  out[0] = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
	  out[1] = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
	  out[2] = (m[2] * x + m[6] * y + m[10] * z + m[14]) / w;
	  return out;
	}
	var sub$4 = subtract$4;
	var dist = distance;
	var len = length;
	var forEach = function () {
	  var vec = create$4();
	  return function (a, stride, offset, count, fn, arg) {
	    var i = void 0,
	        l = void 0;

	    if (!stride) {
	      stride = 3;
	    }

	    if (!offset) {
	      offset = 0;
	    }

	    if (count) {
	      l = Math.min(count * stride + offset, a.length);
	    } else {
	      l = a.length;
	    }

	    for (i = offset; i < l; i += stride) {
	      vec[0] = a[i];
	      vec[1] = a[i + 1];
	      vec[2] = a[i + 2];
	      fn(vec, vec, arg);
	      a[i] = vec[0];
	      a[i + 1] = vec[1];
	      a[i + 2] = vec[2];
	    }

	    return a;
	  };
	}();

	function create$5() {
	  var out = new ARRAY_TYPE(4);

	  if (ARRAY_TYPE != Float32Array) {
	    out[0] = 0;
	    out[1] = 0;
	    out[2] = 0;
	    out[3] = 0;
	  }

	  return out;
	}
	function copy$5(out, a) {
	  out[0] = a[0];
	  out[1] = a[1];
	  out[2] = a[2];
	  out[3] = a[3];
	  return out;
	}
	function set$6(out, x, y, z, w) {
	  out[0] = x;
	  out[1] = y;
	  out[2] = z;
	  out[3] = w;
	  return out;
	}
	function add$5(out, a, b) {
	  out[0] = a[0] + b[0];
	  out[1] = a[1] + b[1];
	  out[2] = a[2] + b[2];
	  out[3] = a[3] + b[3];
	  return out;
	}
	function scale$5(out, a, b) {
	  out[0] = a[0] * b;
	  out[1] = a[1] * b;
	  out[2] = a[2] * b;
	  out[3] = a[3] * b;
	  return out;
	}
	function normalize$1(out, a) {
	  var x = a[0];
	  var y = a[1];
	  var z = a[2];
	  var w = a[3];
	  var len = x * x + y * y + z * z + w * w;

	  if (len > 0) {
	    len = 1 / Math.sqrt(len);
	    out[0] = x * len;
	    out[1] = y * len;
	    out[2] = z * len;
	    out[3] = w * len;
	  }

	  return out;
	}
	function transformMat4$1(out, a, m) {
	  var x = a[0],
	      y = a[1],
	      z = a[2],
	      w = a[3];
	  out[0] = m[0] * x + m[4] * y + m[8] * z + m[12] * w;
	  out[1] = m[1] * x + m[5] * y + m[9] * z + m[13] * w;
	  out[2] = m[2] * x + m[6] * y + m[10] * z + m[14] * w;
	  out[3] = m[3] * x + m[7] * y + m[11] * z + m[15] * w;
	  return out;
	}
	var forEach$1 = function () {
	  var vec = create$5();
	  return function (a, stride, offset, count, fn, arg) {
	    var i = void 0,
	        l = void 0;

	    if (!stride) {
	      stride = 4;
	    }

	    if (!offset) {
	      offset = 0;
	    }

	    if (count) {
	      l = Math.min(count * stride + offset, a.length);
	    } else {
	      l = a.length;
	    }

	    for (i = offset; i < l; i += stride) {
	      vec[0] = a[i];
	      vec[1] = a[i + 1];
	      vec[2] = a[i + 2];
	      vec[3] = a[i + 3];
	      fn(vec, vec, arg);
	      a[i] = vec[0];
	      a[i + 1] = vec[1];
	      a[i + 2] = vec[2];
	      a[i + 3] = vec[3];
	    }

	    return a;
	  };
	}();

	function create$6() {
	  var out = new ARRAY_TYPE(4);

	  if (ARRAY_TYPE != Float32Array) {
	    out[0] = 0;
	    out[1] = 0;
	    out[2] = 0;
	  }

	  out[3] = 1;
	  return out;
	}
	function setAxisAngle(out, axis, rad) {
	  rad = rad * 0.5;
	  var s = Math.sin(rad);
	  out[0] = s * axis[0];
	  out[1] = s * axis[1];
	  out[2] = s * axis[2];
	  out[3] = Math.cos(rad);
	  return out;
	}
	function slerp(out, a, b, t) {
	  var ax = a[0],
	      ay = a[1],
	      az = a[2],
	      aw = a[3];
	  var bx = b[0],
	      by = b[1],
	      bz = b[2],
	      bw = b[3];
	  var omega = void 0,
	      cosom = void 0,
	      sinom = void 0,
	      scale0 = void 0,
	      scale1 = void 0;
	  cosom = ax * bx + ay * by + az * bz + aw * bw;

	  if (cosom < 0.0) {
	    cosom = -cosom;
	    bx = -bx;
	    by = -by;
	    bz = -bz;
	    bw = -bw;
	  }

	  if (1.0 - cosom > EPSILON) {
	    omega = Math.acos(cosom);
	    sinom = Math.sin(omega);
	    scale0 = Math.sin((1.0 - t) * omega) / sinom;
	    scale1 = Math.sin(t * omega) / sinom;
	  } else {
	    scale0 = 1.0 - t;
	    scale1 = t;
	  }

	  out[0] = scale0 * ax + scale1 * bx;
	  out[1] = scale0 * ay + scale1 * by;
	  out[2] = scale0 * az + scale1 * bz;
	  out[3] = scale0 * aw + scale1 * bw;
	  return out;
	}
	function fromMat3(out, m) {
	  var fTrace = m[0] + m[4] + m[8];
	  var fRoot = void 0;

	  if (fTrace > 0.0) {
	    fRoot = Math.sqrt(fTrace + 1.0);
	    out[3] = 0.5 * fRoot;
	    fRoot = 0.5 / fRoot;
	    out[0] = (m[5] - m[7]) * fRoot;
	    out[1] = (m[6] - m[2]) * fRoot;
	    out[2] = (m[1] - m[3]) * fRoot;
	  } else {
	    var i = 0;
	    if (m[4] > m[0]) i = 1;
	    if (m[8] > m[i * 3 + i]) i = 2;
	    var j = (i + 1) % 3;
	    var k = (i + 2) % 3;
	    fRoot = Math.sqrt(m[i * 3 + i] - m[j * 3 + j] - m[k * 3 + k] + 1.0);
	    out[i] = 0.5 * fRoot;
	    fRoot = 0.5 / fRoot;
	    out[3] = (m[j * 3 + k] - m[k * 3 + j]) * fRoot;
	    out[j] = (m[j * 3 + i] + m[i * 3 + j]) * fRoot;
	    out[k] = (m[k * 3 + i] + m[i * 3 + k]) * fRoot;
	  }

	  return out;
	}
	var scale$6 = scale$5;
	var normalize$2 = normalize$1;
	var rotationTo = function () {
	  var tmpvec3 = create$4();
	  var xUnitVec3 = fromValues$4(1, 0, 0);
	  var yUnitVec3 = fromValues$4(0, 1, 0);
	  return function (out, a, b) {
	    var dot$$1 = dot(a, b);

	    if (dot$$1 < -0.999999) {
	      cross(tmpvec3, xUnitVec3, a);
	      if (len(tmpvec3) < 0.000001) cross(tmpvec3, yUnitVec3, a);
	      normalize(tmpvec3, tmpvec3);
	      setAxisAngle(out, tmpvec3, Math.PI);
	      return out;
	    } else if (dot$$1 > 0.999999) {
	      out[0] = 0;
	      out[1] = 0;
	      out[2] = 0;
	      out[3] = 1;
	      return out;
	    } else {
	      cross(tmpvec3, a, b);
	      out[0] = tmpvec3[0];
	      out[1] = tmpvec3[1];
	      out[2] = tmpvec3[2];
	      out[3] = 1 + dot$$1;
	      return normalize$2(out, out);
	    }
	  };
	}();
	var sqlerp = function () {
	  var temp1 = create$6();
	  var temp2 = create$6();
	  return function (out, a, b, c, d, t) {
	    slerp(temp1, a, d, t);
	    slerp(temp2, b, c, t);
	    slerp(out, temp1, temp2, 2 * t * (1 - t));
	    return out;
	  };
	}();
	var setAxes = function () {
	  var matr = create$2();
	  return function (out, view, right, up) {
	    matr[0] = right[0];
	    matr[3] = right[1];
	    matr[6] = right[2];
	    matr[1] = up[0];
	    matr[4] = up[1];
	    matr[7] = up[2];
	    matr[2] = -view[0];
	    matr[5] = -view[1];
	    matr[8] = -view[2];
	    return normalize$2(out, fromMat3(out, matr));
	  };
	}();

	function create$8() {
	  var out = new ARRAY_TYPE(2);

	  if (ARRAY_TYPE != Float32Array) {
	    out[0] = 0;
	    out[1] = 0;
	  }

	  return out;
	}
	var forEach$2 = function () {
	  var vec = create$8();
	  return function (a, stride, offset, count, fn, arg) {
	    var i = void 0,
	        l = void 0;

	    if (!stride) {
	      stride = 2;
	    }

	    if (!offset) {
	      offset = 0;
	    }

	    if (count) {
	      l = Math.min(count * stride + offset, a.length);
	    } else {
	      l = a.length;
	    }

	    for (i = offset; i < l; i += stride) {
	      vec[0] = a[i];
	      vec[1] = a[i + 1];
	      fn(vec, vec, arg);
	      a[i] = vec[0];
	      a[i + 1] = vec[1];
	    }

	    return a;
	  };
	}();

	function isString(obj) {
	  if (isNil(obj)) {
	    return false;
	  }

	  return typeof obj === 'string' || obj.constructor !== null && obj.constructor === String;
	}

	function isNil(obj) {
	  return obj == null;
	}

	function isFunction(obj) {
	  if (isNil(obj)) {
	    return false;
	  }

	  return typeof obj === 'function' || obj.constructor !== null && obj.constructor === Function;
	}

	var supportAssign = typeof Object.assign === 'function';

	function extend(dest) {
	  if (supportAssign) {
	    Object.assign.apply(Object, arguments);
	  } else {
	    for (var i = 1; i < arguments.length; i++) {
	      var src = arguments[i];

	      for (var k in src) {
	        dest[k] = src[k];
	      }
	    }
	  }

	  return dest;
	}

	function extend2(dest) {
	  for (var i = 1; i < arguments.length; i++) {
	    var src = arguments[i];

	    for (var k in src) {
	      if (dest[k] === undefined) {
	        dest[k] = src[k];
	      }
	    }
	  }

	  return dest;
	}

	function isNumber(val) {
	  return typeof val === 'number' && !isNaN(val);
	}

	function log2(x) {
	  if (Math.log2) {
	    return Math.log2(x);
	  }

	  var v = Math.log(x) * Math.LOG2E;
	  var rounded = Math.round(v);

	  if (Math.abs(rounded - v) < 1E-14) {
	    return rounded;
	  } else {
	    return v;
	  }
	}

	function normalize$5(out, arr) {
	  var sum = 0;

	  for (var i = 0, l = arr.length; i < l; i++) {
	    sum += arr[i];
	  }

	  for (var _i = 0, _l = arr.length; _i < _l; _i++) {
	    out[_i] = arr[_i] / sum;
	  }

	  return out;
	}

	function interpolate(a, b, t) {
	  return a * (1 - t) + b * t;
	}

	function isArray(arr) {
	  return Array.isArray(arr) || arr instanceof Uint8Array || arr instanceof Int8Array || arr instanceof Uint16Array || arr instanceof Int16Array || arr instanceof Uint32Array || arr instanceof Int32Array || arr instanceof Uint8ClampedArray || arr instanceof Float32Array || arr instanceof Float64Array;
	}

	var Util = Object.freeze({
	  isString: isString,
	  isNil: isNil,
	  isFunction: isFunction,
	  extend: extend,
	  extend2: extend2,
	  isNumber: isNumber,
	  log2: log2,
	  normalize: normalize$5,
	  interpolate: interpolate,
	  isArray: isArray
	});

	var Eventable = function Eventable(Base) {
	  return function (_Base) {
	    _inheritsLoose(_class, _Base);

	    function _class() {
	      return _Base.apply(this, arguments) || this;
	    }

	    var _proto = _class.prototype;

	    _proto.on = function on(type, handler) {
	      if (!this._events) {
	        this._events = {
	          type: [handler]
	        };
	      }

	      this._events[type] = this._events[type] || [];

	      this._events[type].push(handler);

	      return this;
	    };

	    _proto.once = function once(type, handler) {
	      return this.on(type, this._wrapOnce(type, handler));
	    };

	    _proto.off = function off(type, handler) {
	      if (!this._events || !this._events[type]) {
	        return this;
	      }

	      this._events[type].splice(this._events[type].indexOf(handler), 1);

	      return this;
	    };

	    _proto.fire = function fire(type, params) {
	      if (params === void 0) {
	        params = {};
	      }

	      if (!this._events || !this._events[type]) {
	        return this;
	      }

	      if (!params.target) {
	        params.target = this;
	      }

	      var queue = this._events[type].slice(0);

	      for (var _iterator = queue, _isArray = Array.isArray(_iterator), _i2 = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
	        var _ref;

	        if (_isArray) {
	          if (_i2 >= _iterator.length) break;
	          _ref = _iterator[_i2++];
	        } else {
	          _i2 = _iterator.next();
	          if (_i2.done) break;
	          _ref = _i2.value;
	        }

	        var p = _ref;
	        p(params);
	      }

	      return this;
	    };

	    _proto._wrapOnce = function _wrapOnce(type, handler) {
	      var self = this;
	      var called = false;

	      var fn = function onceHandler(params) {
	        if (called) {
	          return;
	        }

	        called = true;
	        handler(params);
	        self.off(type, onceHandler);
	      };

	      return fn;
	    };

	    return _class;
	  }(Base);
	};

	var AbstractTexture = function () {
	  function AbstractTexture(config, resLoader) {
	    var _this = this;

	    if (isFunction(config)) {
	      this._texture = config;
	      config = this.config = {};

	      for (var p in this._texture) {
	        if (this._texture.hasOwnProperty(p)) {
	          if (!isFunction(this._texture[p])) {
	            config[p] = this._texture[p];
	          }
	        }
	      }
	    } else {
	      this.config = config || {};
	      this.resLoader = resLoader;

	      if ((config.url || config.promise) && !config.data) {
	        this._loading = true;

	        var _self = this;

	        var _promise;

	        if (config.promise) {
	          _promise = config.promise;
	        } else {
	          var loadFn;

	          if (config.arrayBuffer) {
	            loadFn = resLoader.getArrayBuffer;
	          } else {
	            loadFn = resLoader.get;
	          }

	          _promise = loadFn.call(resLoader, config.url);
	        }

	        config.data = resLoader.getDefaultTexture(config.url);
	        this.promise = _promise;

	        _promise.then(function (data) {
	          if (data.data instanceof Image && _this._needPowerOf2()) {
	            data.data = resize(data.data);
	          }

	          delete _this.promise;
	          _self._loading = false;

	          if (!_self.config) {
	            return data;
	          }

	          _self.onLoad(data);

	          if (!Array.isArray(data)) {
	            data = [data];
	          }

	          _self.fire('complete', {
	            target: _this,
	            resources: data
	          });

	          return data;
	        }).catch(function (err) {
	          console.error('error when loading texture image.', err);
	        });
	      }
	    }
	  }

	  var _proto2 = AbstractTexture.prototype;

	  _proto2.isReady = function isReady() {
	    return !this._loading;
	  };

	  _proto2.set = function set(k, v) {
	    this.config[k] = v;
	    this.dirty = true;
	    return this;
	  };

	  _proto2.get = function get(k) {
	    return this.config[k];
	  };

	  _proto2.getREGLTexture = function getREGLTexture(regl) {
	    if (!this._texture) {
	      this._texture = this.createREGLTexture(regl);
	    }

	    if (this.dirty) {
	      this._updateREGL();
	    }

	    return this._texture;
	  };

	  _proto2._updateREGL = function _updateREGL() {
	    if (this._texture) {
	      this._texture(this.config);
	    }

	    this.dirty = false;
	  };

	  _proto2.dispose = function dispose() {
	    if (this.config.url) {
	      this.resLoader.disposeRes(this.config.url);
	    }

	    if (this._texture && !this._texture['__destroyed']) {
	      this._texture.destroy();

	      this._texture['__destroyed'] = true;
	    }

	    delete this.resLoader;
	    this.fire('disposed', {
	      target: this,
	      url: this.config.url
	    });
	    delete this.config;
	  };

	  _proto2._needPowerOf2 = function _needPowerOf2() {
	    var config = this.config;
	    var isRepeat = config.wrap && config.wrap !== 'clamp' || config.wrapS && config.wrapS !== 'clamp' || config.wrapT && config.wrapT !== 'clamp';
	    return isRepeat || config.min && config.min !== 'nearest' && config.min !== 'linear';
	  };

	  return AbstractTexture;
	}();

	var Texture = Eventable(AbstractTexture);

	function resize(image) {
	  if (isPowerOfTwo(image.width) && isPowerOfTwo(image.height)) {
	    return image;
	  }

	  var width = image.width;
	  var height = image.height;

	  if (!isPowerOfTwo(width)) {
	    width = floorPowerOfTwo(width);
	  }

	  if (!isPowerOfTwo(height)) {
	    height = floorPowerOfTwo(height);
	  }

	  var canvas = document.createElement('canvas');
	  canvas.width = width;
	  canvas.height = height;
	  canvas.getContext('2d').drawImage(image, 0, 0, width, height);
	  var url = image.src;
	  var idx = url.lastIndexOf('/') + 1;
	  var filename = url.substring(idx);
	  console.warn("Texture(" + filename + ")'s size is not power of two, resize from (" + image.width + ", " + image.height + ") to (" + width + ", " + height + ")");
	  return canvas;
	}

	function isPowerOfTwo(value) {
	  return (value & value - 1) === 0 && value !== 0;
	}

	function floorPowerOfTwo(value) {
	  return Math.pow(2, Math.floor(Math.log(value) / Math.LN2));
	}

	var Renderer = function () {
	  function Renderer(regl) {
	    this.regl = regl;
	  }

	  var _proto3 = Renderer.prototype;

	  _proto3.render = function render(shader, uniforms, scene, framebuffer) {
	    shader.setUniforms(uniforms || {});
	    shader.setFramebuffer(framebuffer);

	    if (scene) {
	      var _scene$getSortedMeshe = scene.getSortedMeshes(),
	          opaques = _scene$getSortedMeshe.opaques,
	          transparents = _scene$getSortedMeshe.transparents;

	      shader.draw(this.regl, opaques);
	      shader.draw(this.regl, transparents);
	    } else {
	      shader.draw(this.regl);
	    }

	    return this;
	  };

	  _proto3.clear = function clear(options) {
	    this.regl.clear(options);
	  };

	  return Renderer;
	}();

	var DeferredRenderer = function (_Renderer) {
	  _inheritsLoose(DeferredRenderer, _Renderer);

	  function DeferredRenderer() {
	    return _Renderer.apply(this, arguments) || this;
	  }

	  return DeferredRenderer;
	}(Renderer);

	var CHAR_BIT = 8;
	var MAT0 = [];
	var TMP0 = [];
	var TMP1 = [];
	var TMP2 = [];

	function packTangentFrame(q, n, t) {
	  var c = cross(TMP0, n, t);
	  var mat = toMat3.apply(void 0, [MAT0, t[0], t[1], t[2]].concat(c, n));
	  q = fromMat3(q, mat);
	  q = normalize$2(q, q);
	  q = positive(q);
	  var storageSize = 2;
	  var bias = 1 / ((1 << storageSize * CHAR_BIT - 1) - 1);

	  if (q[3] < bias) {
	    q[3] = bias;
	    var factor = Math.sqrt(1.0 - bias * bias);
	    q[0] *= factor;
	    q[1] *= factor;
	    q[2] *= factor;
	  }

	  var b = t[3] > 0 ? cross(TMP1, t, n) : cross(TMP1, n, t);
	  var cc = cross(TMP2, t, n);

	  if (dot(cc, b) < 0) {
	    scale$6(q, q, -1);
	  }

	  return q;
	}

	function toMat3(out, c00, c01, c02, c10, c11, c12, c20, c21, c22) {
	  out[0] = c00;
	  out[1] = c01;
	  out[2] = c02;
	  out[3] = c10;
	  out[4] = c11;
	  out[5] = c12;
	  out[6] = c20;
	  out[7] = c21;
	  out[8] = c22;
	  return out;
	}

	function positive(q) {
	  if (q[3] < 0) {
	    return scale$6(q, q, -1);
	  } else {
	    return q;
	  }
	}

	function buildTangents(positions, normals, uvs, indices) {
	  var nVertices = positions.length / 3;
	  var tangents = new Array(4 * nVertices);
	  var tan1 = [],
	      tan2 = [];

	  for (var i = 0; i < nVertices; i++) {
	    tan1[i] = [0, 0, 0];
	    tan2[i] = [0, 0, 0];
	  }

	  var vA = [0, 0, 0],
	      vB = [0, 0, 0],
	      vC = [0, 0, 0],
	      uvA = [0, 0],
	      uvB = [0, 0],
	      uvC = [0, 0],
	      sdir = [0, 0, 0],
	      tdir = [0, 0, 0];

	  function handleTriangle(a, b, c) {
	    fromArray3(vA, positions, a * 3);
	    fromArray3(vB, positions, b * 3);
	    fromArray3(vC, positions, c * 3);
	    fromArray2(uvA, uvs, a * 2);
	    fromArray2(uvB, uvs, b * 2);
	    fromArray2(uvC, uvs, c * 2);
	    var x1 = vB[0] - vA[0];
	    var x2 = vC[0] - vA[0];
	    var y1 = vB[1] - vA[1];
	    var y2 = vC[1] - vA[1];
	    var z1 = vB[2] - vA[2];
	    var z2 = vC[2] - vA[2];
	    var s1 = uvB[0] - uvA[0];
	    var s2 = uvC[0] - uvA[0];
	    var t1 = uvB[1] - uvA[1];
	    var t2 = uvC[1] - uvA[1];
	    var r = 1.0 / (s1 * t2 - s2 * t1);
	    set$5(sdir, (t2 * x1 - t1 * x2) * r, (t2 * y1 - t1 * y2) * r, (t2 * z1 - t1 * z2) * r);
	    set$5(tdir, (s1 * x2 - s2 * x1) * r, (s1 * y2 - s2 * y1) * r, (s1 * z2 - s2 * z1) * r);
	    add$4(tan1[a], tan1[a], sdir);
	    add$4(tan1[b], tan1[b], sdir);
	    add$4(tan1[c], tan1[c], sdir);
	    add$4(tan2[a], tan2[a], tdir);
	    add$4(tan2[b], tan2[b], tdir);
	    add$4(tan2[c], tan2[c], tdir);
	  }

	  for (var j = 0, jl = indices.length; j < jl; j += 3) {
	    handleTriangle(indices[j + 0], indices[j + 1], indices[j + 2]);
	  }

	  var tmp = [],
	      tmp2 = [];
	  var n = [],
	      n2 = [];
	  var w, t, test;

	  function handleVertex(v) {
	    fromArray3(n, normals, v * 3);
	    copy$4(n2, n);
	    t = tan1[v];
	    copy$4(tmp, t);
	    sub$4(tmp, tmp, scale$4(n, n, dot(n, t)));
	    normalize(tmp, tmp);
	    cross(tmp2, n2, t);
	    test = dot(tmp2, tan2[v]);
	    w = test < 0.0 ? -1.0 : 1.0;
	    tangents[v * 4] = tmp[0];
	    tangents[v * 4 + 1] = tmp[1];
	    tangents[v * 4 + 2] = tmp[2];
	    tangents[v * 4 + 3] = w;
	  }

	  for (var _j = 0, _jl = indices.length; _j < _jl; _j += 3) {
	    handleVertex(indices[_j + 0]);
	    handleVertex(indices[_j + 1]);
	    handleVertex(indices[_j + 2]);
	  }

	  return tangents;
	}

	function fromArray3(out, array, offset) {
	  out[0] = array[offset];
	  out[1] = array[offset + 1];
	  out[2] = array[offset + 2];
	  return out;
	}

	function fromArray2(out, array, offset) {
	  out[0] = array[offset];
	  out[1] = array[offset + 1];
	  return out;
	}

	var BoundingBox = function () {
	  function BoundingBox(min$$1, max$$1) {
	    this.min = min$$1 || [Infinity, Infinity, Infinity];
	    this.max = max$$1 || [-Infinity, -Infinity, -Infinity];
	  }

	  var _proto4 = BoundingBox.prototype;

	  _proto4.dirty = function dirty() {
	    this._dirty = true;
	    return this;
	  };

	  _proto4.getCenter = function getCenter() {
	    if (!this.center) {
	      this.center = [];
	      this._dirty = true;
	    }

	    if (this._dirty) {
	      add$4(this.center, this.min, this.max);
	      scale$4(this.center, this.center, 0.5);
	    }

	    this._dirty = false;
	    return this.center;
	  };

	  _proto4.containPoint = function containPoint(p) {
	    var min$$1 = this.min;
	    var max$$1 = this.max;
	    return min$$1[0] <= p[0] && min$$1[1] <= p[1] && min$$1[2] <= p[2] && max$$1[0] >= p[0] && max$$1[1] >= p[1] && max$$1[2] >= p[2];
	  };

	  _proto4.isFinite = function (_isFinite) {
	    function isFinite() {
	      return _isFinite.apply(this, arguments);
	    }

	    isFinite.toString = function () {
	      return _isFinite.toString();
	    };

	    return isFinite;
	  }(function () {
	    var min$$1 = this.min;
	    var max$$1 = this.max;
	    return isFinite(min$$1[0]) && isFinite(min$$1[1]) && isFinite(min$$1[2]) && isFinite(max$$1[0]) && isFinite(max$$1[1]) && isFinite(max$$1[2]);
	  });

	  return BoundingBox;
	}();

	var DEFAULT_DESC = {
	  'positionSize': 3,
	  'primitive': 'triangles',
	  'positionAttribute': 'aPosition',
	  'normalAttribute': 'aNormal',
	  'uv0Attribute': 'aTexCoord'
	};

	var Geometry = function () {
	  function Geometry(data, elements, count, desc) {
	    this.data = data;
	    this.elements = elements;
	    this.desc = extend({}, DEFAULT_DESC, desc);
	    var pos = data[this.desc.positionAttribute];

	    if (!count) {
	      if (elements) {
	        count = getElementLength(elements);
	      } else if (pos && pos.length) {
	        count = pos.length / this.desc.positionSize;
	      }
	    }

	    this.count = count;

	    if (!this.elements) {
	      this.elements = count;
	    }

	    this.properties = {};
	    this._buffers = {};
	    this.updateBoundingBox();
	  }

	  var _proto5 = Geometry.prototype;

	  _proto5.generateBuffers = function generateBuffers(regl) {
	    var allocatedBuffers = this._buffers;

	    for (var p in allocatedBuffers) {
	      if (!allocatedBuffers[p].buffer) {
	        allocatedBuffers[p].buffer = regl.buffer(allocatedBuffers[p].data);
	      }

	      delete allocatedBuffers[p].data;
	    }

	    var data = this.data;
	    var buffers = {};

	    for (var key in data) {
	      if (!data[key]) {
	        continue;
	      }

	      if (data[key].buffer !== undefined && !(data[key].buffer instanceof ArrayBuffer)) {
	        if (data[key].buffer.destroy) {
	          buffers[key] = data[key];
	        } else if (allocatedBuffers[data[key].buffer]) {
	          buffers[key] = extend({}, data[key]);
	          buffers[key].buffer = allocatedBuffers[data[key].buffer].buffer;
	        }
	      } else {
	        buffers[key] = {
	          buffer: regl.buffer(data[key])
	        };
	      }
	    }

	    this.data = buffers;

	    if (this.elements && !isNumber(this.elements)) {
	      this.elements = this.elements.destroy ? this.elements : regl.elements({
	        primitive: this.getPrimitive(),
	        data: this.elements
	      });
	    }
	  };

	  _proto5.addBuffer = function addBuffer(key, data) {
	    this._buffers[key] = {
	      data: data
	    };
	    return this;
	  };

	  _proto5.updateBuffer = function updateBuffer(key, data) {
	    if (!this._buffers[key]) {
	      throw new Error("invalid buffer " + key + " in geometry");
	    }

	    if (this._buffers[key].buffer) {
	      this._buffers[key].buffer.subdata(data);
	    } else {
	      this._buffers[key].data = data;
	    }

	    return this;
	  };

	  _proto5.updateData = function updateData(name, data) {
	    var buf = this.data[name];

	    if (!buf) {
	      return this;
	    }

	    var buffer;
	    this.data[name] = data;

	    if (buf.buffer && buf.buffer.destroy) {
	      buffer = buf;
	    }

	    if (name === this.desc.positionAttribute) {
	      this.updateBoundingBox();
	    }

	    if (buffer) {
	      buffer.buffer.subdata(data);
	      this.data[name] = buffer;
	    }

	    return this;
	  };

	  _proto5.getPrimitive = function getPrimitive() {
	    return this.desc.primitive;
	  };

	  _proto5.getAttributes = function getAttributes() {
	    return Object.keys(this.data);
	  };

	  _proto5.getElements = function getElements() {
	    return this.elements;
	  };

	  _proto5.setElements = function setElements(elements, count) {
	    if (!elements) {
	      throw new Error('elements data is invalid');
	    }

	    var e = this.elements;
	    this.count = count === undefined ? getElementLength(elements) : count;

	    if (e.destroy) {
	      this.elements = e(elements);
	    } else {
	      this.elements = elements;
	    }

	    return this;
	  };

	  _proto5.setDrawCount = function setDrawCount(count) {
	    this.count1 = count;
	    return this;
	  };

	  _proto5.getDrawCount = function getDrawCount() {
	    return this.count1 || this.count;
	  };

	  _proto5.setDrawOffset = function setDrawOffset(offset) {
	    this.offset = offset;
	    return this;
	  };

	  _proto5.getDrawOffset = function getDrawOffset() {
	    return this.offset || 0;
	  };

	  _proto5.dispose = function dispose() {
	    this._forEachBuffer(function (buffer) {
	      if (!buffer['__reshader_disposed']) {
	        buffer['__reshader_disposed'] = true;
	        buffer.destroy();
	      }
	    });

	    this.data = {};
	    this._buffers = {};
	    this.count = 0;
	    this.elements = [];
	    this._disposed = true;
	  };

	  _proto5.isDisposed = function isDisposed() {
	    return !!this._disposed;
	  };

	  _proto5.updateBoundingBox = function updateBoundingBox() {
	    var bbox = this.boundingBox;

	    if (!bbox) {
	      bbox = this.boundingBox = new BoundingBox();
	    }

	    var posAttr = this.desc.positionAttribute;
	    var posArr = this.data[posAttr];

	    if (!isArray(posArr)) {
	      posArr = posArr.data;
	    }

	    if (posArr && posArr.length) {
	      var _min = bbox.min;
	      var _max = bbox.max;
	      set$5(_min, posArr[0], posArr[1], posArr[2]);
	      set$5(_max, posArr[0], posArr[1], posArr[2]);

	      for (var i = 3; i < posArr.length;) {
	        var x = posArr[i++];
	        var y = posArr[i++];
	        var z = posArr[i++];

	        if (x < _min[0]) {
	          _min[0] = x;
	        }

	        if (y < _min[1]) {
	          _min[1] = y;
	        }

	        if (z < _min[2]) {
	          _min[2] = z;
	        }

	        if (x > _max[0]) {
	          _max[0] = x;
	        }

	        if (y > _max[1]) {
	          _max[1] = y;
	        }

	        if (z > _max[2]) {
	          _max[2] = z;
	        }
	      }

	      bbox.dirty();
	    }
	  };

	  _proto5.createTangent = function createTangent(name) {
	    if (name === void 0) {
	      name = 'aTangent';
	    }

	    var normals = this.data[this.desc.normalAttribute];
	    var tangents = buildTangents(this.data[this.desc.positionAttribute], normals, this.data[this.desc.uv0Attribute], this.elements);
	    var aTangent = this.data[name] = new Float32Array(tangents.length);
	    var t = [],
	        n = [],
	        q = [];

	    for (var i = 0; i < tangents.length; i += 4) {
	      var ni = i / 4 * 3;
	      set$5(n, normals[ni], normals[ni + 1], normals[ni + 2]);
	      set$6(t, tangents[i], tangents[i + 1], tangents[i + 2], tangents[i + 3]);
	      packTangentFrame(q, n, t);
	      copy$5(aTangent.subarray(i, i + 4), q);
	    }
	  };

	  _proto5.createBarycentric = function createBarycentric(name) {
	    if (name === void 0) {
	      name = 'aBarycentric';
	    }

	    var position = this.data[this.desc.positionAttribute];

	    if (!isArray(position)) {
	      throw new Error('Position data must be an array to create bary centric data');
	    } else if (this.desc.primitive !== 'triangles') {
	      throw new Error('Primitive must be triangles to create bary centric data');
	    }

	    var bary = new Uint8Array(position.length / this.desc.positionSize * 3);

	    for (var i = 0, l = this.elements.length; i < l;) {
	      for (var j = 0; j < 3; j++) {
	        var ii = this.elements[i++];
	        bary[ii * 3 + j] = 1;
	      }
	    }

	    this.data[name] = bary;
	  };

	  _proto5.buildUniqueVertex = function buildUniqueVertex() {
	    var data = this.data;
	    var indices = this.elements;

	    if (!isArray(indices)) {
	      throw new Error('elements must be array to build unique vertex.');
	    }

	    var keys = Object.keys(data);
	    var oldData = {};
	    var pos = data[this.desc.positionAttribute];

	    if (!isArray(pos)) {
	      throw new Error(this.desc.positionAttribute + ' must be array to build unique vertex.');
	    }

	    var vertexCount = pos.length / this.desc.positionSize;
	    var l = indices.length;

	    for (var i = 0; i < keys.length; i++) {
	      var name = keys[i];
	      var size = data[name].length / vertexCount;

	      if (!isArray(data[name])) {
	        throw new Error(name + ' must be array to build unique vertex.');
	      }

	      oldData[name] = data[name];
	      oldData[name].size = size;
	      data[name] = new data[name].constructor(l * size);
	    }

	    var cursor = 0;

	    for (var _i3 = 0; _i3 < l; _i3++) {
	      var idx = indices[_i3];

	      for (var ii = 0; ii < keys.length; ii++) {
	        var _name = keys[ii];
	        var array = data[_name];
	        var _size = oldData[_name].size;

	        for (var k = 0; k < _size; k++) {
	          array[cursor * _size + k] = oldData[_name][idx * _size + k];
	        }
	      }

	      indices[_i3] = cursor++;
	    }
	  };

	  _proto5.getMemorySize = function getMemorySize() {
	    var size = 0;

	    for (var p in this.data) {
	      if (this.data.hasOwnProperty(p)) {
	        var buffer = this.data[p];

	        if (buffer.data) {
	          size += buffer.data.length * buffer.data.BYTES_PER_ELEMENT;
	        } else {
	          size += buffer.length * buffer.BYTES_PER_ELEMENT;
	        }
	      }
	    }

	    return size;
	  };

	  _proto5._forEachBuffer = function _forEachBuffer(fn) {
	    if (this.elements && this.elements.destroy) {
	      fn(this.elements);
	    }

	    for (var p in this.data) {
	      if (this.data.hasOwnProperty(p)) {
	        if (this.data[p] && this.data[p].buffer && this.data[p].buffer.destroy) {
	          fn(this.data[p].buffer);
	        }
	      }
	    }

	    for (var _p in this._buffers) {
	      if (this._buffers.hasOwnProperty(_p)) {
	        if (this._buffers[_p] && this._buffers[_p].buffer && this._buffers[_p].buffer.destroy) {
	          fn(this._buffers[_p].buffer);
	        }
	      }
	    }
	  };

	  return Geometry;
	}();

	function getElementLength(elements) {
	  if (isNumber(elements)) {
	    return elements;
	  } else if (elements.length !== undefined) {
	    return elements.length;
	  } else if (elements.data) {
	    return elements.data.length;
	  }

	  throw new Error('invalid elements length');
	}

	var Material = function () {
	  function Material(uniforms, defaultUniforms) {
	    if (uniforms === void 0) {
	      uniforms = {};
	    }

	    this.uniforms = extend({}, defaultUniforms || {}, uniforms);

	    for (var p in uniforms) {
	      var getter = Object.getOwnPropertyDescriptor(uniforms, p).get;

	      if (getter) {
	        Object.defineProperty(this.uniforms, p, {
	          get: getter
	        });
	      }
	    }

	    this._dirtyUniforms = 'texture';
	    this.dirtyDefines = true;
	    this._reglUniforms = {};
	    this.refCount = 0;
	    this._bindedOnTextureComplete = this._onTextureComplete.bind(this);

	    this._checkTextures();
	  }

	  var _proto6 = Material.prototype;

	  _proto6.isReady = function isReady() {
	    return this._loadingCount <= 0;
	  };

	  _proto6.set = function set(k, v) {
	    this.uniforms[k] = v;
	    this._dirtyUniforms = this.isTexture(k) ? 'texture' : 'primitive';

	    if (this._dirtyUniforms === 'texture') {
	      this._checkTextures();
	    }

	    return this;
	  };

	  _proto6.get = function get(k) {
	    return this.uniforms[k];
	  };

	  _proto6.isDirty = function isDirty() {
	    return this._dirtyUniforms || this.dirtyDefines;
	  };

	  _proto6.getDefines = function getDefines() {
	    if (!this.dirtyDefines) {
	      return this._defines;
	    }

	    if (this.createDefines) {
	      this._defines = this.createDefines();
	    } else {
	      this._defines = {};
	    }

	    this.dirtyDefines = false;
	    return this._defines;
	  };

	  _proto6.getUniforms = function getUniforms(regl) {
	    var _this2 = this;

	    if (!this._dirtyUniforms) {
	      return this._reglUniforms;
	    }

	    var uniforms = this.uniforms;
	    var realUniforms = {};

	    var _loop = function _loop(p) {
	      var v = _this2.uniforms[p];

	      if (_this2.isTexture(p)) {
	        if (_this2._dirtyUniforms === 'primitive' && _this2._reglUniforms[p]) {
	          realUniforms[p] = _this2._reglUniforms[p];
	        } else {
	          if (_this2._reglUniforms[p]) {
	            _this2._reglUniforms[p].destroy();
	          }

	          realUniforms[p] = v.getREGLTexture(regl);
	        }
	      } else {
	        Object.defineProperty(realUniforms, p, {
	          enumerable: true,
	          configurable: true,
	          get: function get() {
	            return uniforms && uniforms[p];
	          }
	        });
	      }
	    };

	    for (var p in uniforms) {
	      _loop(p);
	    }

	    this._reglUniforms = realUniforms;
	    this._dirtyUniforms = false;
	    return realUniforms;
	  };

	  _proto6.isTexture = function isTexture(k) {
	    var v = this.uniforms[k];

	    if (v instanceof Texture) {
	      return true;
	    }

	    return false;
	  };

	  _proto6.dispose = function dispose() {
	    for (var p in this.uniforms) {
	      var u = this.uniforms[p];

	      if (u) {
	        if (u.dispose) {
	          u.dispose();
	        } else if (u.destroy && !u['__destroyed']) {
	          u.destroy();
	          u['__destroyed'] = true;
	        }
	      }
	    }

	    delete this.uniforms;
	    delete this._reglUniforms;
	    this._disposed = true;
	  };

	  _proto6.isDisposed = function isDisposed() {
	    return !!this._disposed;
	  };

	  _proto6._checkTextures = function _checkTextures() {
	    this._loadingCount = 0;

	    for (var p in this.uniforms) {
	      if (this.isTexture(p)) {
	        var texture = this.uniforms[p];

	        if (!texture.isReady()) {
	          this._loadingCount++;
	          texture.on('complete', this._bindedOnTextureComplete);
	        }
	      }
	    }
	  };

	  _proto6._onTextureComplete = function _onTextureComplete() {
	    this._loadingCount--;

	    if (this._loadingCount <= 0) {
	      this.fire('complete');
	    }
	  };

	  return Material;
	}();

	var Material$1 = Eventable(Material);
	var defaultUniforms = {
	  'time': 0,
	  'seeThrough': true,
	  'thickness': 0.03,
	  'fill': [1.0, 0.5137254902, 0.98, 1.0],
	  'stroke': [0.7019607843, 0.9333333333, 0.2274509804, 1.0],
	  'dashEnabled': false,
	  'dashAnimate': false,
	  'dashRepeats': 1,
	  'dashLength': 0.8,
	  'dashOverlap': true,
	  'insideAltColor': false,
	  'squeeze': false,
	  'squeezeMin': 0.5,
	  'squeezeMax': 1,
	  'dualStroke': false,
	  'secondThickness': 0.05,
	  'opacity': 1.0
	};

	var WireFrameMaterial = function (_Material$) {
	  _inheritsLoose(WireFrameMaterial, _Material$);

	  function WireFrameMaterial(uniforms) {
	    return _Material$.call(this, uniforms, defaultUniforms) || this;
	  }

	  return WireFrameMaterial;
	}(Material$1);

	var defaultUniforms$1 = {
	  'lightPosition': [0.0, 0.0, 50.0],
	  'lightAmbient': [0.5, 0.5, 0.5, 1.0],
	  'lightDiffuse': [0.8, 0.8, 0.8, 1.0],
	  'lightSpecular': [1.0, 1.0, 1.0, 1.0],
	  'materialShininess': 32.0,
	  'ambientStrength': 0.5,
	  'specularStrength': 0.8,
	  'opacity': 1.0
	};

	var PhongMaterial = function (_Material$2) {
	  _inheritsLoose(PhongMaterial, _Material$2);

	  function PhongMaterial(uniforms) {
	    return _Material$2.call(this, uniforms, defaultUniforms$1) || this;
	  }

	  return PhongMaterial;
	}(Material$1);

	var Mesh = function () {
	  function Mesh(geometry, material, config) {
	    if (config === void 0) {
	      config = {};
	    }

	    this.geometry = geometry;
	    this.material = material;
	    this.config = config;
	    this.transparent = !!config.transparent;
	    this.castShadow = isNil(config.castShadow) || config.castShadow;
	    this.picking = !!config.picking;
	    this.uniforms = {};
	    this.localTransform = identity$3(new Array(16));
	    this.properties = {};
	    this._dirtyUniforms = true;
	  }

	  var _proto7 = Mesh.prototype;

	  _proto7.setParent = function setParent() {
	    this.parent = parent;
	    return this;
	  };

	  _proto7.setLocalTransform = function setLocalTransform(transform) {
	    this.localTransform = transform;
	    return this;
	  };

	  _proto7.setUniform = function setUniform(k, v) {
	    if (this.uniforms[k] === undefined) {
	      this._dirtyUniforms = true;
	    }

	    this.uniforms[k] = v;
	    return this;
	  };

	  _proto7.getUniform = function getUniform(k) {
	    return this.uniforms[k];
	  };

	  _proto7.getDefines = function getDefines() {
	    var defines = {};

	    if (this.defines) {
	      extend(defines, this.defines);
	    }

	    if (this.material) {
	      var mDefines = this.material.getDefines();

	      if (mDefines) {
	        extend(defines, mDefines);
	      }
	    }

	    return defines;
	  };

	  _proto7.setDefines = function setDefines(defines) {
	    this.defines = defines;
	    this.dirtyDefines = true;
	    return this;
	  };

	  _proto7.getDefinesKey = function getDefinesKey() {
	    if (this._definesKey !== undefined && !this.dirtyDefines && (!this.material || !this.material.dirtyDefines)) {
	      return this._definesKey;
	    }

	    this._definesKey = this._createDefinesKey(this.getDefines());
	    this.dirtyDefines = false;
	    return this._definesKey;
	  };

	  _proto7.getUniforms = function getUniforms(regl) {
	    var _this3 = this;

	    if (this._dirtyUniforms || this.material && this.material.isDirty()) {
	      (function () {
	        _this3._realUniforms = {};
	        var uniforms = _this3.uniforms;

	        var _loop2 = function _loop2(p) {
	          if (_this3.uniforms.hasOwnProperty(p)) {
	            Object.defineProperty(_this3._realUniforms, p, {
	              enumerable: true,
	              configurable: true,
	              get: function get() {
	                return uniforms && uniforms[p];
	              }
	            });
	          }
	        };

	        for (var p in _this3.uniforms) {
	          _loop2(p);
	        }

	        if (_this3.material) {
	          (function () {
	            var materialUniforms = _this3.material.getUniforms(regl);

	            var _loop3 = function _loop3(p) {
	              if (materialUniforms.hasOwnProperty(p)) {
	                Object.defineProperty(_this3._realUniforms, p, {
	                  enumerable: true,
	                  configurable: true,
	                  get: function get() {
	                    return materialUniforms && materialUniforms[p];
	                  }
	                });
	              }
	            };

	            for (var p in materialUniforms) {
	              _loop3(p);
	            }
	          })();
	        }

	        _this3._dirtyUniforms = false;
	      })();
	    }

	    this._realUniforms['modelMatrix'] = this.localTransform;
	    return this._realUniforms;
	  };

	  _proto7.getMaterial = function getMaterial() {
	    return this.material;
	  };

	  _proto7.getAttributes = function getAttributes() {
	    return this.geometry.getAttributes();
	  };

	  _proto7.getElements = function getElements() {
	    return this.geometry.getElements();
	  };

	  _proto7.getREGLProps = function getREGLProps(regl) {
	    var props = this.getUniforms(regl);
	    extend(props, this.geometry.data);
	    props.elements = this.geometry.getElements();
	    props.count = this.geometry.getDrawCount();
	    props.offset = this.geometry.getDrawOffset();
	    props.primitive = this.geometry.getPrimitive();
	    return props;
	  };

	  _proto7.dispose = function dispose() {
	    delete this.geometry;
	    delete this.material;
	    this.uniforms = {};
	    return this;
	  };

	  _proto7.isValid = function isValid() {
	    return this.geometry && !this.geometry.isDisposed() && (!this.material || !this.material.isDisposed());
	  };

	  _proto7._createDefinesKey = function _createDefinesKey(defines) {
	    var v = [];

	    for (var p in defines) {
	      v.push(p, defines[p]);
	    }

	    return v.join(',');
	  };

	  return Mesh;
	}();

	Mesh.prototype.getWorldTransform = function () {
	  var worldTransform = [];
	  return function () {
	    if (parent) {
	      return multiply$3(worldTransform, parent.getWorldTransform(), this.localTransform);
	    }

	    return this.localTransform;
	  };
	}();

	var InstancedMesh = function (_Mesh) {
	  _inheritsLoose(InstancedMesh, _Mesh);

	  function InstancedMesh(instancedData, instanceCount, geometry, material, config) {
	    var _this4;

	    if (config === void 0) {
	      config = {};
	    }

	    _this4 = _Mesh.call(this, geometry, material, config) || this;
	    _this4.instanceCount = instanceCount;
	    _this4.instancedData = instancedData || {};

	    _this4._checkInstancedProp();

	    return _this4;
	  }

	  var _proto8 = InstancedMesh.prototype;

	  _proto8._checkInstancedProp = function _checkInstancedProp() {
	    for (var p in this.instancedData) {
	      if (this.geometry.data[p]) {
	        throw new Error("Duplicate attribute " + p + " defined in geometry and instanced data");
	      }
	    }
	  };

	  _proto8.getAttributes = function getAttributes() {
	    var attributes = _Mesh.prototype.getAttributes.call(this);

	    for (var p in this.instancedData) {
	      attributes.push(p);
	    }

	    return attributes;
	  };

	  _proto8.updateInstancedData = function updateInstancedData(name, data) {
	    var buf = this.instancedData[name];

	    if (!buf) {
	      return this;
	    }

	    var buffer;
	    this.instancedData[name] = data;

	    if (buf.buffer && buf.buffer.destroy) {
	      buffer = buf;
	    }

	    if (buffer) {
	      var bytesPerElement = this._getBytesPerElement(buffer.buffer._buffer.dtype);

	      var _len = buffer.buffer._buffer.byteLength / bytesPerElement;

	      if (_len >= data.length && bytesPerElement >= (data.BYTES_PER_ELEMENT || 0)) {
	        buffer.buffer.subdata(data);
	      } else {
	        buffer.buffer(data);
	      }

	      this.instancedData[name] = buffer;
	    }

	    return this;
	  };

	  _proto8.generateInstancedBuffers = function generateInstancedBuffers(regl) {
	    var data = this.instancedData;
	    var buffers = {};

	    for (var key in data) {
	      if (!data[key]) {
	        continue;
	      }

	      if (data[key].buffer !== undefined && data[key].buffer.destroy) {
	        buffers[key] = data[key];

	        if (buffers[key].divisor) {
	          buffers[key].divisor = 1;
	        }
	      } else {
	        buffers[key] = {
	          buffer: regl.buffer(data[key]),
	          divisor: 1
	        };
	      }
	    }

	    this.instancedData = buffers;
	    return this;
	  };

	  _proto8.getREGLProps = function getREGLProps(regl) {
	    var props = _Mesh.prototype.getREGLProps.call(this, regl);

	    extend(props, this.instancedData);
	    props.instances = this.instanceCount;
	    return props;
	  };

	  _proto8._getBytesPerElement = function _getBytesPerElement(dtype) {
	    switch (dtype) {
	      case 0x1400:
	        return 1;

	      case 0x1401:
	        return 1;

	      case 0x1402:
	        return 2;

	      case 0x1403:
	        return 2;

	      case 0x1404:
	        return 4;

	      case 0x1405:
	        return 4;

	      case 0x1406:
	        return 4;
	    }

	    throw new Error('unsupported data type: ' + dtype);
	  };

	  return InstancedMesh;
	}(Mesh);

	var Ajax = {
	  getArrayBuffer: function getArrayBuffer(url, cb) {
	    return Ajax.get(url, {
	      responseType: 'arraybuffer'
	    }, cb);
	  },
	  get: function get(url, options, cb) {
	    var client = Ajax._getClient(cb);

	    client.open('GET', url, true);

	    if (options) {
	      for (var k in options.headers) {
	        client.setRequestHeader(k, options.headers[k]);
	      }

	      client.withCredentials = options.credentials === 'include';

	      if (options['responseType']) {
	        client.responseType = options['responseType'];
	      }
	    }

	    client.send(null);
	    return client;
	  },
	  _wrapCallback: function _wrapCallback(client, cb) {
	    return function () {
	      if (client.readyState === 4) {
	        if (client.status === 200) {
	          if (client.responseType === 'arraybuffer') {
	            var response = client.response;

	            if (response.byteLength === 0) {
	              cb(new Error('http status 200 returned without content.'));
	            } else {
	              cb(null, {
	                data: client.response,
	                cacheControl: client.getResponseHeader('Cache-Control'),
	                expires: client.getResponseHeader('Expires'),
	                contentType: client.getResponseHeader('Content-Type')
	              });
	            }
	          } else {
	            cb(null, client.responseText);
	          }
	        } else {
	          cb(new Error(client.statusText + ',' + client.status));
	        }
	      }
	    };
	  },
	  _getClient: function _getClient(cb) {
	    var client;

	    try {
	      client = new XMLHttpRequest();
	    } catch (e) {
	      try {
	        client = new ActiveXObject('Msxml2.XMLHTTP');
	      } catch (e) {
	        try {
	          client = new ActiveXObject('Microsoft.XMLHTTP');
	        } catch (e) {}
	      }
	    }

	    client.onreadystatechange = Ajax._wrapCallback(client, cb);
	    return client;
	  }
	};
	var commonjsGlobal$1 = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

	function createCommonjsModule$1(fn, module) {
	  return module = {
	    exports: {}
	  }, fn(module, module.exports), module.exports;
	}

	var zousanMin = createCommonjsModule$1(function (module) {
	  !function (i) {
	    var c,
	        s,
	        u = "fulfilled",
	        f = "undefined",
	        a = function () {
	      var e = [],
	          n = 0;

	      function o() {
	        for (; e.length - n;) {
	          try {
	            e[n]();
	          } catch (t) {
	            i.console && i.console.error(t);
	          }

	          e[n++] = s, 1024 == n && (e.splice(0, 1024), n = 0);
	        }
	      }

	      var r = function () {
	        if (typeof MutationObserver === f) return typeof process !== f && "function" == typeof process.nextTick ? function () {
	          process.nextTick(o);
	        } : typeof setImmediate !== f ? function () {
	          setImmediate(o);
	        } : function () {
	          setTimeout(o, 0);
	        };
	        var t = document.createElement("div");
	        return new MutationObserver(o).observe(t, {
	          attributes: !0
	        }), function () {
	          t.setAttribute("a", 0);
	        };
	      }();

	      return function (t) {
	        e.push(t), e.length - n == 1 && r();
	      };
	    }();

	    function l(t) {
	      if (!(this instanceof l)) throw new TypeError("Zousan must be created with the new keyword");

	      if ("function" == typeof t) {
	        var e = this;

	        try {
	          t(function (t) {
	            e.resolve(t);
	          }, function (t) {
	            e.reject(t);
	          });
	        } catch (t) {
	          e.reject(t);
	        }
	      } else if (0 < arguments.length) throw new TypeError("Zousan resolver " + t + " is not a function");
	    }

	    function h(e, t) {
	      if ("function" == typeof e.y) try {
	        var n = e.y.call(s, t);
	        e.p.resolve(n);
	      } catch (t) {
	        e.p.reject(t);
	      } else e.p.resolve(t);
	    }

	    function v(e, t) {
	      if ("function" == typeof e.n) try {
	        var n = e.n.call(s, t);
	        e.p.resolve(n);
	      } catch (t) {
	        e.p.reject(t);
	      } else e.p.reject(t);
	    }

	    l.prototype = {
	      resolve: function resolve(n) {
	        if (this.state === c) {
	          if (n === this) return this.reject(new TypeError("Attempt to resolve promise with self"));
	          var o = this;
	          if (n && ("function" == typeof n || "object" == typeof n)) try {
	            var e = !0,
	                t = n.then;
	            if ("function" == typeof t) return void t.call(n, function (t) {
	              e && (e = !1, o.resolve(t));
	            }, function (t) {
	              e && (e = !1, o.reject(t));
	            });
	          } catch (t) {
	            return void (e && this.reject(t));
	          }
	          this.state = u, this.v = n, o.c && a(function () {
	            for (var t = 0, e = o.c.length; t < e; t++) {
	              h(o.c[t], n);
	            }
	          });
	        }
	      },
	      reject: function reject(n) {
	        if (this.state === c) {
	          var t = this;
	          this.state = "rejected", this.v = n;
	          var o = this.c;
	          a(o ? function () {
	            for (var t = 0, e = o.length; t < e; t++) {
	              v(o[t], n);
	            }
	          } : function () {
	            t.handled || !l.suppressUncaughtRejectionError && i.console && l.warn("You upset Zousan. Please catch rejections: ", n, n ? n.stack : null);
	          });
	        }
	      },
	      then: function then(t, e) {
	        var n = new l(),
	            o = {
	          y: t,
	          n: e,
	          p: n
	        };
	        if (this.state === c) this.c ? this.c.push(o) : this.c = [o];else {
	          var r = this.state,
	              i = this.v;
	          this.handled = !0, a(function () {
	            r === u ? h(o, i) : v(o, i);
	          });
	        }
	        return n;
	      },
	      catch: function _catch(t) {
	        return this.then(null, t);
	      },
	      finally: function _finally(t) {
	        return this.then(t, t);
	      },
	      timeout: function timeout(t, o) {
	        o = o || "Timeout";
	        var r = this;
	        return new l(function (e, n) {
	          setTimeout(function () {
	            n(Error(o));
	          }, t), r.then(function (t) {
	            e(t);
	          }, function (t) {
	            n(t);
	          });
	        });
	      }
	    }, l.resolve = function (t) {
	      var e = new l();
	      return e.resolve(t), e;
	    }, l.reject = function (t) {
	      var e = new l();
	      return e.c = [], e.reject(t), e;
	    }, l.all = function (n) {
	      var o = [],
	          r = 0,
	          i = new l();

	      function t(t, e) {
	        t && "function" == typeof t.then || (t = l.resolve(t)), t.then(function (t) {
	          o[e] = t, ++r == n.length && i.resolve(o);
	        }, function (t) {
	          i.reject(t);
	        });
	      }

	      for (var e = 0; e < n.length; e++) {
	        t(n[e], e);
	      }

	      return n.length || i.resolve(o), i;
	    }, l.warn = console.warn, module.exports && (module.exports = l), i.define && i.define.amd && i.define([], function () {
	      return l;
	    }), (i.Zousan = l).soon = a;
	  }("undefined" != typeof commonjsGlobal$1 ? commonjsGlobal$1 : commonjsGlobal$1);
	});
	var promise;

	if (typeof Promise !== 'undefined') {
	  promise = Promise;
	} else {
	  promise = zousanMin;
	}

	var Promise$1 = promise;

	var ResourceLoader = function () {
	  function ResourceLoader(DEFAULT_TEXTURE) {
	    this.defaultTexture = DEFAULT_TEXTURE;
	    this.defaultCubeTexture = new Array(6);
	    this.resources = {};
	  }

	  var _proto9 = ResourceLoader.prototype;

	  _proto9.get = function get(url) {
	    if (Array.isArray(url)) {
	      return this._loadImages(url);
	    } else {
	      return this._loadImage(url);
	    }
	  };

	  _proto9.getArrayBuffer = function getArrayBuffer(url) {
	    var _this5 = this;

	    if (Array.isArray(url)) {
	      var promises = url.map(function (u) {
	        return _this5.getArrayBuffer(u);
	      });
	      return Promise$1.all(promises);
	    } else {
	      return new Promise$1(function (resolve, reject) {
	        Ajax.getArrayBuffer(url, function (err, buffer) {
	          if (err) {
	            reject(err);
	          } else {
	            resolve({
	              url: url,
	              data: buffer
	            });
	          }
	        });
	      });
	    }
	  };

	  _proto9.disposeRes = function disposeRes(url) {
	    var _this6 = this;

	    if (Array.isArray(url)) {
	      url.forEach(function (u) {
	        return _this6._disposeOne(u);
	      });
	    } else {
	      this._disposeOne(url);
	    }

	    return this;
	  };

	  _proto9.isLoading = function isLoading() {
	    return this._count && this._count > 0;
	  };

	  _proto9.getDefaultTexture = function getDefaultTexture(url) {
	    if (!Array.isArray(url)) {
	      return this.defaultTexture;
	    } else {
	      return this._getBlankTextures(url.length);
	    }
	  };

	  _proto9._disposeOne = function _disposeOne(url) {
	    var resources = this.resources;

	    if (!resources[url]) {
	      return;
	    }

	    resources[url].count--;

	    if (resources[url.count] <= 0) {
	      delete resources[url];
	    }
	  };

	  _proto9._loadImage = function _loadImage(url) {
	    var resources = this.resources;

	    if (resources[url]) {
	      return Promise$1.resolve({
	        url: url,
	        data: resources[url].image
	      });
	    }

	    var promise = new Promise$1(function (resolve, reject) {
	      var img = new Image();
	      img.crossOrigin = 'anonymous';

	      img.onload = function () {
	        resources[url] = {
	          image: img,
	          count: 1
	        };
	        resolve({
	          url: url,
	          data: img
	        });
	      };

	      img.onerror = function (err) {
	        reject(err);
	      };

	      img.onabort = function () {
	        reject("image(" + url + ") loading aborted.");
	      };

	      img.src = url;
	    });
	    return promise;
	  };

	  _proto9._loadImages = function _loadImages(urls) {
	    var _this7 = this;

	    var promises = urls.map(function (url) {
	      return _this7._loadImage(url, true);
	    });
	    var promise = Promise$1.all(promises);
	    return promise;
	  };

	  _proto9._getBlankTextures = function _getBlankTextures(count) {
	    var t = new Array(count);

	    for (var i = 0; i < 6; i++) {
	      t.push(this.defaultTexture);
	    }

	    return t;
	  };

	  return ResourceLoader;
	}();

	var ResourceLoader$1 = Eventable(ResourceLoader);
	var P0 = [],
	    P1 = [];
	var uid = 0;

	var Scene = function () {
	  function Scene(meshes) {
	    this._id = uid++;
	    this.sortedMeshes = {};
	    this.setMeshes(meshes);
	    this._compareBinded = this._compare.bind(this);
	    this.dirty();
	  }

	  var _proto10 = Scene.prototype;

	  _proto10.setMeshes = function setMeshes(meshes) {
	    this.clear();

	    if (!meshes || Array.isArray(meshes) && !meshes.length || meshes === this.meshes) {
	      return this;
	    }

	    this.meshes = Array.isArray(meshes) ? meshes : [meshes];

	    for (var i = 0; i < this.meshes.length; i++) {
	      var mesh = this.meshes[i];
	      mesh._scenes = mesh._scenes || {};
	      mesh._scenes[this._id] = 1;
	    }

	    this.dirty();
	    return this;
	  };

	  _proto10.addMesh = function addMesh(mesh) {
	    var _this8 = this;

	    if (!mesh || Array.isArray(mesh) && !mesh.length) {
	      return this;
	    }

	    if (Array.isArray(mesh)) {
	      mesh.forEach(function (m) {
	        m._scenes = m._scenes || {};

	        if (!m._scenes[_this8._id]) {
	          m._scenes[_this8._id] = 1;

	          _this8.meshes.push(m);

	          _this8.dirty();
	        }
	      });
	    } else {
	      mesh._scenes = mesh._scenes || {};

	      if (!mesh._scenes[this._id]) {
	        mesh._scenes[this._id] = 1;
	        this.meshes.push(mesh);
	        this.dirty();
	      }
	    }

	    return this;
	  };

	  _proto10.removeMesh = function removeMesh(mesh) {
	    if (!mesh || Array.isArray(mesh) && !mesh.length) {
	      return this;
	    }

	    if (Array.isArray(mesh)) {
	      var hit = false;

	      for (var i = 0; i < mesh.length; i++) {
	        if (mesh[i]._scenes && mesh[i]._scenes[this._id]) {
	          hit = true;
	          this.dirty();
	          delete mesh[i]._scenes[this._id];
	        }
	      }

	      if (hit) {
	        this.meshes = this.meshes.filter(function (el) {
	          return mesh.indexOf(el) < 0;
	        });
	      }
	    } else {
	      if (!mesh._scenes || !mesh._scenes[this._id]) {
	        return this;
	      }

	      var idx = this.meshes.indexOf(mesh);

	      if (idx >= 0) {
	        this.meshes.splice(idx, 1);
	      }

	      delete mesh._scenes[this._id];
	      this.dirty();
	    }

	    return this;
	  };

	  _proto10.getMeshes = function getMeshes() {
	    return this.meshes;
	  };

	  _proto10.clear = function clear() {
	    if (this.meshes) {
	      for (var i = 0; i < this.meshes.length; i++) {
	        delete this.meshes[i]._scenes[this._id];
	      }
	    }

	    this.meshes = [];
	    this.sortedMeshes.opaques = [];
	    this.sortedMeshes.transparents = [];
	    return this;
	  };

	  _proto10.dirty = function dirty() {
	    this._dirty = true;
	    return this;
	  };

	  _proto10.sortMeshes = function sortMeshes(cameraPosition) {
	    var meshes = this.meshes;
	    var transparents = this.sortedMeshes.transparents;

	    if (this._dirty) {
	      var opaques = this.sortedMeshes.opaques = [];
	      transparents = this.sortedMeshes.transparents = [];

	      for (var i = 0, l = meshes.length; i < l; i++) {
	        if (meshes[i].transparent) {
	          transparents.push(meshes[i]);
	        } else {
	          opaques.push(meshes[i]);
	        }
	      }
	    }

	    if (cameraPosition && transparents.length > 1) {
	      this._cameraPosition = cameraPosition;
	      transparents.sort(this._compareBinded);
	      delete this._cameraPosition;
	    }

	    this._dirty = false;
	  };

	  _proto10.getSortedMeshes = function getSortedMeshes() {
	    if (this._dirty) {
	      this.sortMeshes();
	    }

	    return this.sortedMeshes;
	  };

	  _proto10._compare = function _compare(a, b) {
	    transformMat4(P0, a.geometry.boundingBox.getCenter(), a.localTransform);
	    transformMat4(P1, b.geometry.boundingBox.getCenter(), b.localTransform);
	    return dist(P1, this._cameraPosition) - dist(P0, this._cameraPosition);
	  };

	  return Scene;
	}();

	var toChar = String.fromCharCode;
	var MINELEN = 8;
	var MAXELEN = 0x7fff;

	function rgbe2float(rgbe, buffer, offset, exposure) {
	  if (rgbe[3] > 0) {
	    var f = Math.pow(2.0, rgbe[3] - 128 - 8 + exposure);
	    buffer[offset + 0] = rgbe[0] * f;
	    buffer[offset + 1] = rgbe[1] * f;
	    buffer[offset + 2] = rgbe[2] * f;
	  } else {
	    buffer[offset + 0] = 0;
	    buffer[offset + 1] = 0;
	    buffer[offset + 2] = 0;
	  }

	  buffer[offset + 3] = 1.0;
	  return buffer;
	}

	function uint82string(array, offset, size) {
	  var str$$1 = '';

	  for (var i = offset; i < size; i++) {
	    str$$1 += toChar(array[i]);
	  }

	  return str$$1;
	}

	function copyrgbe(s, t) {
	  t[0] = s[0];
	  t[1] = s[1];
	  t[2] = s[2];
	  t[3] = s[3];
	}

	function oldReadColors(scan, buffer, offset, xmax) {
	  var rshift = 0,
	      x = 0,
	      len$$1 = xmax;

	  while (len$$1 > 0) {
	    scan[x][0] = buffer[offset++];
	    scan[x][1] = buffer[offset++];
	    scan[x][2] = buffer[offset++];
	    scan[x][3] = buffer[offset++];

	    if (scan[x][0] === 1 && scan[x][1] === 1 && scan[x][2] === 1) {
	      for (var i = scan[x][3] << rshift >>> 0; i > 0; i--) {
	        copyrgbe(scan[x - 1], scan[x]);
	        x++;
	        len$$1--;
	      }

	      rshift += 8;
	    } else {
	      x++;
	      len$$1--;
	      rshift = 0;
	    }
	  }

	  return offset;
	}

	function readColors(scan, buffer, offset, xmax) {
	  if (xmax < MINELEN | xmax > MAXELEN) {
	    return oldReadColors(scan, buffer, offset, xmax);
	  }

	  var i = buffer[offset++];

	  if (i !== 2) {
	    return oldReadColors(scan, buffer, offset - 1, xmax);
	  }

	  scan[0][1] = buffer[offset++];
	  scan[0][2] = buffer[offset++];
	  i = buffer[offset++];

	  if ((scan[0][2] << 8 >>> 0 | i) >>> 0 !== xmax) {
	    return null;
	  }

	  for (var _i4 = 0; _i4 < 4; _i4++) {
	    for (var x = 0; x < xmax;) {
	      var code = buffer[offset++];

	      if (code > 128) {
	        code = (code & 127) >>> 0;
	        var val = buffer[offset++];

	        while (code--) {
	          scan[x++][_i4] = val;
	        }
	      } else {
	        while (code--) {
	          scan[x++][_i4] = buffer[offset++];
	        }
	      }
	    }
	  }

	  return offset;
	}

	function parseRGBE(arrayBuffer, exposure) {
	  if (exposure == null) {
	    exposure = 0;
	  }

	  var data = new Uint8Array(arrayBuffer);
	  var size = data.length;

	  if (uint82string(data, 0, 2) !== '#?') {
	    return null;
	  }

	  for (var i = 2; i < size; i++) {
	    if (toChar(data[i]) === '\n' && toChar(data[i + 1]) === '\n') {
	      break;
	    }
	  }

	  if (i >= size) {
	    return null;
	  }

	  i += 2;
	  var str$$1 = '';

	  for (; i < size; i++) {
	    var _char = toChar(data[i]);

	    if (_char === '\n') {
	      break;
	    }

	    str$$1 += _char;
	  }

	  var tmp = str$$1.split(' ');
	  var height = parseInt(tmp[1]);
	  var width = parseInt(tmp[3]);

	  if (!width || !height) {
	    return null;
	  }

	  var offset = i + 1;
	  var scanline = [];

	  for (var x = 0; x < width; x++) {
	    scanline[x] = [];

	    for (var j = 0; j < 4; j++) {
	      scanline[x][j] = 0;
	    }
	  }

	  var pixels = new Array(width * height * 4);
	  var offset2 = 0;

	  for (var y = 0; y < height; y++) {
	    offset = readColors(scanline, data, offset, width);

	    if (!offset) {
	      return null;
	    }

	    for (var _x = 0; _x < width; _x++) {
	      rgbe2float(scanline[_x], pixels, offset2, exposure);
	      offset2 += 4;
	    }
	  }

	  return {
	    width: width,
	    height: height,
	    pixels: pixels
	  };
	}

	var Texture2D = function (_Texture) {
	  _inheritsLoose(Texture2D, _Texture);

	  function Texture2D() {
	    return _Texture.apply(this, arguments) || this;
	  }

	  var _proto11 = Texture2D.prototype;

	  _proto11.onLoad = function onLoad(_ref2) {
	    var data = _ref2.data;
	    var config = this.config;

	    if (config.hdr) {
	      data = parseRGBE(data.data);
	      config.data = data.pixels;
	    } else {
	      config.data = data;
	    }

	    config.width = config.width || data.width;
	    config.height = config.height || data.height;

	    this._updateREGL();
	  };

	  _proto11.createREGLTexture = function createREGLTexture(regl) {
	    return regl.texture(this.config);
	  };

	  return Texture2D;
	}(Texture);

	var TextureCube = function (_Texture2) {
	  _inheritsLoose(TextureCube, _Texture2);

	  function TextureCube() {
	    return _Texture2.apply(this, arguments) || this;
	  }

	  var _proto12 = TextureCube.prototype;

	  _proto12.onLoad = function onLoad(images) {
	    var config = this.config;

	    var faces = this._createFaces(images);

	    config.faces = faces.map(function (face) {
	      return face.data;
	    });

	    this._updateREGL();
	  };

	  _proto12.createREGLTexture = function createREGLTexture(regl) {
	    return regl.cube(this.config);
	  };

	  _proto12._createFaces = function _createFaces() {
	    return [];
	  };

	  return TextureCube;
	}(Texture);

	var Plane = function (_Geometry) {
	  _inheritsLoose(Plane, _Geometry);

	  function Plane(z) {
	    return _Geometry.call(this, {
	      aPosition: [-0.5, -0.5, z || 0, 0.5, -0.5, z || 0, -0.5, 0.5, z || 0, 0.5, 0.5, z || 0],
	      aNormal: [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]
	    }, [3, 1, 0, 0, 2, 3]) || this;
	  }

	  return Plane;
	}(Geometry);

	var vsm_shadow_vert = "//--------------------------\n\n// 阴影相关的变量计算\n\n//\n\n//\n\n// uniform mat4 vsm_shadow_lightProjViewModelMatrix 有向光源的projView矩阵， ortho projection * view matrix * model matrix\n\n//\n\n//\n\n// void shadow_computeShadowPars(vec4 worldPos)\n\n// 计算阴影frag需要的varying变量\n\n//   * vec4 worldPos : 顶点世界坐标 model * aPosition\n\n//\n\n// 示例：\n\n// vec4 position = vec4(aPosition, 1.0);\n\n// shadow_computeShadowPars(worldPos);\n\n//--------------------------\n\n\n\nuniform mat4 vsm_shadow_lightProjViewModelMatrix;\n\n\n\nvarying vec4 vsm_shadow_vLightSpacePos;\n\n\n\nvoid shadow_computeShadowPars(vec4 position) {\n\n    vsm_shadow_vLightSpacePos = vsm_shadow_lightProjViewModelMatrix * position;\n\n}\n\n";
	var vsm_shadow_frag = "//--------------------------\n\n// 阴影着色\n\n//\n\n//\n\n// uniform sampler2D vsm_shadow_shadowMap 深度纹理\n\n// uniform float vsm_shadow_opacity 阴影透明度\n\n//\n\n//\n\n// void shadow_computeShadow()\n\n// 计算某个有向光源在当前片元的阴影值\n\n//\n\n// 示例：\n\n// // 计算有向光源在当前片元的阴影值\n\n// float shadow = shadow_computeShadow();\n\n//--------------------------\n\n\n\nuniform sampler2D vsm_shadow_shadowMap;\n\nuniform float vsm_shadow_opacity;\n\nuniform float vsm_shadow_threshold;\n\n\n\nvarying vec4 vsm_shadow_vLightSpacePos;\n\n\n\nfloat esm(vec3 projCoords, vec4 shadowTexel) {\n\n    // vec2 uv = projCoords.xy;\n\n    float compare = projCoords.z;\n\n    float c = 50.0;\n\n    float depth = shadowTexel.r;\n\n\n\n    depth = exp(-c * min(compare - depth, 0.05));\n\n    // depth = exp(c * depth) * exp(-c * compare);\n\n    return clamp(depth, vsm_shadow_threshold, 1.0);\n\n}\n\n\n\nfloat vsm_shadow_chebyshevUpperBound(vec3 projCoords, vec4 shadowTexel){\n\n\n\n    vec2 moments = shadowTexel.rg;\n\n    float distance = projCoords.z;\n\n    // Surface is fully lit. as the current fragment is before the light occluder\n\n    if (distance >= 1.0 || distance <= moments.x)\n\n        return 1.0 ;\n\n\n\n    // The fragment is either in shadow or penumbra. We now use chebyshev's upperBound to check\n\n    // How likely this pixel is to be lit (p_max)\n\n    float variance = moments.y - (moments.x * moments.x);\n\n    variance = max(variance, 0.00002);\n\n\n\n    float d = distance - moments.x;\n\n    float p_max = variance / (variance + d * d);\n\n    return p_max;\n\n}\n\n\n\nfloat shadow_computeShadow_coeff(sampler2D shadowMap, vec3 projCoords) {\n\n    vec2 uv = projCoords.xy;\n\n    vec4 shadowTexel = texture2D(shadowMap, uv);\n\n    #if defined(USE_ESM) || defined(USE_VSM_ESM)\n\n        float esm_coeff = esm(projCoords, shadowTexel);\n\n    #endif\n\n    //TODO shadowMap是用esm算法生成的，但貌似采用vsm效果却不算差\n\n    #if defined(USE_VSM) || defined(USE_VSM_ESM)\n\n        float vsm_coeff = vsm_shadow_chebyshevUpperBound(projCoords, shadowTexel);\n\n    #endif\n\n    #if defined(USE_VSM_ESM)\n\n       float coeff = esm_coeff * vsm_coeff;\n\n    #elif defined(USE_ESM)\n\n        float coeff = esm_coeff;\n\n    #else\n\n        float coeff = vsm_coeff;\n\n    #endif\n\n\n\n    return 1.0 - (1.0 - coeff) * vsm_shadow_opacity;\n\n}\n\n\n\nfloat shadow_computeShadow() {\n\n    // 执行透视除法\n\n    vec3 projCoords = vsm_shadow_vLightSpacePos.xyz / vsm_shadow_vLightSpacePos.w;\n\n    // 变换到[0,1]的范围\n\n    projCoords = projCoords * 0.5 + 0.5;\n\n    if(projCoords.z >= 1.0 || projCoords.x < 0.0 || projCoords.x > 1.0 || projCoords.y < 0.0 || projCoords.y > 1.0) return 1.0;\n\n    return shadow_computeShadow_coeff(vsm_shadow_shadowMap, projCoords);\n\n\n\n}\n\n";
	var fbo_picking_vert = "//--------------------------\n\n// Picking\n\n//\n\n// #define ENABLE_PICKING 整型 是否开启PICKING\n\n//\n\n// uniform int batchId geometry的批次id\n\n//\n\n//\n\n// void fbo_picking_setData(viewPosZ)\n\n//   设置picking数据,必须在设置gl_Position后调用\n\n//\n\n// 示例：\n\n// fbo_picking_setData(gl_Position.w);\n\n//--------------------------\n\n\n\n#ifdef ENABLE_PICKING\n\n//USE_PICKING_ID == 1 时读取attributes\n\n#if USE_PICKING_ID == 1\n\nattribute float aPickingId;\n\n//USE_PICKING_ID == 2 时读取uniforms\n\n#elif USE_PICKING_ID == 2\n\nuniform float uPickingId;\n\n#endif\n\nvarying float vPickingId;\n\nvarying float vFbo_picking_viewZ;\n\nvarying float vFbo_picking_visible;\n\n#endif\n\n\n\nvoid fbo_picking_setData(float viewPosZ, bool visible) {\n\n    #ifdef ENABLE_PICKING\n\n    #if USE_PICKING_ID == 1\n\n       vPickingId = aPickingId;\n\n    #elif USE_PICKING_ID == 2\n\n        vPickingId = uPickingId;\n\n    #endif\n\n        vFbo_picking_viewZ = viewPosZ;\n\n    #endif\n\n    vFbo_picking_visible = visible ? 1.0 : 0.0;\n\n}\n\n";
	var invert_vert = "mat4 invert(mat4 matrix) {\n\n    vec4 vector1 = matrix[0], vector2 = matrix[1], vector3 = matrix[2], vector4 = matrix[3];\n\n    float a00 = vector1.x, a01 = vector1.y, a02 = vector1.z, a03 = vector1.w;\n\n    float a10 = vector2.x, a11 = vector2.y, a12 = vector2.z, a13 = vector2.w;\n\n    float a20 = vector3.x, a21 = vector3.y, a22 = vector3.z, a23 = vector3.w;\n\n    float a30 = vector4.x, a31 = vector4.y, a32 = vector4.z, a33 = vector4.w;\n\n\n\n    float b00 = a00 * a11 - a01 * a10;\n\n    float b01 = a00 * a12 - a02 * a10;\n\n    float b02 = a00 * a13 - a03 * a10;\n\n    float b03 = a01 * a12 - a02 * a11;\n\n    float b04 = a01 * a13 - a03 * a11;\n\n    float b05 = a02 * a13 - a03 * a12;\n\n    float b06 = a20 * a31 - a21 * a30;\n\n    float b07 = a20 * a32 - a22 * a30;\n\n    float b08 = a20 * a33 - a23 * a30;\n\n    float b09 = a21 * a32 - a22 * a31;\n\n    float b10 = a21 * a33 - a23 * a31;\n\n    float b11 = a22 * a33 - a23 * a32;\n\n    // Calculate the determinant\n\n    float det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;\n\n    det = 1.0 / det;\n\n    mat4 m = mat4(\n\n        (a11 * b11 - a12 * b10 + a13 * b09) * det,\n\n        (a02 * b10 - a01 * b11 - a03 * b09) * det,\n\n        (a31 * b05 - a32 * b04 + a33 * b03) * det,\n\n        (a22 * b04 - a21 * b05 - a23 * b03) * det,\n\n        (a12 * b08 - a10 * b11 - a13 * b07) * det,\n\n        (a00 * b11 - a02 * b08 + a03 * b07) * det,\n\n        (a32 * b02 - a30 * b05 - a33 * b01) * det,\n\n        (a20 * b05 - a22 * b02 + a23 * b01) * det,\n\n        (a10 * b10 - a11 * b08 + a13 * b06) * det,\n\n        (a01 * b08 - a00 * b10 - a03 * b06) * det,\n\n        (a30 * b04 - a31 * b02 + a33 * b00) * det,\n\n        (a21 * b02 - a20 * b04 - a23 * b00) * det,\n\n        (a11 * b07 - a10 * b09 - a12 * b06) * det,\n\n        (a00 * b09 - a01 * b07 + a02 * b06) * det,\n\n        (a31 * b01 - a30 * b03 - a32 * b00) * det,\n\n        (a20 * b03 - a21 * b01 + a22 * b00) * det\n\n    );\n\n    return m;\n\n}\n\n\n\nmat4 transpose(mat4 matrix) {\n\n    vec4 vector1 = matrix[0], vector2 = matrix[1], vector3 = matrix[2], vector4 = matrix[3];\n\n    float a01 = vector1.y, a02 = vector1.z, a03 = vector1.w;\n\n    float a12 = vector2.z, a13 = vector2.w;\n\n    float a23 = vector3.w;\n\n    mat4 m = mat4(\n\n        vector1.x,\n\n        vector2.x,\n\n        vector3.x,\n\n        vector4.x,\n\n        a01,\n\n        vector2.y,\n\n        vector3.y,\n\n        vector4.y,\n\n        a02,\n\n        a12,\n\n        vector3.z,\n\n        vector4.z,\n\n        a03,\n\n        a13,\n\n        a23,\n\n        vector4.w\n\n    );\n\n    return m;\n\n}";
	var instance_vert = "attribute vec4 instance_vectorA;\n\nattribute vec4 instance_vectorB;\n\nattribute vec4 instance_vectorC;\n\nattribute vec4 instance_vectorD;\n\nattribute vec4 instance_color;\n\n\n\nmat4 instance_getAttributeMatrix() {\n\n    mat4 mat = mat4(\n\n        instance_vectorA.x, instance_vectorA.y, instance_vectorA.z, instance_vectorA.w,\n\n        instance_vectorB.x, instance_vectorB.y, instance_vectorB.z, instance_vectorB.w,\n\n        instance_vectorC.x, instance_vectorC.y, instance_vectorC.z, instance_vectorC.w,\n\n        instance_vectorD.x, instance_vectorD.y, instance_vectorD.z, instance_vectorD.w\n\n    );\n\n    return mat;\n\n}\n\n\n\nvec4 instance_getInstanceColor() {\n\n    return instance_color;\n\n}";
	var skin_vert = "attribute vec4 WEIGHTS_0;\n\nattribute vec4 JOINTS_0;\n\n\n\nuniform sampler2D jointTexture;\n\nuniform vec2 jointTextureSize;\n\nuniform float numJoints;\n\n\n\n// these offsets assume the texture is 4 pixels across\n\n#define ROW0_U ((0.5 + 0.0) / 4.)\n\n#define ROW1_U ((0.5 + 1.0) / 4.)\n\n#define ROW2_U ((0.5 + 2.0) / 4.)\n\n#define ROW3_U ((0.5 + 3.0) / 4.)\n\n\n\nmat4 skin_getBoneMatrix(float jointNdx) {\n\n    float v = (jointNdx + 0.5) / numJoints;\n\n    return mat4(\n\n        texture2D(jointTexture, vec2(ROW0_U, v)),\n\n        texture2D(jointTexture, vec2(ROW1_U, v)),\n\n        texture2D(jointTexture, vec2(ROW2_U, v)),\n\n        texture2D(jointTexture, vec2(ROW3_U, v)));\n\n}\n\n\n\nmat4 skin_getSkinMatrix() {\n\n        mat4 skinMatrix = skin_getBoneMatrix(JOINTS_0[0]) * WEIGHTS_0[0] +\n\n                        skin_getBoneMatrix(JOINTS_0[1]) * WEIGHTS_0[1] +\n\n                        skin_getBoneMatrix(JOINTS_0[2]) * WEIGHTS_0[2] +\n\n                        skin_getBoneMatrix(JOINTS_0[3]) * WEIGHTS_0[3];\n\n        return skinMatrix;\n\n}\n\n";
	var fl_common_math_glsl = "//------------------------------------------------------------------------------\n\n// Common math\n\n//------------------------------------------------------------------------------\n\n\n\n\n\n#define PI                 3.14159265359\n\n\n\n#define HALF_PI            1.570796327\n\n\n\n#define MEDIUMP_FLT_MAX    65504.0\n\n#define MEDIUMP_FLT_MIN    0.00006103515625\n\n\n\n#ifdef TARGET_MOBILE\n\n#define FLT_EPS            MEDIUMP_FLT_MIN\n\n#define saturateMediump(x) min(x, MEDIUMP_FLT_MAX)\n\n#else\n\n#define FLT_EPS            1e-5\n\n#define saturateMediump(x) x\n\n#endif\n\n\n\n#define saturate(x)        clamp(x, 0.0, 1.0)\n\n\n\n//------------------------------------------------------------------------------\n\n// Scalar operations\n\n//------------------------------------------------------------------------------\n\n\n\n\n\nfloat pow5(float x) {\n\n    float x2 = x * x;\n\n    return x2 * x2 * x;\n\n}\n\n\n\n\n\nfloat sq(float x) {\n\n    return x * x;\n\n}\n\n\n\n\n\nfloat max3(const vec3 v) {\n\n    return max(v.x, max(v.y, v.z));\n\n}\n\n\n\n//------------------------------------------------------------------------------\n\n// Matrix and quaternion operations\n\n//------------------------------------------------------------------------------\n\n\n\n\n\nvec4 mulMat4x4Float3(const highp mat4 m, const highp vec3 v) {\n\n    return v.x * m[0] + (v.y * m[1] + (v.z * m[2] + m[3]));\n\n}\n\n\n\n\n\nvec3 mulMat3x3Float3(const highp mat4 m, const highp vec3 v) {\n\n    return v.x * m[0].xyz + (v.y * m[1].xyz + (v.z * m[2].xyz));\n\n}\n\n\n\n\n\nvoid toTangentFrame(const highp vec4 q, out highp vec3 n) {\n\n    n = vec3( 0.0,  0.0,  1.0) +\n\n        vec3( 2.0, -2.0, -2.0) * q.x * q.zwx +\n\n        vec3( 2.0,  2.0, -2.0) * q.y * q.wzy;\n\n}\n\n\n\n\n\nvoid toTangentFrame(const highp vec4 q, out highp vec3 n, out highp vec3 t) {\n\n    toTangentFrame(q, n);\n\n    t = vec3( 1.0,  0.0,  0.0) +\n\n        vec3(-2.0,  2.0, -2.0) * q.y * q.yxw +\n\n        vec3(-2.0,  2.0,  2.0) * q.z * q.zwx;\n\n}\n\n";
	var fl_uniforms_glsl = "\n\n\n\nstruct FrameUniforms {\n\n    // transforms\n\n    // mat4 viewFromWorldMatrix, //viewMatrix\n\n    // mat4 worldFromViewMatrix,\n\n    // mat4 clipFromViewMatrix,\n\n    // mat4 viewFromClipMatrix,\n\n    // mat4 clipFromWorldMatrix,\n\n    // mat4 worldFromClipMatrix,\n\n    // mat4 lightFromWorldMatrix,\n\n    // view\n\n    highp vec4 resolution; //viewport width, height, 1/width, 1/height\n\n    // camera\n\n    highp vec3 cameraPosition;\n\n    // time\n\n    highp float time;// time in seconds, with a 1 second period\n\n    // directional light\n\n    mediump vec4 lightColorIntensity;\n\n    mediump vec4 sun; // cos(sunAngle), sin(sunAngle), 1/(sunAngle*HALO_SIZE-sunAngle), HALO_EXP\n\n    highp vec3 lightDirection;\n\n    // int fParamsX,\n\n    // shadow\n\n    mediump vec3 shadowBias;\n\n    // oneOverFroxelDimensionY,\n\n    // froxels\n\n    // zParams,\n\n    // fParams,\n\n    // origin,\n\n    // froxels (again, for alignment purposes)\n\n    // oneOverFroxelDimension,\n\n    // ibl\n\n    mediump float iblLuminance; //TODO 干嘛的？\n\n    // camera\n\n    mediump float exposure; //TODO\n\n    mediump float ev100; //TODO\n\n    // ibl\n\n    highp vec3 iblSH[9];\n\n    mediump vec2 iblMaxMipLevel;\n\n    // user time\n\n    // vec4 userTime,\n\n};\n\n\n\nFrameUniforms frameUniforms;\n\n\n\nuniform highp vec4 resolution;\n\nuniform highp vec3 cameraPosition;\n\nuniform highp float time;\n\nuniform mediump vec4 lightColorIntensity;\n\nuniform mediump vec4 sun;\n\nuniform highp vec3 lightDirection;\n\nuniform mediump float iblLuminance;\n\nuniform mediump float exposure;\n\nuniform mediump float ev100;\n\nuniform highp vec3 iblSH[9];\n\nuniform mediump vec2 iblMaxMipLevel;\n\n\n\nvoid initFrameUniforms() {\n\n    frameUniforms.iblMaxMipLevel = iblMaxMipLevel;\n\n    frameUniforms.resolution = resolution;\n\n    frameUniforms.cameraPosition = cameraPosition;\n\n    frameUniforms.time = time;\n\n    frameUniforms.lightColorIntensity = lightColorIntensity * vec4(1.0, 1.0, 1.0, exposure);\n\n    frameUniforms.sun = sun;\n\n    frameUniforms.lightDirection = normalize(lightDirection);\n\n    frameUniforms.iblLuminance = iblLuminance * exposure;\n\n    frameUniforms.exposure = exposure;\n\n    frameUniforms.ev100 = ev100;\n\n    for (int i = 0; i < 9; i++)\n\n    {\n\n        frameUniforms.iblSH[i] = iblSH[i];\n\n    }\n\n    // frameUniforms.iblSH = iblSH;\n\n    frameUniforms.shadowBias = vec3(0.0, 0.0, 0.0);\n\n}\n\n";
	var fl_material_inputs_vert = "struct MaterialVertexInputs {\n\n#ifdef HAS_ATTRIBUTE_COLOR\n\n    vec4 color;\n\n#endif\n\n#ifdef HAS_ATTRIBUTE_UV0\n\n    vec2 uv0;\n\n#endif\n\n#ifdef HAS_ATTRIBUTE_UV1\n\n    vec2 uv1;\n\n#endif\n\n#ifdef VARIABLE_CUSTOM0\n\n    vec4 VARIABLE_CUSTOM0;\n\n#endif\n\n#ifdef VARIABLE_CUSTOM1\n\n    vec4 VARIABLE_CUSTOM1;\n\n#endif\n\n#ifdef VARIABLE_CUSTOM2\n\n    vec4 VARIABLE_CUSTOM2;\n\n#endif\n\n#ifdef VARIABLE_CUSTOM3\n\n    vec4 VARIABLE_CUSTOM3;\n\n#endif\n\n#ifdef HAS_ATTRIBUTE_TANGENTS\n\n    vec3 worldNormal;\n\n#endif\n\n    vec4 worldPosition;\n\n};\n\n\n\n// Workaround for a driver bug on ARM Bifrost GPUs. Assigning a structure member\n\n// (directly or inside an expression) to an invariant causes a driver crash.\n\nvec4 getWorldPosition(const MaterialVertexInputs material) {\n\n    return material.worldPosition;\n\n}\n\n\n\nvoid initMaterialVertex(out MaterialVertexInputs material) {\n\n#ifdef HAS_ATTRIBUTE_COLOR\n\n    material.color = mesh_color;\n\n#endif\n\n#ifdef HAS_ATTRIBUTE_UV0\n\n    #ifdef FLIP_UV_ATTRIBUTE\n\n    material.uv0 = vec2(mesh_uv0.x, 1.0 - mesh_uv0.y);\n\n    #else\n\n    material.uv0 = mesh_uv0;\n\n    #endif\n\n#endif\n\n#ifdef HAS_ATTRIBUTE_UV1\n\n    #ifdef FLIP_UV_ATTRIBUTE\n\n    material.uv1 = vec2(mesh_uv1.x, 1.0 - mesh_uv1.y);\n\n    #else\n\n    material.uv1 = mesh_uv1;\n\n    #endif\n\n#endif\n\n#ifdef VARIABLE_CUSTOM0\n\n    material.VARIABLE_CUSTOM0 = vec4(0.0);\n\n#endif\n\n#ifdef VARIABLE_CUSTOM1\n\n    material.VARIABLE_CUSTOM1 = vec4(0.0);\n\n#endif\n\n#ifdef VARIABLE_CUSTOM2\n\n    material.VARIABLE_CUSTOM2 = vec4(0.0);\n\n#endif\n\n#ifdef VARIABLE_CUSTOM3\n\n    material.VARIABLE_CUSTOM3 = vec4(0.0);\n\n#endif\n\n    material.worldPosition = computeWorldPosition();\n\n}\n\n";
	var fl_inputs_vert = "vec4 mesh_position;\n\n\n\n#if defined(HAS_ATTRIBUTE_TANGENTS)\n\nvec4 mesh_tangents;\n\n#endif\n\n\n\n#if defined(HAS_ATTRIBUTE_COLOR)\n\nvec4 mesh_color;\n\n#endif\n\n\n\n#if defined(HAS_ATTRIBUTE_UV0)\n\nvec2 mesh_uv0;\n\n#endif\n\n\n\n#if defined(HAS_ATTRIBUTE_UV1)\n\nvec2 mesh_uv1;\n\n#endif\n\n\n\n#if defined(HAS_ATTRIBUTE_BONE_INDICES)\n\nvec4 mesh_bone_indices;\n\n#endif\n\n\n\n#if defined(HAS_ATTRIBUTE_BONE_WEIGHTS)\n\nvec4 mesh_bone_weights;\n\n#endif\n\n\n\nvarying highp vec3 vertex_worldPosition;\n\n#if defined(HAS_ATTRIBUTE_TANGENTS)\n\nvarying mediump vec3 vertex_worldNormal;\n\n#if defined(MATERIAL_HAS_ANISOTROPY) || defined(MATERIAL_HAS_NORMAL) || defined(MATERIAL_HAS_CLEAR_COAT_NORMAL)\n\nvarying mediump vec3 vertex_worldTangent;\n\nvarying mediump vec3 vertex_worldBitangent;\n\n#endif\n\n#if defined(GEOMETRIC_SPECULAR_AA_NORMAL)\n\nvarying centroid vec3 vertex_worldNormalCentroid;\n\n#endif\n\n#endif\n\n\n\n#if defined(HAS_ATTRIBUTE_COLOR)\n\nvarying mediump vec4 vertex_color;\n\n#endif\n\n\n\n#if defined(HAS_ATTRIBUTE_UV0) && !defined(HAS_ATTRIBUTE_UV1)\n\nvarying highp vec2 vertex_uv01;\n\n#elif defined(HAS_ATTRIBUTE_UV1)\n\nvarying highp vec4 vertex_uv01;\n\n#endif\n\n";
	var fl_header_frag = "#define SHADER_NAME standard\n\n    #extension GL_OES_standard_derivatives : enable\n\n#if defined(GL_EXT_shader_texture_lod)\n\n    #extension GL_EXT_shader_texture_lod : enable\n\n#endif\n\n\n\nprecision mediump float;\n\n\n\nvec4 textureLod(sampler2D sampler, vec2 coord, float lod) {\n\n    return texture2DLodEXT(sampler, coord, lod);\n\n}\n\n\n\nvec4 textureLod(samplerCube sampler, vec3 coord, float lod) {\n\n    return textureCubeLodEXT(sampler, coord, lod);\n\n}\n\n";
	var fl_common_graphics_glsl = "//------------------------------------------------------------------------------\n\n// Common color operations\n\n//------------------------------------------------------------------------------\n\n\n\n\n\nfloat luminance(const vec3 linear) {\n\n    return dot(linear, vec3(0.2126, 0.7152, 0.0722));\n\n}\n\n\n\n\n\nfloat computePreExposedIntensity(const highp float intensity, const highp float exposure) {\n\n    return intensity * exposure;\n\n}\n\n\n\nvoid unpremultiply(inout vec4 color) {\n\n    color.rgb /= max(color.a, FLT_EPS);\n\n}\n\n\n\n//------------------------------------------------------------------------------\n\n// Tone mapping operations\n\n//------------------------------------------------------------------------------\n\n\n\n\n\nvec3 Inverse_Tonemap_Unreal(const vec3 x) {\n\n    return (x * -0.155) / (x - 1.019);\n\n}\n\n\n\n\n\nvec3 inverseTonemapSRGB(vec3 color) {\n\n    // sRGB input\n\n    color = clamp(color, 0.0, 1.0);\n\n    return Inverse_Tonemap_Unreal(color);\n\n}\n\n\n\n\n\nvec3 inverseTonemap(vec3 linear) {\n\n    // Linear input\n\n    linear = clamp(linear, 0.0, 1.0);\n\n    return Inverse_Tonemap_Unreal(pow(linear, vec3(1.0 / 2.2)));\n\n}\n\n\n\n//------------------------------------------------------------------------------\n\n// Common texture operations\n\n//------------------------------------------------------------------------------\n\n\n\n\n\nvec3 decodeRGBM(vec4 c) {\n\n    c.rgb *= (c.a * 16.0);\n\n    return c.rgb * c.rgb;\n\n}\n\n\n\n//------------------------------------------------------------------------------\n\n// Common debug\n\n//------------------------------------------------------------------------------\n\n\n\nvec3 heatmap(float v) {\n\n    vec3 r = v * 2.1 - vec3(1.8, 1.14, 0.3);\n\n    return 1.0 - r * r;\n\n}\n\n";
	var fl_inputs_frag = "//------------------------------------------------------------------------------\n\n// Attributes and uniforms\n\n//------------------------------------------------------------------------------\n\n\n\n#if !defined(DEPTH_PREPASS)\n\nvarying highp vec3 vertex_worldPosition;\n\n#endif\n\n\n\n#if defined(HAS_ATTRIBUTE_TANGENTS)\n\nvarying mediump vec3 vertex_worldNormal;\n\n#if defined(MATERIAL_HAS_ANISOTROPY) || defined(MATERIAL_HAS_NORMAL) || defined(MATERIAL_HAS_CLEAR_COAT_NORMAL)\n\nvarying mediump vec3 vertex_worldTangent;\n\nvarying mediump vec3 vertex_worldBitangent;\n\n#endif\n\n#endif\n\n\n\n#if defined(HAS_ATTRIBUTE_COLOR)\n\nvarying mediump vec4 vertex_color;\n\n#endif\n\n\n\n#if defined(HAS_ATTRIBUTE_UV0) && !defined(HAS_ATTRIBUTE_UV1)\n\n varying highp vec2 vertex_uv01;\n\n#elif defined(HAS_ATTRIBUTE_UV1)\n\n varying highp vec4 vertex_uv01;\n\n#endif\n\n\n\n";
	var fl_brdf_frag = "//------------------------------------------------------------------------------\n\n// BRDF configuration\n\n//------------------------------------------------------------------------------\n\n\n\n// Diffuse BRDFs\n\n#define DIFFUSE_LAMBERT             0\n\n#define DIFFUSE_BURLEY              1\n\n\n\n// Specular BRDF\n\n// Normal distribution functions\n\n#define SPECULAR_D_GGX              0\n\n\n\n// Anisotropic NDFs\n\n#define SPECULAR_D_GGX_ANISOTROPIC  0\n\n\n\n// Cloth NDFs\n\n#define SPECULAR_D_CHARLIE          0\n\n\n\n// Visibility functions\n\n#define SPECULAR_V_SMITH_GGX        0\n\n#define SPECULAR_V_SMITH_GGX_FAST   1\n\n#define SPECULAR_V_GGX_ANISOTROPIC  2\n\n#define SPECULAR_V_KELEMEN          3\n\n#define SPECULAR_V_NEUBELT          4\n\n\n\n// Fresnel functions\n\n#define SPECULAR_F_SCHLICK          0\n\n\n\n#define BRDF_DIFFUSE                DIFFUSE_LAMBERT\n\n\n\n#if defined(TARGET_MOBILE)\n\n#define BRDF_SPECULAR_D             SPECULAR_D_GGX\n\n#define BRDF_SPECULAR_V             SPECULAR_V_SMITH_GGX_FAST\n\n#define BRDF_SPECULAR_F             SPECULAR_F_SCHLICK\n\n#else\n\n#define BRDF_SPECULAR_D             SPECULAR_D_GGX\n\n#define BRDF_SPECULAR_V             SPECULAR_V_SMITH_GGX\n\n#define BRDF_SPECULAR_F             SPECULAR_F_SCHLICK\n\n#endif\n\n\n\n#define BRDF_CLEAR_COAT_D           SPECULAR_D_GGX\n\n#define BRDF_CLEAR_COAT_V           SPECULAR_V_KELEMEN\n\n\n\n#define BRDF_ANISOTROPIC_D          SPECULAR_D_GGX_ANISOTROPIC\n\n#define BRDF_ANISOTROPIC_V          SPECULAR_V_GGX_ANISOTROPIC\n\n\n\n#define BRDF_CLOTH_D                SPECULAR_D_CHARLIE\n\n#define BRDF_CLOTH_V                SPECULAR_V_NEUBELT\n\n\n\n//------------------------------------------------------------------------------\n\n// Specular BRDF implementations\n\n//------------------------------------------------------------------------------\n\n\n\nfloat D_GGX(float roughness, float NoH, const vec3 h) {\n\n    // Walter et al. 2007, \"Microfacet Models for Refraction through Rough Surfaces\"\n\n\n\n    // In mediump, there are two problems computing 1.0 - NoH^2\n\n    // 1) 1.0 - NoH^2 suffers floating point cancellation when NoH^2 is close to 1 (highlights)\n\n    // 2) NoH doesn't have enough precision around 1.0\n\n    // Both problem can be fixed by computing 1-NoH^2 in highp and providing NoH in highp as well\n\n\n\n    // However, we can do better using Lagrange's identity:\n\n    //      ||a x b||^2 = ||a||^2 ||b||^2 - (a . b)^2\n\n    // since N and H are unit vectors: ||N x H||^2 = 1.0 - NoH^2\n\n    // This computes 1.0 - NoH^2 directly (which is close to zero in the highlights and has\n\n    // enough precision).\n\n    // Overall this yields better performance, keeping all computations in mediump\n\n#if defined(TARGET_MOBILE)\n\n    vec3 NxH = cross(shading_normal, h);\n\n    float oneMinusNoHSquared = dot(NxH, NxH);\n\n#else\n\n    float oneMinusNoHSquared = 1.0 - NoH * NoH;\n\n#endif\n\n\n\n    float a = NoH * roughness;\n\n    float k = roughness / (oneMinusNoHSquared + a * a);\n\n    float d = k * k * (1.0 / PI);\n\n    return saturateMediump(d);\n\n}\n\n\n\nfloat D_GGX_Anisotropic(float at, float ab, float ToH, float BoH, float NoH) {\n\n    // Burley 2012, \"Physically-Based Shading at Disney\"\n\n\n\n    // The values at and ab are perceptualRoughness^2, a2 is therefore perceptualRoughness^4\n\n    // The dot product below computes perceptualRoughness^8. We cannot fit in fp16 without clamping\n\n    // the roughness to too high values so we perform the dot product and the division in fp32\n\n    float a2 = at * ab;\n\n    highp vec3 d = vec3(ab * ToH, at * BoH, a2 * NoH);\n\n    highp float d2 = dot(d, d);\n\n    float b2 = a2 / d2;\n\n    return a2 * b2 * b2 * (1.0 / PI);\n\n}\n\n\n\nfloat D_Charlie(float roughness, float NoH) {\n\n    // Estevez and Kulla 2017, \"Production Friendly Microfacet Sheen BRDF\"\n\n    float invAlpha  = 1.0 / roughness;\n\n    float cos2h = NoH * NoH;\n\n    float sin2h = max(1.0 - cos2h, 0.0078125); // 2^(-14/2), so sin2h^2 > 0 in fp16\n\n    return (2.0 + invAlpha) * pow(sin2h, invAlpha * 0.5) / (2.0 * PI);\n\n}\n\n\n\nfloat V_SmithGGXCorrelated(float roughness, float NoV, float NoL) {\n\n    // Heitz 2014, \"Understanding the Masking-Shadowing Function in Microfacet-Based BRDFs\"\n\n    float a2 = roughness * roughness;\n\n    // TODO: lambdaV can be pre-computed for all the lights, it should be moved out of this function\n\n    float lambdaV = NoL * sqrt((NoV - a2 * NoV) * NoV + a2);\n\n    float lambdaL = NoV * sqrt((NoL - a2 * NoL) * NoL + a2);\n\n    float v = 0.5 / (lambdaV + lambdaL);\n\n    // a2=0 => v = 1 / 4*NoL*NoV   => min=1/4, max=+inf\n\n    // a2=1 => v = 1 / 2*(NoL+NoV) => min=1/4, max=+inf\n\n    // clamp to the maximum value representable in mediump\n\n    return saturateMediump(v);\n\n}\n\n\n\nfloat V_SmithGGXCorrelated_Fast(float roughness, float NoV, float NoL) {\n\n    // Hammon 2017, \"PBR Diffuse Lighting for GGX+Smith Microsurfaces\"\n\n    float v = 0.5 / mix(2.0 * NoL * NoV, NoL + NoV, roughness);\n\n    return saturateMediump(v);\n\n}\n\n\n\nfloat V_SmithGGXCorrelated_Anisotropic(float at, float ab, float ToV, float BoV,\n\n        float ToL, float BoL, float NoV, float NoL) {\n\n    // Heitz 2014, \"Understanding the Masking-Shadowing Function in Microfacet-Based BRDFs\"\n\n    // TODO: lambdaV can be pre-computed for all the lights, it should be moved out of this function\n\n    float lambdaV = NoL * length(vec3(at * ToV, ab * BoV, NoV));\n\n    float lambdaL = NoV * length(vec3(at * ToL, ab * BoL, NoL));\n\n    float v = 0.5 / (lambdaV + lambdaL);\n\n    return saturateMediump(v);\n\n}\n\n\n\nfloat V_Kelemen(float LoH) {\n\n    // Kelemen 2001, \"A Microfacet Based Coupled Specular-Matte BRDF Model with Importance Sampling\"\n\n    return saturateMediump(0.25 / (LoH * LoH));\n\n}\n\n\n\nfloat V_Neubelt(float NoV, float NoL) {\n\n    // Neubelt and Pettineo 2013, \"Crafting a Next-gen Material Pipeline for The Order: 1886\"\n\n    return saturateMediump(1.0 / (4.0 * (NoL + NoV - NoL * NoV)));\n\n}\n\n\n\nvec3 F_Schlick(const vec3 f0, float f90, float VoH) {\n\n    // Schlick 1994, \"An Inexpensive BRDF Model for Physically-Based Rendering\"\n\n    return f0 + (f90 - f0) * pow5(1.0 - VoH);\n\n}\n\n\n\nvec3 F_Schlick(const vec3 f0, float VoH) {\n\n    float f = pow(1.0 - VoH, 5.0);\n\n    return f + f0 * (1.0 - f);\n\n}\n\n\n\nfloat F_Schlick(float f0, float f90, float VoH) {\n\n    return f0 + (f90 - f0) * pow5(1.0 - VoH);\n\n}\n\n\n\n//------------------------------------------------------------------------------\n\n// Specular BRDF dispatch\n\n//------------------------------------------------------------------------------\n\n\n\nfloat distribution(float roughness, float NoH, const vec3 h) {\n\n#if BRDF_SPECULAR_D == SPECULAR_D_GGX\n\n    return D_GGX(roughness, NoH, h);\n\n#endif\n\n}\n\n\n\nfloat visibility(float roughness, float NoV, float NoL, float LoH) {\n\n#if BRDF_SPECULAR_V == SPECULAR_V_SMITH_GGX\n\n    return V_SmithGGXCorrelated(roughness, NoV, NoL);\n\n#elif BRDF_SPECULAR_V == SPECULAR_V_SMITH_GGX_FAST\n\n    return V_SmithGGXCorrelated_Fast(roughness, NoV, NoL);\n\n#endif\n\n}\n\n\n\nvec3 fresnel(const vec3 f0, float LoH) {\n\n#if BRDF_SPECULAR_F == SPECULAR_F_SCHLICK\n\n#if defined(TARGET_MOBILE)\n\n    // f90 = 1.0\n\n    return F_Schlick(f0, LoH);\n\n#else\n\n    float f90 = saturate(dot(f0, vec3(50.0 * 0.33)));\n\n    return F_Schlick(f0, f90, LoH);\n\n#endif\n\n#endif\n\n}\n\n\n\nfloat distributionAnisotropic(float at, float ab, float ToH, float BoH, float NoH) {\n\n#if BRDF_ANISOTROPIC_D == SPECULAR_D_GGX_ANISOTROPIC\n\n    return D_GGX_Anisotropic(at, ab, ToH, BoH, NoH);\n\n#endif\n\n}\n\n\n\nfloat visibilityAnisotropic(float roughness, float at, float ab,\n\n        float ToV, float BoV, float ToL, float BoL, float NoV, float NoL) {\n\n#if BRDF_ANISOTROPIC_V == SPECULAR_V_SMITH_GGX\n\n    return V_SmithGGXCorrelated(roughness, NoV, NoL);\n\n#elif BRDF_ANISOTROPIC_V == SPECULAR_V_GGX_ANISOTROPIC\n\n    return V_SmithGGXCorrelated_Anisotropic(at, ab, ToV, BoV, ToL, BoL, NoV, NoL);\n\n#endif\n\n}\n\n\n\nfloat distributionClearCoat(float roughness, float NoH, const vec3 h) {\n\n#if BRDF_CLEAR_COAT_D == SPECULAR_D_GGX\n\n    return D_GGX(roughness, NoH, h);\n\n#endif\n\n}\n\n\n\nfloat visibilityClearCoat(float LoH) {\n\n#if BRDF_CLEAR_COAT_V == SPECULAR_V_KELEMEN\n\n    return V_Kelemen(LoH);\n\n#endif\n\n}\n\n\n\nfloat distributionCloth(float roughness, float NoH) {\n\n#if BRDF_CLOTH_D == SPECULAR_D_CHARLIE\n\n    return D_Charlie(roughness, NoH);\n\n#endif\n\n}\n\n\n\nfloat visibilityCloth(float NoV, float NoL) {\n\n#if BRDF_CLOTH_V == SPECULAR_V_NEUBELT\n\n    return V_Neubelt(NoV, NoL);\n\n#endif\n\n}\n\n\n\n//------------------------------------------------------------------------------\n\n// Diffuse BRDF implementations\n\n//------------------------------------------------------------------------------\n\n\n\nfloat Fd_Lambert() {\n\n    return 1.0 / PI;\n\n}\n\n\n\nfloat Fd_Burley(float roughness, float NoV, float NoL, float LoH) {\n\n    // Burley 2012, \"Physically-Based Shading at Disney\"\n\n    float f90 = 0.5 + 2.0 * roughness * LoH * LoH;\n\n    float lightScatter = F_Schlick(1.0, f90, NoL);\n\n    float viewScatter  = F_Schlick(1.0, f90, NoV);\n\n    return lightScatter * viewScatter * (1.0 / PI);\n\n}\n\n\n\n// Energy conserving wrap diffuse term, does *not* include the divide by pi\n\nfloat Fd_Wrap(float NoL, float w) {\n\n    return saturate((NoL + w) / sq(1.0 + w));\n\n}\n\n\n\n//------------------------------------------------------------------------------\n\n// Diffuse BRDF dispatch\n\n//------------------------------------------------------------------------------\n\n\n\nfloat diffuse(float roughness, float NoV, float NoL, float LoH) {\n\n#if BRDF_DIFFUSE == DIFFUSE_LAMBERT\n\n    return Fd_Lambert();\n\n#elif BRDF_DIFFUSE == DIFFUSE_BURLEY\n\n    return Fd_Burley(roughness, NoV, NoL, LoH);\n\n#endif\n\n}\n\n";
	var fl_shading_params = "//------------------------------------------------------------------------------\n\n// Material evaluation\n\n//------------------------------------------------------------------------------\n\n\n\n\n\nvoid computeShadingParams() {\n\n#if defined(HAS_ATTRIBUTE_TANGENTS)\n\n    highp vec3 n = vertex_worldNormal;\n\n\n\n#if defined(MATERIAL_HAS_DOUBLE_SIDED_CAPABILITY)\n\n    if (isDoubleSided()) {\n\n        n = gl_FrontFacing ? n : -n;\n\n    }\n\n#endif\n\n\n\n#if defined(MATERIAL_HAS_ANISOTROPY) || defined(MATERIAL_HAS_NORMAL) || defined(MATERIAL_HAS_CLEAR_COAT_NORMAL)\n\n    // Re-normalize post-interpolation values\n\n    shading_tangentToWorld = mat3(\n\n            normalize(vertex_worldTangent), normalize(vertex_worldBitangent), normalize(n));\n\n#endif\n\n    // Leave the tangent and bitangent uninitialized, we won't use them\n\n    shading_tangentToWorld[2] = normalize(n);\n\n#endif\n\n\n\n    shading_position = vertex_worldPosition;\n\n    shading_view = normalize(frameUniforms.cameraPosition - shading_position);\n\n}\n\n\n\n\n\nvoid prepareMaterial(const MaterialInputs material) {\n\n#if defined(HAS_ATTRIBUTE_TANGENTS)\n\n#if defined(MATERIAL_HAS_NORMAL)\n\n    shading_normal = normalize(shading_tangentToWorld * material.normal);\n\n#else\n\n    shading_normal = getWorldGeometricNormalVector();\n\n#endif\n\n    shading_NoV = clampNoV(dot(shading_normal, shading_view));\n\n    shading_reflected = reflect(-shading_view, shading_normal);\n\n\n\n#if defined(MATERIAL_HAS_CLEAR_COAT)\n\n#if defined(MATERIAL_HAS_CLEAR_COAT_NORMAL)\n\n    shading_clearCoatNormal = normalize(shading_tangentToWorld * material.clearCoatNormal);\n\n#else\n\n    shading_clearCoatNormal = getWorldGeometricNormalVector();\n\n#endif\n\n#endif\n\n#endif\n\n}\n\n";
	var fl_common_shading_frag = "// These variables should be in a struct but some GPU drivers ignore the\n\n// precision qualifier on individual struct members\n\n      // TBN matrix\n\nhighp mat3  shading_tangentToWorld;\n\n      // position of the fragment in world space\n\nhighp vec3  shading_position;\n\n      // normalized vector from the fragment to the eye\n\n      vec3  shading_view;\n\n      // normalized normal, in world space\n\n      vec3  shading_normal;\n\n      // reflection of view about normal\n\n      vec3  shading_reflected;\n\n      // dot(normal, view), always strictly >= MIN_N_DOT_V\n\n      float shading_NoV;\n\n\n\n#if defined(MATERIAL_HAS_CLEAR_COAT)\n\n      // normalized clear coat layer normal, in world space\n\n      vec3  shading_clearCoatNormal;\n\n#endif\n\n";
	var fl_getters_frag = "#if defined(HAS_ATTRIBUTE_COLOR)\n\n\n\nvec4 getColor() {\n\n    return vertex_color;\n\n}\n\n#endif\n\n\n\n#if defined(HAS_ATTRIBUTE_UV0)\n\n\n\nvec2 getUV0() {\n\n    return vertex_uv01.xy;\n\n}\n\n#endif\n\n\n\n#if defined(HAS_ATTRIBUTE_UV1)\n\n\n\nvec2 getUV1() {\n\n    return vertex_uv01.zw;\n\n}\n\n#endif\n\n\n\n#if defined(BLEND_MODE_MASKED)\n\n\n\nfloat getMaskThreshold() {\n\n    return materialParams._maskThreshold;\n\n}\n\n#endif\n\n\n\n\n\nhighp mat3 getWorldTangentFrame() {\n\n    return shading_tangentToWorld;\n\n}\n\n\n\n\n\nhighp vec3 getWorldPosition() {\n\n    return shading_position;\n\n}\n\n\n\n\n\nvec3 getWorldViewVector() {\n\n    return shading_view;\n\n}\n\n\n\n\n\nvec3 getWorldNormalVector() {\n\n    return shading_normal;\n\n}\n\n\n\n\n\nvec3 getWorldGeometricNormalVector() {\n\n    return shading_tangentToWorld[2];\n\n}\n\n\n\n\n\nvec3 getWorldReflectedVector() {\n\n    return shading_reflected;\n\n}\n\n\n\n\n\nfloat getNdotV() {\n\n    return shading_NoV;\n\n}\n\n\n\n\n\n#if defined(MATERIAL_HAS_DOUBLE_SIDED_CAPABILITY)\n\nbool isDoubleSided() {\n\n    return materialParams._doubleSided;\n\n}\n\n#endif\n\n";
	var fl_material_inputs_frag = "// Decide if we can skip lighting when dot(n, l) <= 0.0\n\n#if defined(SHADING_MODEL_CLOTH)\n\n#if !defined(MATERIAL_HAS_SUBSURFACE_COLOR)\n\n    #define MATERIAL_CAN_SKIP_LIGHTING\n\n#endif\n\n#elif defined(SHADING_MODEL_SUBSURFACE)\n\n    // Cannot skip lighting\n\n#else\n\n    #define MATERIAL_CAN_SKIP_LIGHTING\n\n#endif\n\n\n\nstruct MaterialInputs {\n\n    vec4  baseColor;\n\n#if !defined(SHADING_MODEL_UNLIT)\n\n#if !defined(SHADING_MODEL_SPECULAR_GLOSSINESS)\n\n    float roughness;\n\n#endif\n\n#if !defined(SHADING_MODEL_CLOTH) && !defined(SHADING_MODEL_SPECULAR_GLOSSINESS)\n\n    float metallic;\n\n    float reflectance;\n\n#endif\n\n    float ambientOcclusion;\n\n#endif\n\n    vec4  emissive;\n\n\n\n    float clearCoat;\n\n    float clearCoatRoughness;\n\n\n\n    float anisotropy;\n\n    vec3  anisotropyDirection;\n\n\n\n#if defined(SHADING_MODEL_SUBSURFACE)\n\n    float thickness;\n\n    float subsurfacePower;\n\n    vec3  subsurfaceColor;\n\n#endif\n\n\n\n#if defined(SHADING_MODEL_CLOTH)\n\n    vec3  sheenColor;\n\n#if defined(MATERIAL_HAS_SUBSURFACE_COLOR)\n\n    vec3  subsurfaceColor;\n\n#endif\n\n#endif\n\n\n\n#if defined(SHADING_MODEL_SPECULAR_GLOSSINESS)\n\n    vec3  specularColor;\n\n    float glossiness;\n\n#endif\n\n\n\n#if defined(MATERIAL_HAS_NORMAL)\n\n    vec3  normal;\n\n#endif\n\n#if defined(MATERIAL_HAS_CLEAR_COAT) && defined(MATERIAL_HAS_CLEAR_COAT_NORMAL)\n\n    vec3  clearCoatNormal;\n\n#endif\n\n\n\n#if defined(MATERIAL_HAS_POST_LIGHTING_COLOR)\n\n    vec4  postLightingColor;\n\n#endif\n\n};\n\n\n\nvoid initMaterial(out MaterialInputs material) {\n\n    material.baseColor = vec4(1.0);\n\n#if !defined(SHADING_MODEL_UNLIT)\n\n#if !defined(SHADING_MODEL_SPECULAR_GLOSSINESS)\n\n    material.roughness = 1.0;\n\n#endif\n\n#if !defined(SHADING_MODEL_CLOTH) && !defined(SHADING_MODEL_SPECULAR_GLOSSINESS)\n\n    material.metallic = 0.0;\n\n    material.reflectance = 0.5;\n\n#endif\n\n    material.ambientOcclusion = 1.0;\n\n#endif\n\n    material.emissive = vec4(0.0);\n\n\n\n#if defined(MATERIAL_HAS_CLEAR_COAT)\n\n    material.clearCoat = 1.0;\n\n    material.clearCoatRoughness = 0.0;\n\n#endif\n\n\n\n#if defined(MATERIAL_HAS_ANISOTROPY)\n\n    material.anisotropy = 0.0;\n\n    material.anisotropyDirection = vec3(1.0, 0.0, 0.0);\n\n#endif\n\n\n\n#if defined(SHADING_MODEL_SUBSURFACE)\n\n    material.thickness = 0.5;\n\n    material.subsurfacePower = 12.234;\n\n    material.subsurfaceColor = vec3(1.0);\n\n#endif\n\n\n\n#if defined(SHADING_MODEL_CLOTH)\n\n    material.sheenColor = sqrt(material.baseColor.rgb);\n\n#if defined(MATERIAL_HAS_SUBSURFACE_COLOR)\n\n    material.subsurfaceColor = vec3(0.0);\n\n#endif\n\n#endif\n\n\n\n#if defined(SHADING_MODEL_SPECULAR_GLOSSINESS)\n\n    material.glossiness = 0.0;\n\n    material.specularColor = vec3(0.0);\n\n#endif\n\n\n\n#if defined(MATERIAL_HAS_NORMAL)\n\n    material.normal = vec3(0.0, 0.0, 1.0);\n\n#endif\n\n#if defined(MATERIAL_HAS_CLEAR_COAT) && defined(MATERIAL_HAS_CLEAR_COAT_NORMAL)\n\n    material.clearCoatNormal = vec3(0.0, 0.0, 1.0);\n\n#endif\n\n\n\n#if defined(MATERIAL_HAS_POST_LIGHTING_COLOR)\n\n    material.postLightingColor = vec4(0.0);\n\n#endif\n\n}\n\n";
	var fl_common_material_frag = "#if defined(TARGET_MOBILE)\n\n    // min roughness such that (MIN_PERCEPTUAL_ROUGHNESS^4) > 0 in fp16 (i.e. 2^(-14/4), rounded up)\n\n    #define MIN_PERCEPTUAL_ROUGHNESS 0.089\n\n    #define MIN_ROUGHNESS            0.007921\n\n#else\n\n    #define MIN_PERCEPTUAL_ROUGHNESS 0.045\n\n    #define MIN_ROUGHNESS            0.002025\n\n#endif\n\n\n\n#define MAX_CLEAR_COAT_PERCEPTUAL_ROUGHNESS 0.6\n\n\n\n#define MIN_N_DOT_V 1e-4\n\n\n\nfloat clampNoV(float NoV) {\n\n    // Neubelt and Pettineo 2013, \"Crafting a Next-gen Material Pipeline for The Order: 1886\"\n\n    return max(dot(shading_normal, shading_view), MIN_N_DOT_V);\n\n}\n\n\n\nvec3 computeDiffuseColor(const vec4 baseColor, float metallic) {\n\n    return baseColor.rgb * (1.0 - metallic);\n\n}\n\n\n\nvec3 computeF0(const vec4 baseColor, float metallic, float reflectance) {\n\n    return baseColor.rgb * metallic + (reflectance * (1.0 - metallic));\n\n}\n\n\n\nfloat computeDielectricF0(float reflectance) {\n\n    return 0.16 * reflectance * reflectance;\n\n}\n\n\n\nfloat computeMetallicFromSpecularColor(const vec3 specularColor) {\n\n    return max3(specularColor);\n\n}\n\n\n\nfloat computeRoughnessFromGlossiness(float glossiness) {\n\n    return 1.0 - glossiness;\n\n}\n\n\n\nfloat perceptualRoughnessToRoughness(float perceptualRoughness) {\n\n    return perceptualRoughness * perceptualRoughness;\n\n}\n\n\n\nfloat roughnessToPerceptualRoughness(float roughness) {\n\n    return sqrt(roughness);\n\n}\n\n\n\nfloat iorToF0(float transmittedIor, float incidentIor) {\n\n    return sq((transmittedIor - incidentIor) / (transmittedIor + incidentIor));\n\n}\n\n\n\nfloat f0ToIor(float f0) {\n\n    float r = sqrt(f0);\n\n    return (1.0 + r) / (1.0 - r);\n\n}\n\n\n\nvec3 f0ClearCoatToSurface(const vec3 f0) {\n\n    // Approximation of iorTof0(f0ToIor(f0), 1.5)\n\n    // This assumes that the clear coat layer has an IOR of 1.5\n\n#if defined(TARGET_MOBILE)\n\n    return saturate(f0 * (f0 * 0.526868 + 0.529324) - 0.0482256);\n\n#else\n\n    return saturate(f0 * (f0 * (0.941892 - 0.263008 * f0) + 0.346479) - 0.0285998);\n\n#endif\n\n}\n\n";
	var fl_common_lighting_frag = "struct Light {\n\n    vec4 colorIntensity;  // rgb, pre-exposed intensity\n\n    vec3 l;\n\n    float attenuation;\n\n    float NoL;\n\n};\n\n\n\nstruct PixelParams {\n\n    vec3  diffuseColor;\n\n    float perceptualRoughness;\n\n    vec3  f0;\n\n    float roughness;\n\n    vec3  dfg;\n\n    vec3  energyCompensation;\n\n\n\n#if defined(MATERIAL_HAS_CLEAR_COAT)\n\n    float clearCoat;\n\n    float clearCoatPerceptualRoughness;\n\n    float clearCoatRoughness;\n\n#endif\n\n\n\n#if defined(MATERIAL_HAS_ANISOTROPY)\n\n    vec3  anisotropicT;\n\n    vec3  anisotropicB;\n\n    float anisotropy;\n\n#endif\n\n\n\n#if defined(SHADING_MODEL_SUBSURFACE)\n\n    float thickness;\n\n    vec3  subsurfaceColor;\n\n    float subsurfacePower;\n\n#endif\n\n\n\n#if defined(SHADING_MODEL_CLOTH) && defined(MATERIAL_HAS_SUBSURFACE_COLOR)\n\n    vec3  subsurfaceColor;\n\n#endif\n\n};\n\n\n\nfloat computeMicroShadowing(float NoL, float visibility) {\n\n    // Chan 2018, \"Material Advances in Call of Duty: WWII\"\n\n    float aperture = inversesqrt(1.0 - visibility);\n\n    float microShadow = saturate(NoL * aperture);\n\n    return microShadow * microShadow;\n\n}\n\n";
	var fl_material_uniforms_frag = "//maptalksgl的material定义\n\nuniform struct Material {\n\n    //https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#reference-pbrmetallicroughness\n\n    #if defined(MATERIAL_HAS_BASECOLOR_MAP)\n\n        sampler2D   baseColorTexture;\n\n    #else\n\n        vec4        baseColorFactor;\n\n    #endif\n\n    #if defined(MATERIAL_HAS_METALLICROUGHNESS_MAP)\n\n        //G: roughness B: metallic\n\n        sampler2D   metallicRoughnessTexture;\n\n    #else\n\n        #if !defined(SHADING_MODEL_CLOTH) && !defined(SHADING_MODEL_SUBSURFACE)\n\n            float       metallicFactor;\n\n        #endif\n\n        float       roughnessFactor;\n\n    #endif\n\n\n\n    //https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#occlusiontextureinfo\n\n    #if defined(MATERIAL_HAS_AMBIENT_OCCLUSION)\n\n        #if defined(MATERIAL_HAS_AO_MAP)\n\n            // default: 0.0\n\n            sampler2D occlusionTexture;\n\n        #else\n\n            float occlusion;\n\n        #endif\n\n            float occlusionStrength;\n\n    #endif\n\n\n\n    #if defined(MATERIAL_HAS_EMISSIVE)\n\n        #if defined(MATERIAL_HAS_EMISSIVE_MAP)\n\n            sampler2D emissiveTexture;\n\n        #else\n\n            float emissiveFactor;\n\n        #endif\n\n    #endif\n\n\n\n    #if defined(MATERIAL_HAS_POST_LIGHTING_COLOR)\n\n        // default: vec4(0.0)\n\n        vec4 postLightingColor;\n\n    #endif\n\n\n\n    #if !defined(SHADING_MODEL_CLOTH) && !defined(SHADING_MODEL_SUBSURFACE)\n\n        //TODO reflectance 是否能做成材质？\n\n        // default: 0.5, not available with cloth\n\n            float reflectance;\n\n        #if defined(MATERIAL_HAS_CLEAR_COAT)\n\n                // default: 1.0, 是否是clearCoat, 0 or 1\n\n                float clearCoat;\n\n            #if defined(MATERIAL_HAS_CLEARCOAT_ROUGNESS_MAP)\n\n                sampler2D clearCoatRoughnessTexture;\n\n            #else\n\n                // default: 0.0\n\n                float clearCoatRoughness;\n\n            #endif\n\n\n\n            #if defined(MATERIAL_HAS_CLEAR_COAT_NORMAL)\n\n                // default: vec3(0.0, 0.0, 1.0)\n\n                sampler2D clearCoatNormalTexture;\n\n            #endif\n\n        #endif\n\n\n\n        #if defined(MATERIAL_HAS_ANISOTROPY)\n\n            // default: 0.0\n\n            float anisotropy;\n\n            // default: vec3(1.0, 0.0, 0.0)\n\n            vec3 anisotropyDirection;\n\n        #endif\n\n\n\n    #elif defined(SHADING_MODEL_CLOTH)\n\n        vec3 sheenColor;\n\n        #if defined(MATERIAL_HAS_SUBSURFACE_COLOR)\n\n        vec3 subsurfaceColor;\n\n        #endif\n\n    #else\n\n        float thickness;\n\n        float subsurfacePower;\n\n        vec3 subsurfaceColor;\n\n    #endif\n\n\n\n    // not available when the shading model is unlit\n\n    // must be set before calling prepareMaterial()\n\n    #if defined(MATERIAL_HAS_NORMAL)\n\n        // default: vec3(0.0, 0.0, 1.0)\n\n        sampler2D normalTexture;\n\n    #endif\n\n} material;\n\n\n\nvec3 gammaCorrectInput(vec3 color) {\n\n    #if defined(GAMMA_CORRECT_INPUT)\n\n        return pow(color, vec3(2.2));\n\n    #else\n\n        return color;\n\n    #endif\n\n}\n\n\n\nvec4 gammaCorrectInput(vec4 color) {\n\n    #if defined(GAMMA_CORRECT_INPUT)\n\n        return vec4(gammaCorrectInput(color.rgb), color.a);\n\n    #else\n\n        return color;\n\n    #endif\n\n}\n\n\n\nvoid getMaterial(out MaterialInputs materialInputs) {\n\n    #if defined(MATERIAL_HAS_BASECOLOR_MAP)\n\n        materialInputs.baseColor = gammaCorrectInput(texture2D(material.baseColorTexture, vertex_uv01.xy));\n\n    #else\n\n        materialInputs.baseColor = material.baseColorFactor;\n\n    #endif\n\n\n\n    #if defined(MATERIAL_HAS_METALLICROUGHNESS_MAP)\n\n        vec2 roughnessMetallic = texture2D(material.metallicRoughnessTexture, vertex_uv01.xy).gb;\n\n        materialInputs.roughness = roughnessMetallic[0];\n\n        #if !defined(SHADING_MODEL_CLOTH) && !defined(SHADING_MODEL_SUBSURFACE)\n\n            materialInputs.metallic = roughnessMetallic[1];\n\n        #endif\n\n    #else\n\n        materialInputs.roughness = material.roughnessFactor;\n\n        #if !defined(SHADING_MODEL_CLOTH) && !defined(SHADING_MODEL_SUBSURFACE)\n\n            materialInputs.metallic = material.metallicFactor;\n\n        #endif\n\n    #endif\n\n\n\n    #if !defined(SHADING_MODEL_CLOTH) && !defined(SHADING_MODEL_SUBSURFACE)\n\n        //TODO 可能需要从纹理中读取\n\n        materialInputs.reflectance = material.reflectance;\n\n    #endif\n\n\n\n    #if defined(MATERIAL_HAS_AMBIENT_OCCLUSION)\n\n        #if defined(MATERIAL_HAS_AO_MAP)\n\n            materialInputs.ambientOcclusion = texture2D(material.occlusionTexture, vertex_uv01.xy).r;\n\n        #else\n\n            materialInputs.ambientOcclusion = material.occlusion;\n\n        #endif\n\n        materialInputs.ambientOcclusion *= material.occlusionStrength;\n\n    #endif\n\n\n\n    #if defined(MATERIAL_HAS_EMISSIVE)\n\n        #if defined(MATERIAL_HAS_EMISSIVE_MAP)\n\n            materialInputs.emissive = gammaCorrectInput(texture2D(material.emissiveTexture, vertex_uv01.xy));\n\n        #else\n\n            materialInputs.emissive = material.emissiveFactor;\n\n        #endif\n\n    #endif\n\n\n\n    #if defined(MATERIAL_HAS_CLEAR_COAT)\n\n        materialInputs.clearCoat = material.clearCoat;\n\n        #if defined(MATERIAL_HAS_CLEARCOAT_ROUGNESS_MAP)\n\n            materialInputs.clearCoatRoughness = texture2D(material.clearCoatRoughnessTexture, vertex_uv01.xy).g;\n\n        #else\n\n            materialInputs.clearCoatRoughness = material.clearCoatRoughness;\n\n        #endif\n\n\n\n        #if defined(MATERIAL_HAS_CLEAR_COAT_NORMAL)\n\n            materialInputs.clearCoatNormal = texture2D(material.clearCoatNormalTexture, vertex_uv01.xy).xyz * 2.0 - 1.0;\n\n        #endif\n\n    #endif\n\n\n\n    #if defined(MATERIAL_HAS_ANISOTROPY)\n\n        //anisotropy为1时，anisotropicLobe 中 at和ab 结果为1，产生anisotropy不再受roughness影响的现象，绘制结果不符合直觉\n\n        //乘以0.95后，最大值不再为1，则能避免此现象\n\n        materialInputs.anisotropy = material.anisotropy * 0.95;\n\n        materialInputs.anisotropyDirection = material.anisotropyDirection;\n\n    #endif\n\n\n\n    #if defined(MATERIAL_HAS_NORMAL)\n\n        materialInputs.normal = texture2D(material.normalTexture, vertex_uv01.xy).xyz * 2.0 - 1.0;\n\n    #endif\n\n\n\n    #if defined(MATERIAL_HAS_POST_LIGHTING_COLOR)\n\n        materialInputs.postLightingColor = material.postLightingColor;\n\n    #endif\n\n\n\n    #if defined(SHADING_MODEL_CLOTH)\n\n        if (material.sheenColor[0] >= 0.0) {\n\n            materialInputs.sheenColor = material.sheenColor;\n\n        }\n\n        #if defined(MATERIAL_HAS_SUBSURFACE_COLOR)\n\n            materialInputs.subsurfaceColor = material.subsurfaceColor;\n\n        #endif\n\n    #endif\n\n\n\n    #if defined(SHADING_MODEL_SUBSURFACE)\n\n        materialInputs.thickness = material.thickness;\n\n        materialInputs.subsurfacePower = material.subsurfacePower;\n\n        materialInputs.subsurfaceColor = material.subsurfaceColor;\n\n    #endif\n\n}\n\n";
	var fl_light_uniforms_frag = "//dfgMap\n\nuniform sampler2D light_iblDFG;\n\n//prefilterMap\n\nuniform samplerCube light_iblSpecular;\n\n";
	var fl_light_indirect = "//------------------------------------------------------------------------------\n\n// Image based lighting configuration\n\n//------------------------------------------------------------------------------\n\n\n\n#ifndef TARGET_MOBILE\n\n#define IBL_OFF_SPECULAR_PEAK\n\n#endif\n\n\n\n// Number of spherical harmonics bands (1, 2 or 3)\n\n#if defined(TARGET_MOBILE)\n\n#define SPHERICAL_HARMONICS_BANDS           2\n\n#else\n\n#define SPHERICAL_HARMONICS_BANDS           3\n\n#endif\n\n\n\n// IBL integration algorithm\n\n#define IBL_INTEGRATION_PREFILTERED_CUBEMAP         0\n\n#define IBL_INTEGRATION_IMPORTANCE_SAMPLING         1\n\n\n\n#define IBL_INTEGRATION                             IBL_INTEGRATION_PREFILTERED_CUBEMAP\n\n\n\n#define IBL_INTEGRATION_IMPORTANCE_SAMPLING_COUNT   64\n\n\n\n//------------------------------------------------------------------------------\n\n// IBL utilities\n\n//------------------------------------------------------------------------------\n\n\n\nvec3 decodeDataForIBL(const vec4 data) {\n\n    return data.rgb;\n\n}\n\n\n\n//------------------------------------------------------------------------------\n\n// IBL prefiltered DFG term implementations\n\n//------------------------------------------------------------------------------\n\n\n\nvec3 PrefilteredDFG_LUT(float lod, float NoV) {\n\n    // coord = sqrt(linear_roughness), which is the mapping used by cmgen.\n\n    return textureLod(light_iblDFG, vec2(NoV, lod), 0.0).rgb;\n\n}\n\n\n\n//------------------------------------------------------------------------------\n\n// IBL environment BRDF dispatch\n\n//------------------------------------------------------------------------------\n\n\n\nvec3 prefilteredDFG(float perceptualRoughness, float NoV) {\n\n    // PrefilteredDFG_LUT() takes a LOD, which is sqrt(roughness) = perceptualRoughness\n\n    return PrefilteredDFG_LUT(perceptualRoughness, NoV);\n\n}\n\n\n\n//------------------------------------------------------------------------------\n\n// IBL irradiance implementations\n\n//------------------------------------------------------------------------------\n\n\n\n// vec3 Irradiance_SphericalHarmonics(const vec3 n) {\n\n//     return max(\n\n//           frameUniforms.iblSH[0]\n\n// #if SPHERICAL_HARMONICS_BANDS >= 2\n\n//         + frameUniforms.iblSH[1] * (n.y)\n\n//         + frameUniforms.iblSH[2] * (n.z)\n\n//         + frameUniforms.iblSH[3] * (n.x)\n\n// #endif\n\n// #if SPHERICAL_HARMONICS_BANDS >= 3\n\n//         + frameUniforms.iblSH[4] * (n.y * n.x)\n\n//         + frameUniforms.iblSH[5] * (n.y * n.z)\n\n//         + frameUniforms.iblSH[6] * (3.0 * n.z * n.z - 1.0)\n\n//         + frameUniforms.iblSH[7] * (n.z * n.x)\n\n//         + frameUniforms.iblSH[8] * (n.x * n.x - n.y * n.y)\n\n// #endif\n\n//         , 0.0);\n\n// }\n\n\n\nvec3 sh(const vec3 sph[9], const in vec3 normal) {\n\n  float x = normal.x;\n\n  float y = normal.y;\n\n  float z = normal.z;\n\n\n\n  vec3 result = (\n\n    sph[0] +\n\n\n\n    sph[1] * x +\n\n    sph[2] * y +\n\n    sph[3] * z +\n\n\n\n    sph[4] * z * x +\n\n    sph[5] * y * z +\n\n    sph[6] * y * x +\n\n    sph[7] * (3.0 * z * z - 1.0) +\n\n    sph[8] * (x*x - y*y)\n\n  );\n\n\n\n  return max(result, vec3(0.0));\n\n}\n\n\n\n//------------------------------------------------------------------------------\n\n// IBL irradiance dispatch\n\n//------------------------------------------------------------------------------\n\nvec3 diffuseIrradiance(const vec3 n) {\n\n    // return Irradiance_SphericalHarmonics(n);\n\n    return sh(frameUniforms.iblSH, n);\n\n}\n\n\n\n//------------------------------------------------------------------------------\n\n// IBL specular\n\n//------------------------------------------------------------------------------\n\n\n\nvec3 prefilteredRadiance(const vec3 r, float perceptualRoughness) {\n\n    // lod = lod_count * sqrt(roughness), which is the mapping used by cmgen\n\n    // where roughness = perceptualRoughness^2\n\n    // using all the mip levels requires seamless cubemap sampling\n\n    float lod = frameUniforms.iblMaxMipLevel.x * perceptualRoughness;\n\n    return decodeDataForIBL(textureLod(light_iblSpecular, r, lod));\n\n}\n\n\n\nvec3 prefilteredRadiance(const vec3 r, float roughness, float offset) {\n\n    float lod = frameUniforms.iblMaxMipLevel.x * roughness;\n\n    return decodeDataForIBL(textureLod(light_iblSpecular, r, lod + offset));\n\n}\n\n\n\nvec3 getSpecularDominantDirection(vec3 n, vec3 r, float roughness) {\n\n#if defined(IBL_OFF_SPECULAR_PEAK)\n\n    float s = 1.0 - roughness;\n\n    return mix(n, r, s * (sqrt(s) + roughness));\n\n#else\n\n    return r;\n\n#endif\n\n}\n\n\n\nvec3 specularDFG(const PixelParams pixel) {\n\n#if defined(SHADING_MODEL_CLOTH)\n\n    return pixel.f0 * pixel.dfg.z;\n\n#elif !defined(USE_MULTIPLE_SCATTERING_COMPENSATION)\n\n    return pixel.f0 * pixel.dfg.x + pixel.dfg.y;\n\n#else\n\n    return mix(pixel.dfg.xxx, pixel.dfg.yyy, pixel.f0);\n\n#endif\n\n}\n\n\n\n\n\n\n\nvec3 getReflectedVector(const PixelParams pixel, const vec3 v, const vec3 n) {\n\n#if defined(MATERIAL_HAS_ANISOTROPY)\n\n    vec3  anisotropyDirection = pixel.anisotropy >= 0.0 ? pixel.anisotropicB : pixel.anisotropicT;\n\n    vec3  anisotropicTangent  = cross(anisotropyDirection, v);\n\n    vec3  anisotropicNormal   = cross(anisotropicTangent, anisotropyDirection);\n\n    float bendFactor          = abs(pixel.anisotropy) * saturate(5.0 * pixel.perceptualRoughness);\n\n    vec3  bentNormal          = normalize(mix(n, anisotropicNormal, bendFactor));\n\n\n\n    vec3 r = reflect(-v, bentNormal);\n\n#else\n\n    vec3 r = reflect(-v, n);\n\n#endif\n\n    return r;\n\n}\n\n\n\nvec3 getReflectedVector(const PixelParams pixel, const vec3 n) {\n\n#if defined(MATERIAL_HAS_ANISOTROPY)\n\n    vec3 r = getReflectedVector(pixel, shading_view, n);\n\n#else\n\n    vec3 r = shading_reflected;\n\n#endif\n\n    return getSpecularDominantDirection(n, r, pixel.roughness);\n\n}\n\n\n\n//------------------------------------------------------------------------------\n\n// Prefiltered importance sampling\n\n//------------------------------------------------------------------------------\n\n\n\n#if IBL_INTEGRATION == IBL_INTEGRATION_IMPORTANCE_SAMPLING\n\nvec2 hammersley(uint index) {\n\n    // Compute Hammersley sequence\n\n    // TODO: these should come from uniforms\n\n    // TODO: we should do this with logical bit operations\n\n    const uint numSamples = uint(IBL_INTEGRATION_IMPORTANCE_SAMPLING_COUNT);\n\n    const uint numSampleBits = uint(log2(float(numSamples)));\n\n    const float invNumSamples = 1.0 / float(numSamples);\n\n    uint i = uint(index);\n\n    uint t = i;\n\n    uint bits = 0u;\n\n    for (uint j = 0u; j < numSampleBits; j++) {\n\n        bits = bits * 2u + (t - (2u * (t / 2u)));\n\n        t /= 2u;\n\n    }\n\n    return vec2(float(i), float(bits)) * invNumSamples;\n\n}\n\n\n\nvec3 importanceSamplingNdfDggx(vec2 u, float roughness) {\n\n    // Importance sampling D_GGX\n\n    float a2 = roughness * roughness;\n\n    float phi = 2.0 * PI * u.x;\n\n    float cosTheta2 = (1.0 - u.y) / (1.0 + (a2 - 1.0) * u.y);\n\n    float cosTheta = sqrt(cosTheta2);\n\n    float sinTheta = sqrt(1.0 - cosTheta2);\n\n    return vec3(cos(phi) * sinTheta, sin(phi) * sinTheta, cosTheta);\n\n}\n\n\n\nvec3 importanceSamplingVNdfDggx(vec2 u, float roughness, vec3 v) {\n\n    // See: \"A Simpler and Exact Sampling Routine for the GGX Distribution of Visible Normals\", Eric Heitz\n\n    float alpha = roughness;\n\n\n\n    // stretch view\n\n    v = normalize(vec3(alpha * v.x, alpha * v.y, v.z));\n\n\n\n    // orthonormal basis\n\n    vec3 up = abs(v.z) < 0.9999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);\n\n    vec3 t = normalize(cross(up, v));\n\n    vec3 b = cross(t, v);\n\n\n\n    // sample point with polar coordinates (r, phi)\n\n    float a = 1.0 / (1.0 + v.z);\n\n    float r = sqrt(u.x);\n\n    float phi = (u.y < a) ? u.y / a * PI : PI + (u.y - a) / (1.0 - a) * PI;\n\n    float p1 = r * cos(phi);\n\n    float p2 = r * sin(phi) * ((u.y < a) ? 1.0 : v.z);\n\n\n\n    // compute normal\n\n    vec3 h = p1 * t + p2 * b + sqrt(max(0.0, 1.0 - p1*p1 - p2*p2)) * v;\n\n\n\n    // unstretch\n\n    h = normalize(vec3(alpha * h.x, alpha * h.y, max(0.0, h.z)));\n\n    return h;\n\n}\n\n\n\nfloat prefilteredImportanceSampling(float ipdf, vec2 iblMaxMipLevel) {\n\n    // See: \"Real-time Shading with Filtered Importance Sampling\", Jaroslav Krivanek\n\n    // Prefiltering doesn't work with anisotropy\n\n    const float numSamples = float(IBL_INTEGRATION_IMPORTANCE_SAMPLING_COUNT);\n\n    const float invNumSamples = 1.0 / float(numSamples);\n\n    const float dim = iblMaxMipLevel.y;\n\n    const float omegaP = (4.0 * PI) / (6.0 * dim * dim);\n\n    const float invOmegaP = 1.0 / omegaP;\n\n    const float K = 4.0;\n\n    float omegaS = invNumSamples * ipdf;\n\n    float mipLevel = clamp(log2(K * omegaS * invOmegaP) * 0.5, 0.0, iblMaxMipLevel.x);\n\n    return mipLevel;\n\n}\n\n\n\nvec3 isEvaluateIBL(const PixelParams pixel, vec3 n, vec3 v, float NoV) {\n\n    // TODO: for a true anisotropic BRDF, we need a real tangent space\n\n    vec3 up = abs(n.z) < 0.9999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);\n\n\n\n    mat3 tangentToWorld;\n\n    tangentToWorld[0] = normalize(cross(up, n));\n\n    tangentToWorld[1] = cross(n, tangentToWorld[0]);\n\n    tangentToWorld[2] = n;\n\n\n\n    float roughness = pixel.roughness;\n\n    float a2 = roughness * roughness;\n\n\n\n    vec2 iblMaxMipLevel = frameUniforms.iblMaxMipLevel;\n\n    const uint numSamples = uint(IBL_INTEGRATION_IMPORTANCE_SAMPLING_COUNT);\n\n    const float invNumSamples = 1.0 / float(numSamples);\n\n\n\n    vec3 indirectSpecular = vec3(0.0);\n\n    for (uint i = 0u; i < numSamples; i++) {\n\n        vec2 u = hammersley(i);\n\n        vec3 h = tangentToWorld * importanceSamplingNdfDggx(u, roughness);\n\n\n\n        // Since anisotropy doesn't work with prefiltering, we use the same \"faux\" anisotropy\n\n        // we do when we use the prefiltered cubemap\n\n        vec3 l = getReflectedVector(pixel, v, h);\n\n\n\n        // Compute this sample's contribution to the brdf\n\n        float NoL = dot(n, l);\n\n        if (NoL > 0.0) {\n\n            float NoH = dot(n, h);\n\n            float LoH = max(dot(l, h), 0.0);\n\n\n\n            // PDF inverse (we must use D_GGX() here, which is used to generate samples)\n\n            float ipdf = (4.0 * LoH) / (D_GGX(roughness, NoH, h) * NoH);\n\n\n\n            float mipLevel = prefilteredImportanceSampling(ipdf, iblMaxMipLevel);\n\n\n\n            // we use texture() instead of textureLod() to take advantage of mipmapping\n\n            vec3 L = decodeDataForIBL(texture(light_iblSpecular, l, mipLevel));\n\n\n\n            float D = distribution(roughness, NoH, h);\n\n            float V = visibility(roughness, NoV, NoL, LoH);\n\n            vec3  F = fresnel(pixel.f0, LoH);\n\n            vec3 Fr = F * (D * V * NoL * ipdf * invNumSamples);\n\n\n\n            indirectSpecular += (Fr * L);\n\n        }\n\n    }\n\n\n\n    return indirectSpecular;\n\n}\n\n\n\nvoid isEvaluateClearCoatIBL(const PixelParams pixel, float specularAO, inout vec3 Fd, inout vec3 Fr) {\n\n#if defined(MATERIAL_HAS_CLEAR_COAT)\n\n#if defined(MATERIAL_HAS_NORMAL) || defined(MATERIAL_HAS_CLEAR_COAT_NORMAL)\n\n    // We want to use the geometric normal for the clear coat layer\n\n    float clearCoatNoV = clampNoV(dot(shading_clearCoatNormal, shading_view));\n\n    vec3 clearCoatNormal = shading_clearCoatNormal;\n\n#else\n\n    float clearCoatNoV = shading_NoV;\n\n    vec3 clearCoatNormal = shading_normal;\n\n#endif\n\n    // The clear coat layer assumes an IOR of 1.5 (4% reflectance)\n\n    float Fc = F_Schlick(0.04, 1.0, clearCoatNoV) * pixel.clearCoat;\n\n    float attenuation = 1.0 - Fc;\n\n    Fd *= attenuation;\n\n    Fr *= sq(attenuation);\n\n\n\n    PixelParams p;\n\n    p.perceptualRoughness = pixel.clearCoatPerceptualRoughness;\n\n    p.f0 = vec3(0.04);\n\n    p.roughness = perceptualRoughnessToRoughness(p.perceptualRoughness);\n\n    p.anisotropy = 0.0;\n\n\n\n    vec3 clearCoatLobe = isEvaluateIBL(p, clearCoatNormal, shading_view, clearCoatNoV);\n\n    Fr += clearCoatLobe * (specularAO * pixel.clearCoat);\n\n#endif\n\n}\n\n#endif\n\n\n\n//------------------------------------------------------------------------------\n\n// IBL evaluation\n\n//------------------------------------------------------------------------------\n\n\n\nvoid evaluateClothIndirectDiffuseBRDF(const PixelParams pixel, inout float diffuse) {\n\n#if defined(SHADING_MODEL_CLOTH)\n\n#if defined(MATERIAL_HAS_SUBSURFACE_COLOR)\n\n    // Simulate subsurface scattering with a wrap diffuse term\n\n    diffuse *= Fd_Wrap(shading_NoV, 0.5);\n\n#endif\n\n#endif\n\n}\n\n\n\nvoid evaluateClearCoatIBL(const PixelParams pixel, float specularAO, inout vec3 Fd, inout vec3 Fr) {\n\n#if defined(MATERIAL_HAS_CLEAR_COAT)\n\n#if defined(MATERIAL_HAS_NORMAL) || defined(MATERIAL_HAS_CLEAR_COAT_NORMAL)\n\n    // We want to use the geometric normal for the clear coat layer\n\n    float clearCoatNoV = clampNoV(dot(shading_clearCoatNormal, shading_view));\n\n    vec3 clearCoatR = reflect(-shading_view, shading_clearCoatNormal);\n\n#else\n\n    float clearCoatNoV = shading_NoV;\n\n    vec3 clearCoatR = shading_reflected;\n\n#endif\n\n    // The clear coat layer assumes an IOR of 1.5 (4% reflectance)\n\n    float Fc = F_Schlick(0.04, 1.0, clearCoatNoV) * pixel.clearCoat;\n\n    float attenuation = 1.0 - Fc;\n\n    Fr *= sq(attenuation);\n\n    Fr += prefilteredRadiance(clearCoatR, pixel.clearCoatPerceptualRoughness) * (specularAO * Fc);\n\n    Fd *= attenuation;\n\n#endif\n\n}\n\n\n\nvoid evaluateSubsurfaceIBL(const PixelParams pixel, const vec3 diffuseIrradiance,\n\n        inout vec3 Fd, inout vec3 Fr) {\n\n#if defined(SHADING_MODEL_SUBSURFACE)\n\n    vec3 viewIndependent = diffuseIrradiance;\n\n    vec3 viewDependent = prefilteredRadiance(-shading_view, pixel.roughness, 1.0 + pixel.thickness);\n\n    float attenuation = (1.0 - pixel.thickness) / (2.0 * PI);\n\n    Fd += pixel.subsurfaceColor * (viewIndependent + viewDependent) * attenuation;\n\n#elif defined(SHADING_MODEL_CLOTH) && defined(MATERIAL_HAS_SUBSURFACE_COLOR)\n\n    Fd *= saturate(pixel.subsurfaceColor + shading_NoV);\n\n#endif\n\n}\n\n\n\nvoid evaluateIBL(const MaterialInputs material, const PixelParams pixel, inout vec3 color) {\n\n    // Apply transform here if we wanted to rotate the IBL\n\n    vec3 n = shading_normal;\n\n    vec3 r = getReflectedVector(pixel, n);\n\n\n\n    // float ssao = evaluateSSAO();\n\n    // float diffuseAO = min(material.ambientOcclusion, ssao);\n\n    float diffuseAO = min(material.ambientOcclusion, 0.0);\n\n    float specularAO = computeSpecularAO(shading_NoV, diffuseAO, pixel.roughness);\n\n\n\n    // diffuse indirect\n\n    float diffuseBRDF = singleBounceAO(diffuseAO);// Fd_Lambert() is baked in the SH below\n\n    evaluateClothIndirectDiffuseBRDF(pixel, diffuseBRDF);\n\n\n\n    vec3 diffuseIrradiance = diffuseIrradiance(n);\n\n    vec3 Fd = pixel.diffuseColor * diffuseIrradiance * diffuseBRDF;\n\n\n\n    // specular indirect\n\n    vec3 Fr;\n\n#if IBL_INTEGRATION == IBL_INTEGRATION_PREFILTERED_CUBEMAP\n\n    Fr = specularDFG(pixel) * prefilteredRadiance(r, pixel.perceptualRoughness);\n\n    Fr *= singleBounceAO(specularAO) * pixel.energyCompensation;\n\n    evaluateClearCoatIBL(pixel, specularAO, Fd, Fr);\n\n#elif IBL_INTEGRATION == IBL_INTEGRATION_IMPORTANCE_SAMPLING\n\n    Fr = isEvaluateIBL(pixel, shading_normal, shading_view, shading_NoV);\n\n    Fr *= singleBounceAO(specularAO) * pixel.energyCompensation;\n\n    isEvaluateClearCoatIBL(pixel, specularAO, Fd, Fr);\n\n#endif\n\n    evaluateSubsurfaceIBL(pixel, diffuseIrradiance, Fd, Fr);\n\n\n\n    multiBounceAO(diffuseAO, pixel.diffuseColor, Fd);\n\n    multiBounceSpecularAO(specularAO, pixel.f0, Fr);\n\n\n\n    // Note: iblLuminance is already premultiplied by the exposure\n\n    color.rgb += (Fd + Fr) * frameUniforms.iblLuminance;\n\n}\n\n";
	var fl_ambient_occlusion_frag = "#define MULTI_BOUNCE_AMBIENT_OCCLUSION 0\n\n#define SPECULAR_AMBIENT_OCCLUSION 0\n\n//------------------------------------------------------------------------------\n\n// Ambient occlusion helpers\n\n//------------------------------------------------------------------------------\n\n\n\nfloat evaluateSSAO() {\n\n    // TODO: Don't use gl_FragCoord.xy, use the view bounds\n\n    // vec2 uv = gl_FragCoord.xy * frameUniforms.resolution.zw;\n\n    // return texture(light_ssao, uv, 0.0).r;\n\n    return 1.0;\n\n}\n\n\n\n\n\nfloat computeSpecularAO(float NoV, float visibility, float roughness) {\n\n#if SPECULAR_AMBIENT_OCCLUSION == 1\n\n    return saturate(pow(NoV + visibility, exp2(-16.0 * roughness - 1.0)) - 1.0 + visibility);\n\n#else\n\n    return 1.0;\n\n#endif\n\n}\n\n\n\n#if MULTI_BOUNCE_AMBIENT_OCCLUSION == 1\n\n\n\nvec3 gtaoMultiBounce(float visibility, const vec3 albedo) {\n\n    // Jimenez et al. 2016, \"Practical Realtime Strategies for Accurate Indirect Occlusion\"\n\n    vec3 a =  2.0404 * albedo - 0.3324;\n\n    vec3 b = -4.7951 * albedo + 0.6417;\n\n    vec3 c =  2.7552 * albedo + 0.6903;\n\n\n\n    return max(vec3(visibility), ((visibility * a + b) * visibility + c) * visibility);\n\n}\n\n#endif\n\n\n\nvoid multiBounceAO(float visibility, const vec3 albedo, inout vec3 color) {\n\n#if MULTI_BOUNCE_AMBIENT_OCCLUSION == 1\n\n    color *= gtaoMultiBounce(visibility, albedo);\n\n#endif\n\n}\n\n\n\nvoid multiBounceSpecularAO(float visibility, const vec3 albedo, inout vec3 color) {\n\n#if MULTI_BOUNCE_AMBIENT_OCCLUSION == 1 && SPECULAR_AMBIENT_OCCLUSION == 1\n\n    color *= gtaoMultiBounce(visibility, albedo);\n\n#endif\n\n}\n\n\n\nfloat singleBounceAO(float visibility) {\n\n#if MULTI_BOUNCE_AMBIENT_OCCLUSION == 1\n\n    return 1.0;\n\n#else\n\n    return visibility;\n\n#endif\n\n}\n\n";
	var fl_shading_model_standard_frag = "#if defined(MATERIAL_HAS_CLEAR_COAT)\n\nfloat clearCoatLobe(const PixelParams pixel, const vec3 h, float NoH, float LoH, out float Fcc) {\n\n\n\n#if defined(MATERIAL_HAS_NORMAL) || defined(MATERIAL_HAS_CLEAR_COAT_NORMAL)\n\n    // If the material has a normal map, we want to use the geometric normal\n\n    // instead to avoid applying the normal map details to the clear coat layer\n\n    float clearCoatNoH = saturate(dot(shading_clearCoatNormal, h));\n\n#else\n\n    float clearCoatNoH = NoH;\n\n#endif\n\n\n\n    // clear coat specular lobe\n\n    float D = distributionClearCoat(pixel.clearCoatRoughness, clearCoatNoH, h);\n\n    float V = visibilityClearCoat(LoH);\n\n    float F = F_Schlick(0.04, 1.0, LoH) * pixel.clearCoat; // fix IOR to 1.5\n\n\n\n    Fcc = F;\n\n    return D * V * F;\n\n}\n\n#endif\n\n\n\n#if defined(MATERIAL_HAS_ANISOTROPY)\n\nvec3 anisotropicLobe(const PixelParams pixel, const Light light, const vec3 h,\n\n        float NoV, float NoL, float NoH, float LoH) {\n\n\n\n    vec3 l = light.l;\n\n    vec3 t = pixel.anisotropicT;\n\n    vec3 b = pixel.anisotropicB;\n\n    vec3 v = shading_view;\n\n\n\n    float ToV = dot(t, v);\n\n    float BoV = dot(b, v);\n\n    float ToL = dot(t, l);\n\n    float BoL = dot(b, l);\n\n    float ToH = dot(t, h);\n\n    float BoH = dot(b, h);\n\n\n\n    // Anisotropic parameters: at and ab are the roughness along the tangent and bitangent\n\n    // to simplify materials, we derive them from a single roughness parameter\n\n    // Kulla 2017, \"Revisiting Physically Based Shading at Imageworks\"\n\n    float at = max(pixel.roughness * (1.0 + pixel.anisotropy), MIN_ROUGHNESS);\n\n    float ab = max(pixel.roughness * (1.0 - pixel.anisotropy), MIN_ROUGHNESS);\n\n\n\n    // specular anisotropic BRDF\n\n    float D = distributionAnisotropic(at, ab, ToH, BoH, NoH);\n\n    float V = visibilityAnisotropic(pixel.roughness, at, ab, ToV, BoV, ToL, BoL, NoV, NoL);\n\n    vec3  F = fresnel(pixel.f0, LoH);\n\n\n\n    return (D * V) * F;\n\n}\n\n#endif\n\n\n\nvec3 isotropicLobe(const PixelParams pixel, const Light light, const vec3 h,\n\n        float NoV, float NoL, float NoH, float LoH) {\n\n\n\n    float D = distribution(pixel.roughness, NoH, h);\n\n    float V = visibility(pixel.roughness, NoV, NoL, LoH);\n\n    vec3  F = fresnel(pixel.f0, LoH);\n\n\n\n    return (D * V) * F;\n\n}\n\n\n\nvec3 specularLobe(const PixelParams pixel, const Light light, const vec3 h,\n\n        float NoV, float NoL, float NoH, float LoH) {\n\n#if defined(MATERIAL_HAS_ANISOTROPY)\n\n    return anisotropicLobe(pixel, light, h, NoV, NoL, NoH, LoH);\n\n#else\n\n    return isotropicLobe(pixel, light, h, NoV, NoL, NoH, LoH);\n\n#endif\n\n}\n\n\n\nvec3 diffuseLobe(const PixelParams pixel, float NoV, float NoL, float LoH) {\n\n    return pixel.diffuseColor * diffuse(pixel.roughness, NoV, NoL, LoH);\n\n}\n\n\n\n\n\nvec3 surfaceShading(const PixelParams pixel, const Light light, float occlusion) {\n\n    vec3 h = normalize(shading_view + light.l);\n\n\n\n    float NoV = shading_NoV;\n\n    float NoL = saturate(light.NoL);\n\n    float NoH = saturate(dot(shading_normal, h));\n\n    float LoH = saturate(dot(light.l, h));\n\n\n\n    vec3 Fr = specularLobe(pixel, light, h, NoV, NoL, NoH, LoH);\n\n    vec3 Fd = diffuseLobe(pixel, NoV, NoL, LoH);\n\n\n\n#if defined(MATERIAL_HAS_CLEAR_COAT)\n\n    float Fcc;\n\n    float clearCoat = clearCoatLobe(pixel, h, NoH, LoH, Fcc);\n\n    // Energy compensation and absorption; the clear coat Fresnel term is\n\n    // squared to take into account both entering through and exiting through\n\n    // the clear coat layer\n\n    float attenuation = 1.0 - Fcc;\n\n\n\n#if defined(MATERIAL_HAS_NORMAL) || defined(MATERIAL_HAS_CLEAR_COAT_NORMAL)\n\n    vec3 color = (Fd + Fr * (pixel.energyCompensation * attenuation)) * attenuation * NoL;\n\n\n\n    // If the material has a normal map, we want to use the geometric normal\n\n    // instead to avoid applying the normal map details to the clear coat layer\n\n    float clearCoatNoL = saturate(dot(shading_clearCoatNormal, light.l));\n\n    color += clearCoat * clearCoatNoL;\n\n\n\n    // Early exit to avoid the extra multiplication by NoL\n\n    return (color * light.colorIntensity.rgb) *\n\n            (light.colorIntensity.w * light.attenuation * occlusion);\n\n#else\n\n    vec3 color = (Fd + Fr * (pixel.energyCompensation * attenuation)) * attenuation + clearCoat;\n\n#endif\n\n#else\n\n    // The energy compensation term is used to counteract the darkening effect\n\n    // at high roughness\n\n    vec3 color = Fd + Fr * pixel.energyCompensation;\n\n#endif\n\n\n\n    return (color * light.colorIntensity.rgb) *\n\n            (light.colorIntensity.w * light.attenuation * NoL * occlusion);\n\n}\n\n";
	var fl_shading_model_cloth_frag = "\n\nvec3 surfaceShading(const PixelParams pixel, const Light light, float occlusion) {\n\n    vec3 h = normalize(shading_view + light.l);\n\n    float NoL = light.NoL;\n\n    float NoH = saturate(dot(shading_normal, h));\n\n    float LoH = saturate(dot(light.l, h));\n\n\n\n    // specular BRDF\n\n    float D = distributionCloth(pixel.roughness, NoH);\n\n    float V = visibilityCloth(shading_NoV, NoL);\n\n    vec3  F = pixel.f0;\n\n    // Ignore pixel.energyCompensation since we use a different BRDF here\n\n    vec3 Fr = (D * V) * F;\n\n\n\n    // diffuse BRDF\n\n    float diffuse = diffuse(pixel.roughness, shading_NoV, NoL, LoH);\n\n#if defined(MATERIAL_HAS_SUBSURFACE_COLOR)\n\n    // Energy conservative wrap diffuse to simulate subsurface scattering\n\n    diffuse *= Fd_Wrap(dot(shading_normal, light.l), 0.5);\n\n#endif\n\n\n\n    // We do not multiply the diffuse term by the Fresnel term as discussed in\n\n    // Neubelt and Pettineo 2013, \"Crafting a Next-gen Material Pipeline for The Order: 1886\"\n\n    // The effect is fairly subtle and not deemed worth the cost for mobile\n\n    vec3 Fd = diffuse * pixel.diffuseColor;\n\n\n\n#if defined(MATERIAL_HAS_SUBSURFACE_COLOR)\n\n    // Cheap subsurface scatter\n\n    Fd *= saturate(pixel.subsurfaceColor + NoL);\n\n    // We need to apply NoL separately to the specular lobe since we already took\n\n    // it into account in the diffuse lobe\n\n    vec3 color = Fd + Fr * NoL;\n\n    color *= light.colorIntensity.rgb * (light.colorIntensity.w * light.attenuation * occlusion);\n\n#else\n\n    vec3 color = Fd + Fr;\n\n    color *= light.colorIntensity.rgb * (light.colorIntensity.w * light.attenuation * NoL * occlusion);\n\n#endif\n\n\n\n    return color;\n\n}\n\n";
	var fl_shading_model_subsurface_frag = "\n\nvec3 surfaceShading(const PixelParams pixel, const Light light, float occlusion) {\n\n    vec3 h = normalize(shading_view + light.l);\n\n\n\n    float NoL = light.NoL;\n\n    float NoH = saturate(dot(shading_normal, h));\n\n    float LoH = saturate(dot(light.l, h));\n\n\n\n    vec3 Fr = vec3(0.0);\n\n    if (NoL > 0.0) {\n\n        // specular BRDF\n\n        float D = distribution(pixel.roughness, NoH, h);\n\n        float V = visibility(pixel.roughness, shading_NoV, NoL, LoH);\n\n        vec3  F = fresnel(pixel.f0, LoH);\n\n        Fr = (D * V) * F * pixel.energyCompensation;\n\n    }\n\n\n\n    // diffuse BRDF\n\n    vec3 Fd = pixel.diffuseColor * diffuse(pixel.roughness, shading_NoV, NoL, LoH);\n\n\n\n    // NoL does not apply to transmitted light\n\n    vec3 color = (Fd + Fr) * (NoL * occlusion);\n\n\n\n    // subsurface scattering\n\n    // Use a spherical gaussian approximation of pow() for forwardScattering\n\n    // We could include distortion by adding shading_normal * distortion to light.l\n\n    float scatterVoH = saturate(dot(shading_view, -light.l));\n\n    float forwardScatter = exp2(scatterVoH * pixel.subsurfacePower - pixel.subsurfacePower);\n\n    float backScatter = saturate(NoL * pixel.thickness + (1.0 - pixel.thickness)) * 0.5;\n\n    float subsurface = mix(backScatter, 1.0, forwardScatter) * (1.0 - pixel.thickness);\n\n    color += pixel.subsurfaceColor * (subsurface * Fd_Lambert());\n\n\n\n    // TODO: apply occlusion to the transmitted light\n\n    return (color * light.colorIntensity.rgb) * (light.colorIntensity.w * light.attenuation);\n\n}\n\n";
	var fl_light_directional = "//------------------------------------------------------------------------------\n\n// Directional light evaluation\n\n//------------------------------------------------------------------------------\n\n\n\n#if !defined(TARGET_MOBILE)\n\n#define SUN_AS_AREA_LIGHT\n\n#endif\n\n\n\nvec3 sampleSunAreaLight(const vec3 lightDirection) {\n\n#if defined(SUN_AS_AREA_LIGHT)\n\n    if (frameUniforms.sun.w >= 0.0) {\n\n        // simulate sun as disc area light\n\n        float LoR = dot(lightDirection, shading_reflected);\n\n        float d = frameUniforms.sun.x;\n\n        highp vec3 s = shading_reflected - LoR * lightDirection;\n\n        return LoR < d ?\n\n                normalize(lightDirection * d + normalize(s) * frameUniforms.sun.y) : shading_reflected;\n\n    }\n\n#endif\n\n    return lightDirection;\n\n}\n\n\n\nLight getDirectionalLight() {\n\n    Light light;\n\n    // note: lightColorIntensity.w is always premultiplied by the exposure\n\n    light.colorIntensity = frameUniforms.lightColorIntensity;\n\n    light.l = sampleSunAreaLight(frameUniforms.lightDirection);\n\n    light.attenuation = 1.0;\n\n    light.NoL = saturate(dot(shading_normal, light.l));\n\n    return light;\n\n}\n\n\n\nvoid evaluateDirectionalLight(const MaterialInputs material,\n\n        const PixelParams pixel, inout vec3 color) {\n\n\n\n    Light light = getDirectionalLight();\n\n\n\n    float visibility = 1.0;\n\n#if defined(HAS_SHADOWING)\n\n    if (light.NoL > 0.0) {\n\n        visibility = shadow_computeShadow();\n\n        // visibility = shadow(light_shadowMap, getLightSpacePosition());\n\n        #if defined(MATERIAL_HAS_AMBIENT_OCCLUSION)\n\n        visibility *= computeMicroShadowing(light.NoL, material.ambientOcclusion);\n\n        #endif\n\n    } else {\n\n#if defined(MATERIAL_CAN_SKIP_LIGHTING)\n\n        return;\n\n#endif\n\n    }\n\n#elif defined(MATERIAL_CAN_SKIP_LIGHTING)\n\n    if (light.NoL <= 0.0) return;\n\n#endif\n\n\n\n    color.rgb += surfaceShading(pixel, light, visibility);\n\n}\n\n";
	var fl_shading_lit = "//------------------------------------------------------------------------------\n\n// Lighting\n\n//------------------------------------------------------------------------------\n\n\n\nfloat computeDiffuseAlpha(float a) {\n\n#if defined(BLEND_MODE_TRANSPARENT) || defined(BLEND_MODE_FADE) || defined(BLEND_MODE_MASKED)\n\n    return a;\n\n#else\n\n    return 1.0;\n\n#endif\n\n}\n\n\n\n#if defined(BLEND_MODE_MASKED)\n\nfloat computeMaskedAlpha(float a) {\n\n    // Use derivatives to smooth alpha tested edges\n\n    return (a - getMaskThreshold()) / max(fwidth(a), 1e-3) + 0.5;\n\n}\n\n#endif\n\n\n\nvoid applyAlphaMask(inout vec4 baseColor) {\n\n#if defined(BLEND_MODE_MASKED)\n\n    baseColor.a = computeMaskedAlpha(baseColor.a);\n\n    if (baseColor.a <= 0.0) {\n\n        discard;\n\n    }\n\n#endif\n\n}\n\n\n\n#if defined(GEOMETRIC_SPECULAR_AA)\n\nfloat normalFiltering(float perceptualRoughness, const vec3 worldNormal) {\n\n    // Kaplanyan 2016, \"Stable specular highlights\"\n\n    // Tokuyoshi 2017, \"Error Reduction and Simplification for Shading Anti-Aliasing\"\n\n    // Tokuyoshi and Kaplanyan 2019, \"Improved Geometric Specular Antialiasing\"\n\n\n\n    // This implementation is meant for deferred rendering in the original paper but\n\n    // we use it in forward rendering as well (as discussed in Tokuyoshi and Kaplanyan\n\n    // 2019). The main reason is that the forward version requires an expensive transform\n\n    // of the half vector by the tangent frame for every light. This is therefore an\n\n    // approximation but it works well enough for our needs and provides an improvement\n\n    // over our original implementation based on Vlachos 2015, \"Advanced VR Rendering\".\n\n\n\n    vec3 du = dFdx(worldNormal);\n\n    vec3 dv = dFdy(worldNormal);\n\n\n\n    float variance = materialParams._specularAntiAliasingVariance * (dot(du, du) + dot(dv, dv));\n\n\n\n    float roughness = perceptualRoughnessToRoughness(perceptualRoughness);\n\n    float kernelRoughness = min(2.0 * variance, materialParams._specularAntiAliasingThreshold);\n\n    float squareRoughness = saturate(roughness * roughness + kernelRoughness);\n\n\n\n    return roughnessToPerceptualRoughness(sqrt(squareRoughness));\n\n}\n\n#endif\n\n\n\nvoid getCommonPixelParams(const MaterialInputs material, inout PixelParams pixel) {\n\n    vec4 baseColor = material.baseColor;\n\n    applyAlphaMask(baseColor);\n\n\n\n#if defined(BLEND_MODE_FADE) && !defined(SHADING_MODEL_UNLIT)\n\n    // Since we work in premultiplied alpha mode, we need to un-premultiply\n\n    // in fade mode so we can apply alpha to both the specular and diffuse\n\n    // components at the end\n\n    unpremultiply(baseColor);\n\n#endif\n\n\n\n#if defined(SHADING_MODEL_SPECULAR_GLOSSINESS)\n\n    // This is from KHR_materials_pbrSpecularGlossiness.\n\n    vec3 specularColor = material.specularColor;\n\n    float metallic = computeMetallicFromSpecularColor(specularColor);\n\n\n\n    pixel.diffuseColor = computeDiffuseColor(baseColor, metallic);\n\n    pixel.f0 = specularColor;\n\n#elif !defined(SHADING_MODEL_CLOTH)\n\n    pixel.diffuseColor = computeDiffuseColor(baseColor, material.metallic);\n\n\n\n    // Assumes an interface from air to an IOR of 1.5 for dielectrics\n\n    float reflectance = computeDielectricF0(material.reflectance);\n\n    pixel.f0 = computeF0(baseColor, material.metallic, reflectance);\n\n#else\n\n    pixel.diffuseColor = baseColor.rgb;\n\n    pixel.f0 = material.sheenColor;\n\n#if defined(MATERIAL_HAS_SUBSURFACE_COLOR)\n\n    pixel.subsurfaceColor = material.subsurfaceColor;\n\n#endif\n\n#endif\n\n}\n\n\n\nvoid getClearCoatPixelParams(const MaterialInputs material, inout PixelParams pixel) {\n\n#if defined(MATERIAL_HAS_CLEAR_COAT)\n\n    pixel.clearCoat = material.clearCoat;\n\n\n\n    // Clamp the clear coat roughness to avoid divisions by 0\n\n    float clearCoatPerceptualRoughness = material.clearCoatRoughness;\n\n    clearCoatPerceptualRoughness = mix(MIN_PERCEPTUAL_ROUGHNESS,\n\n            MAX_CLEAR_COAT_PERCEPTUAL_ROUGHNESS, clearCoatPerceptualRoughness);\n\n\n\n#if defined(GEOMETRIC_SPECULAR_AA)\n\n    clearCoatPerceptualRoughness =\n\n            normalFiltering(clearCoatPerceptualRoughness, getWorldGeometricNormalVector());\n\n#endif\n\n\n\n    pixel.clearCoatPerceptualRoughness = clearCoatPerceptualRoughness;\n\n    pixel.clearCoatRoughness = perceptualRoughnessToRoughness(clearCoatPerceptualRoughness);\n\n\n\n#if defined(CLEAR_COAT_IOR_CHANGE)\n\n    // The base layer's f0 is computed assuming an interface from air to an IOR\n\n    // of 1.5, but the clear coat layer forms an interface from IOR 1.5 to IOR\n\n    // 1.5. We recompute f0 by first computing its IOR, then reconverting to f0\n\n    // by using the correct interface\n\n    pixel.f0 = mix(pixel.f0, f0ClearCoatToSurface(pixel.f0), pixel.clearCoat);\n\n#endif\n\n#endif\n\n}\n\n\n\nvoid getRoughnessPixelParams(const MaterialInputs material, inout PixelParams pixel) {\n\n#if defined(SHADING_MODEL_SPECULAR_GLOSSINESS)\n\n    float perceptualRoughness = computeRoughnessFromGlossiness(material.glossiness);\n\n#else\n\n    float perceptualRoughness = material.roughness;\n\n#endif\n\n\n\n    // Clamp the roughness to a minimum value to avoid divisions by 0 during lighting\n\n    perceptualRoughness = clamp(perceptualRoughness, MIN_PERCEPTUAL_ROUGHNESS, 1.0);\n\n\n\n#if defined(GEOMETRIC_SPECULAR_AA)\n\n    perceptualRoughness = normalFiltering(perceptualRoughness, getWorldGeometricNormalVector());\n\n#endif\n\n\n\n#if defined(MATERIAL_HAS_CLEAR_COAT) && defined(MATERIAL_HAS_CLEAR_COAT_ROUGHNESS)\n\n    // This is a hack but it will do: the base layer must be at least as rough\n\n    // as the clear coat layer to take into account possible diffusion by the\n\n    // top layer\n\n    float basePerceptualRoughness = max(perceptualRoughness, pixel.clearCoatPerceptualRoughness);\n\n    perceptualRoughness = mix(perceptualRoughness, basePerceptualRoughness, pixel.clearCoat);\n\n#endif\n\n\n\n    // Remaps the roughness to a perceptually linear roughness (roughness^2)\n\n    pixel.perceptualRoughness = perceptualRoughness;\n\n    pixel.roughness = perceptualRoughnessToRoughness(perceptualRoughness);\n\n}\n\n\n\nvoid getSubsurfacePixelParams(const MaterialInputs material, inout PixelParams pixel) {\n\n#if defined(SHADING_MODEL_SUBSURFACE)\n\n    pixel.subsurfacePower = material.subsurfacePower;\n\n    pixel.subsurfaceColor = material.subsurfaceColor;\n\n    pixel.thickness = saturate(material.thickness);\n\n#endif\n\n}\n\n\n\nvoid getAnisotropyPixelParams(const MaterialInputs material, inout PixelParams pixel) {\n\n#if defined(MATERIAL_HAS_ANISOTROPY)\n\n    vec3 direction = material.anisotropyDirection;\n\n    pixel.anisotropy = material.anisotropy;\n\n    pixel.anisotropicT = normalize(shading_tangentToWorld * direction);\n\n    pixel.anisotropicB = normalize(cross(getWorldGeometricNormalVector(), pixel.anisotropicT));\n\n#endif\n\n}\n\n\n\nvoid getEnergyCompensationPixelParams(inout PixelParams pixel) {\n\n    // Pre-filtered DFG term used for image-based lighting\n\n    pixel.dfg = prefilteredDFG(pixel.perceptualRoughness, shading_NoV);\n\n\n\n#if defined(USE_MULTIPLE_SCATTERING_COMPENSATION) && !defined(SHADING_MODEL_CLOTH)\n\n    // Energy compensation for multiple scattering in a microfacet model\n\n    // See \"Multiple-Scattering Microfacet BSDFs with the Smith Model\"\n\n    pixel.energyCompensation = 1.0 + pixel.f0 * (1.0 / pixel.dfg.y - 1.0);\n\n#else\n\n    pixel.energyCompensation = vec3(1.0);\n\n#endif\n\n}\n\n\n\n\n\nvoid getPixelParams(const MaterialInputs material, out PixelParams pixel) {\n\n    getCommonPixelParams(material, pixel);\n\n    getClearCoatPixelParams(material, pixel);\n\n    getRoughnessPixelParams(material, pixel);\n\n    getSubsurfacePixelParams(material, pixel);\n\n    getAnisotropyPixelParams(material, pixel);\n\n    getEnergyCompensationPixelParams(pixel);\n\n}\n\n\n\n\n\nvec4 evaluateLights(const MaterialInputs material) {\n\n    PixelParams pixel;\n\n    getPixelParams(material, pixel);\n\n\n\n    // Ideally we would keep the diffuse and specular components separate\n\n    // until the very end but it costs more ALUs on mobile. The gains are\n\n    // currently not worth the extra operations\n\n    vec3 color = vec3(0.0);\n\n\n\n    // We always evaluate the IBL as not having one is going to be uncommon,\n\n    // it also saves 1 shader variant\n\n    evaluateIBL(material, pixel, color);\n\n\n\n#if defined(HAS_DIRECTIONAL_LIGHTING)\n\n    evaluateDirectionalLight(material, pixel, color);\n\n#endif\n\n\n\n#if defined(HAS_DYNAMIC_LIGHTING)\n\n    //TODO 目前暂时没有点光源的需求，但未来基于Deferred Rendering绘制大量夜景点光源（路灯）时，才需要\n\n    // evaluatePunctualLights(pixel, color);\n\n#endif\n\n\n\n#if defined(BLEND_MODE_FADE) && !defined(SHADING_MODEL_UNLIT)\n\n    // In fade mode we un-premultiply baseColor early on, so we need to\n\n    // premultiply again at the end (affects diffuse and specular lighting)\n\n    color *= material.baseColor.a;\n\n#endif\n\n\n\n    return vec4(color, computeDiffuseAlpha(material.baseColor.a));\n\n}\n\n\n\nvoid addEmissive(const MaterialInputs material, inout vec4 color) {\n\n#if defined(MATERIAL_HAS_EMISSIVE)\n\n    // The emissive property applies independently of the shading model\n\n    // It is defined as a color + exposure compensation\n\n    highp vec4 emissive = material.emissive;\n\n    highp float attenuation = computePreExposedIntensity(\n\n            pow(2.0, frameUniforms.ev100 + emissive.w - 3.0), frameUniforms.exposure);\n\n    color.rgb += emissive.rgb * attenuation;\n\n#endif\n\n}\n\n\n\n\n\nvec4 evaluateMaterial(const MaterialInputs material) {\n\n    vec4 color = evaluateLights(material);\n\n    addEmissive(material, color);\n\n    return color;\n\n}\n\n";
	var fl_gl_post_process_frag = "float linearToSRGB(float c) {\n\n    return (c <= 0.0031308) ? c * 12.92 : (pow(abs(c), 1.0 / 2.4) * 1.055) - 0.055;\n\n}\n\nvec3 linearToSRGB(vec3 c) {\n\n    return vec3(linearToSRGB(c.r), linearToSRGB(c.g), linearToSRGB(c.b));\n\n}\n\n\n\nvec3 HDR_ACES(const vec3 x) {\n\n    // Narkowicz 2015, \"ACES Filmic Tone Mapping Curve\"\n\n    const float a = 2.51;\n\n    const float b = 0.03;\n\n    const float c = 2.43;\n\n    const float d = 0.59;\n\n    const float e = 0.14;\n\n    return (x * (a * x + b)) / (x * (c * x + d) + e);\n\n}\n\nvec3 tonemap(const vec3 x) {\n\n    return HDR_ACES(x);\n\n}\n\n\n\nvec3 postProcess(vec3 color) {\n\n    vec3 c = color;\n\n    c = linearToSRGB(tonemap(c));\n\n    return c;\n\n}\n\n";
	var fl_main = "#if defined(MATERIAL_HAS_POST_LIGHTING_COLOR)\n\nvoid blendPostLightingColor(const MaterialInputs material, inout vec4 color) {\n\n#if defined(POST_LIGHTING_BLEND_MODE_OPAQUE)\n\n    color = material.postLightingColor;\n\n#elif defined(POST_LIGHTING_BLEND_MODE_TRANSPARENT)\n\n    color = material.postLightingColor + color * (1.0 - material.postLightingColor.a);\n\n#elif defined(POST_LIGHTING_BLEND_MODE_ADD)\n\n    color += material.postLightingColor;\n\n#endif\n\n}\n\n#endif\n\n\n\n#include <fl_gl_post_process_frag>\n\n\n\nvoid main() {\n\n    //uniforms.glsl\n\n    initFrameUniforms();\n\n    // See shading_parameters.frag\n\n    // Computes global variables we need to evaluate material and lighting\n\n    computeShadingParams();\n\n\n\n    // Initialize the inputs to sensible default values, see common_material.fs\n\n    MaterialInputs inputs;\n\n    initMaterial(inputs);\n\n\n\n    // Invoke user code\n\n    getMaterial(inputs);\n\n    //shading_params\n\n    prepareMaterial(inputs);\n\n\n\n    vec4 color = evaluateMaterial(inputs);\n\n\n\n#if defined(HAS_TONE_MAPPING)\n\n    color.rgb = postProcess(color.rgb);\n\n#endif\n\n\n\n    gl_FragColor = color;\n\n    // gl_FragColor = vec4(vec3(inputs.ambientOcclusion), 1.0);\n\n\n\n#if defined(MATERIAL_HAS_POST_LIGHTING_COLOR)\n\n    blendPostLightingColor(inputs, gl_FragColor);\n\n#endif\n\n}\n\n";
	var ShaderChunk = {
	  vsm_shadow_vert: vsm_shadow_vert,
	  vsm_shadow_frag: vsm_shadow_frag,
	  fbo_picking_vert: fbo_picking_vert,
	  fl_common_math_glsl: fl_common_math_glsl,
	  fl_common_graphics_glsl: fl_common_graphics_glsl,
	  fl_uniforms_glsl: fl_uniforms_glsl,
	  fl_material_inputs_vert: fl_material_inputs_vert,
	  fl_inputs_vert: fl_inputs_vert,
	  fl_header_frag: fl_header_frag,
	  fl_inputs_frag: fl_inputs_frag,
	  fl_brdf_frag: fl_brdf_frag,
	  fl_shading_params: fl_shading_params,
	  fl_common_shading_frag: fl_common_shading_frag,
	  fl_getters_frag: fl_getters_frag,
	  fl_material_inputs_frag: fl_material_inputs_frag,
	  fl_common_material_frag: fl_common_material_frag,
	  fl_common_lighting_frag: fl_common_lighting_frag,
	  fl_material_uniforms_frag: fl_material_uniforms_frag,
	  fl_light_uniforms_frag: fl_light_uniforms_frag,
	  fl_ambient_occlusion_frag: fl_ambient_occlusion_frag,
	  fl_light_indirect: fl_light_indirect,
	  fl_shading_model_standard_frag: fl_shading_model_standard_frag,
	  fl_shading_model_cloth_frag: fl_shading_model_cloth_frag,
	  fl_shading_model_subsurface_frag: fl_shading_model_subsurface_frag,
	  fl_light_directional: fl_light_directional,
	  fl_shading_lit: fl_shading_lit,
	  fl_gl_post_process_frag: fl_gl_post_process_frag,
	  fl_main: fl_main,
	  invert_vert: invert_vert,
	  instance_vert: instance_vert,
	  skin_vert: skin_vert
	};
	var ShaderLib = {
	  register: function register(name, source) {
	    if (ShaderChunk[name]) {
	      throw new Error("Key of " + name + " is already registered in ShaderLib.");
	    }

	    ShaderChunk[name] = source;
	  },
	  compile: function compile(source) {
	    return parseIncludes(source);
	  }
	};
	var pattern = /^[ \t]*#include +<([\w\d.]+)>/gm;

	function parseIncludes(string) {
	  return string.replace(pattern, replace);
	}

	function replace(match, include) {
	  var replace = ShaderChunk[include];

	  if (!replace) {
	    throw new Error('Can not resolve #include <' + include + '>');
	  }

	  return parseIncludes(replace);
	}

	var UNIFORM_TYPE = {
	  function: 'function',
	  array: 'array'
	};

	var Shader = function () {
	  function Shader(_ref3) {
	    var vert = _ref3.vert,
	        frag = _ref3.frag,
	        uniforms = _ref3.uniforms,
	        defines = _ref3.defines,
	        extraCommandProps = _ref3.extraCommandProps;
	    this.vert = vert;
	    this.frag = frag;
	    this.shaderDefines = defines || {};
	    uniforms = uniforms || [];
	    this.contextDesc = {};

	    for (var i = 0, l = uniforms.length; i < l; i++) {
	      var p = uniforms[i];

	      if (isString(p)) {
	        if (p.indexOf('[') > 0) {
	          var _parseArrayName = parseArrayName(p),
	              name = _parseArrayName.name,
	              _len2 = _parseArrayName.len;

	          this.contextDesc[name] = {
	            name: name,
	            type: 'array',
	            length: _len2
	          };
	        } else {
	          this.contextDesc[p] = null;
	        }
	      } else if (p.name.indexOf('[') > 0) {
	        var _parseArrayName2 = parseArrayName(p.name),
	            _name2 = _parseArrayName2.name,
	            _len3 = _parseArrayName2.len;

	        this.contextDesc[_name2] = {
	          name: _name2,
	          type: 'array',
	          length: _len3,
	          fn: p.fn
	        };
	      } else {
	        this.contextDesc[p.name] = p;
	      }
	    }

	    this.extraCommandProps = extraCommandProps || {};
	    this.commands = {};

	    this._compileSource();
	  }

	  var _proto13 = Shader.prototype;

	  _proto13.setFramebuffer = function setFramebuffer(framebuffer) {
	    this.context.framebuffer = framebuffer;
	    return this;
	  };

	  _proto13.appendRenderUniforms = function appendRenderUniforms(meshProps) {
	    var context = this.context;
	    var props = extend(meshProps, context);
	    var uniforms = props;
	    var desc = this.contextDesc;

	    for (var p in desc) {
	      if (desc[p] && desc[p].type === 'array') {
	        var name = p,
	            _len4 = desc[p].length;
	        var values = context[p];

	        if (desc[p].fn) {
	          values = desc[p].fn(context, props);
	        }

	        if (values.length !== _len4) {
	          throw new Error(name + " uniform's length is not " + _len4);
	        }

	        uniforms[name] = {};

	        for (var i = 0; i < _len4; i++) {
	          uniforms[name]["" + i] = values[i];
	        }
	      }
	    }

	    return uniforms;
	  };

	  _proto13.setUniforms = function setUniforms(uniforms) {
	    this.context = uniforms;
	    return this;
	  };

	  _proto13.createREGLCommand = function createREGLCommand(regl, materialDefines, attrProps, uniProps, elements, isInstanced) {
	    uniProps = uniProps || [];
	    attrProps = attrProps || [];
	    var defines = extend({}, this.shaderDefines || {}, materialDefines || {});

	    var vert = this._insertDefines(this.vert, defines);

	    var frag = this._insertDefines(this.frag, defines);

	    var attributes = {};
	    attrProps.forEach(function (p) {
	      attributes[p] = regl.prop(p);
	    });
	    var uniforms = {};
	    uniProps.forEach(function (p) {
	      uniforms[p] = regl.prop(p);
	    });
	    var desc = this.contextDesc;

	    for (var p in desc) {
	      if (desc[p] && desc[p].type === UNIFORM_TYPE['function']) {
	        uniforms[p] = desc[p]['fn'];
	      } else if (desc[p] && desc[p].type === UNIFORM_TYPE['array']) {
	        var name = desc[p].name,
	            _len5 = desc[p].length;

	        for (var i = 0; i < _len5; i++) {
	          var key = name + "[" + i + "]";
	          uniforms[key] = regl.prop(key);
	        }
	      } else {
	        uniforms[p] = regl.prop(p);
	      }
	    }

	    var command = {
	      vert: vert,
	      frag: frag,
	      uniforms: uniforms,
	      attributes: attributes
	    };

	    if (elements && !isNumber(elements)) {
	      command.elements = regl.prop('elements');
	    }

	    command.count = regl.prop('count');
	    command.offset = regl.prop('offset');
	    command.primitive = regl.prop('primitive');
	    command.framebuffer = regl.prop('framebuffer');

	    if (isInstanced) {
	      command.instances = regl.prop('instances');
	    }

	    extend(command, this.extraCommandProps);
	    return regl(command);
	  };

	  _proto13.dispose = function dispose() {};

	  _proto13._insertDefines = function _insertDefines(source, defines) {
	    var defineHeaders = [];

	    for (var p in defines) {
	      if (defines.hasOwnProperty(p) && !isFunction(defines[p])) {
	        defineHeaders.push("#define " + p + " " + defines[p] + "\n");
	      }
	    }

	    return defineHeaders.join('') + source;
	  };

	  _proto13._compileSource = function _compileSource() {
	    this.vert = ShaderLib.compile(this.vert);
	    this.frag = ShaderLib.compile(this.frag);
	  };

	  return Shader;
	}();

	function parseArrayName(p) {
	  var l = p.indexOf('['),
	      r = p.indexOf(']');
	  var name = p.substring(0, l),
	      len$$1 = +p.substring(l + 1, r);
	  return {
	    name: name,
	    len: len$$1
	  };
	}

	var MeshShader = function (_Shader) {
	  _inheritsLoose(MeshShader, _Shader);

	  function MeshShader() {
	    return _Shader.apply(this, arguments) || this;
	  }

	  var _proto14 = MeshShader.prototype;

	  _proto14.draw = function draw(regl, meshes) {
	    var props = [];
	    var preCommand;

	    for (var i = 0, l = meshes.length; i < l; i++) {
	      if (!meshes[i].isValid()) {
	        if (i === l - 1 && preCommand && props.length) {
	          preCommand(props);
	        }

	        continue;
	      }

	      if (!meshes[i].geometry.count || !this.filter(meshes[i])) {
	        if (i === l - 1 && preCommand && props.length) {
	          preCommand(props);
	        }

	        continue;
	      }

	      var _command = this.getMeshCommand(regl, meshes[i]);

	      if (props.length && preCommand !== _command) {
	        preCommand(props);
	        props.length = 0;
	      }

	      var meshProps = meshes[i].getREGLProps(regl);
	      this.appendRenderUniforms(meshProps);
	      props.push(meshProps);

	      if (i < l - 1) {
	        preCommand = _command;
	      } else if (i === l - 1) {
	        _command(props);
	      }
	    }

	    return this;
	  };

	  _proto14.filter = function filter() {
	    return true;
	  };

	  _proto14.getMeshCommand = function getMeshCommand(regl, mesh) {
	    var dKey = mesh.getDefinesKey();
	    var defines = mesh.getDefines();
	    var elementType = isNumber(mesh.getElements()) ? 'count' : 'elements';
	    dKey += '_' + elementType;

	    if (mesh instanceof InstancedMesh) {
	      dKey += '_instanced';
	    }

	    var command = this.commands[dKey];

	    if (!command) {
	      var uniforms = Object.keys(mesh.getUniforms(regl));
	      command = this.commands[dKey] = this.createREGLCommand(regl, defines, mesh.getAttributes(), uniforms, mesh.getElements(), mesh instanceof InstancedMesh);
	    }

	    return command;
	  };

	  return MeshShader;
	}(Shader);

	var wireframeFrag = "\n\nprecision mediump float;\n\nvarying vec3 vBarycentric;\n\nuniform float time;\n\nuniform float thickness;\n\nuniform float secondThickness;\n\n\n\nuniform float dashRepeats;\n\nuniform float dashLength;\n\nuniform bool dashOverlap;\n\nuniform bool dashEnabled;\n\nuniform bool dashAnimate;\n\n\n\nuniform bool seeThrough;\n\nuniform bool insideAltColor;\n\nuniform bool dualStroke;\n\n\n\nuniform bool squeeze;\n\nuniform float squeezeMin;\n\nuniform float squeezeMax;\n\n\n\nuniform vec4 stroke;\n\nuniform vec4 fill;\n\nuniform float opacity;\n\n\n\n#ifdef USE_INSTANCE\n\n  varying vec4 vInstanceColor;\n\n#endif\n\n#extension GL_OES_standard_derivatives : enable\n\n\n\nconst float PI = 3.14159265;\n\n\n\n// This is like\n\nfloat aastep (float threshold, float dist) {\n\n  float afwidth = fwidth(dist) * 0.5;\n\n  return smoothstep(threshold - afwidth, threshold + afwidth, dist);\n\n}\n\n\n\n// This function returns the fragment color for our styled wireframe effect\n\n// based on the barycentric coordinates for this fragment\n\nvec4 getStyledWireframe (vec3 barycentric) {\n\n  // this will be our signed distance for the wireframe edge\n\n  float d = min(min(barycentric.x, barycentric.y), barycentric.z);\n\n  // for dashed rendering, we can use this to get the 0 .. 1 value of the line length\n\n  float positionAlong = max(barycentric.x, barycentric.y);\n\n  if (barycentric.y < barycentric.x && barycentric.y < barycentric.z) {\n\n    positionAlong = 1.0 - positionAlong;\n\n  }\n\n\n\n  // the thickness of the stroke\n\n  float computedThickness = thickness;\n\n\n\n  // if we want to shrink the thickness toward the center of the line segment\n\n  if (squeeze) {\n\n    computedThickness *= mix(squeezeMin, squeezeMax, (1.0 - sin(positionAlong * PI)));\n\n  }\n\n\n\n  // if we should create a dash pattern\n\n  if (dashEnabled) {\n\n    // here we offset the stroke position depending on whether it\n\n    // should overlap or not\n\n    float offset = 1.0 / dashRepeats * dashLength / 2.0;\n\n    if (!dashOverlap) {\n\n      offset += 1.0 / dashRepeats / 2.0;\n\n    }\n\n\n\n    // if we should animate the dash or not\n\n    if (dashAnimate) {\n\n      offset += time * 0.22;\n\n    }\n\n\n\n    // create the repeating dash pattern\n\n    float pattern = fract((positionAlong + offset) * dashRepeats);\n\n    computedThickness *= 1.0 - aastep(dashLength, pattern);\n\n  }\n\n\n\n  // compute the anti-aliased stroke edge  \n\n  float edge = 1.0 - aastep(computedThickness, d);\n\n\n\n  // now compute the final color of the mesh\n\n  #ifdef USE_INSTANCE\n\n    vec4 strokeColor = vInstanceColor;\n\n  #else\n\n    vec4 strokeColor = stroke;\n\n  #endif\n\n  vec4 outColor = vec4(0.0);\n\n  if (seeThrough) {\n\n    outColor = vec4(strokeColor.xyz, edge);\n\n    if (insideAltColor && !gl_FrontFacing) {\n\n       outColor.rgb = fill.xyz;\n\n    }\n\n  } else {\n\n    vec3 mainStroke = mix(fill.xyz, strokeColor.xyz, edge);\n\n    outColor.a = fill.a;\n\n    if (dualStroke) {\n\n      float inner = 1.0 - aastep(secondThickness, d);\n\n      vec3 wireColor = mix(fill.xyz, stroke.xyz, abs(inner - edge));\n\n      outColor.rgb = wireColor;\n\n    } else {\n\n      outColor.rgb = mainStroke;\n\n    }\n\n  }\n\n\n\n  return outColor;\n\n}\n\n\n\nvoid main () {\n\n  gl_FragColor = getStyledWireframe(vBarycentric) * opacity;\n\n}";
	var wireframeVert = "attribute vec3 aPosition;\n\nattribute vec3 aBarycentric;\n\nvarying vec3 vBarycentric;\n\n\n\nuniform mat4 modelMatrix;\n\nuniform mat4 projViewMatrix;\n\nuniform mat4 projViewModelMatrix;\n\n\n\n#ifdef USE_INSTANCE\n\n    #include <instance_vert>\n\n    varying vec4 vInstanceColor;\n\n#endif\n\n\n\n#ifdef USE_SKIN\n\n    #include <skin_vert>\n\n#endif\n\nvoid main () {\n\n  #ifdef USE_INSTANCE\n\n      mat4 attributeMatrix = instance_getAttributeMatrix();\n\n          #ifdef USE_SKIN\n\n              mat4 worldMatrix = attributeMatrix * skin_getSkinMatrix();\n\n              mat4 pvmMatrix = projViewMatrix * worldMatrix;\n\n          #else\n\n              mat4 pvmMatrix = projViewMatrix * attributeMatrix;\n\n          #endif\n\n      gl_Position = = pvmMatrix * vec4(aPosition, 1.0);\n\n      vInstanceColor = instance_getInstanceColor();\n\n  #else\n\n      #ifdef USE_SKIN\n\n          mat4 worldMatrix = modelMatrix * skin_getSkinMatrix();\n\n          mat4 pvmMatrix = projViewMatrix * worldMatrix;\n\n          gl_Position = pvmMatrix * vec4(aPosition, 1.0);\n\n      #else\n\n          gl_Position = projViewModelMatrix * vec4(aPosition, 1.0);\n\n      #endif\n\n  #endif\n\n  vBarycentric = aBarycentric;\n\n}";

	var WireframeShader = function (_MeshShader) {
	  _inheritsLoose(WireframeShader, _MeshShader);

	  function WireframeShader(config) {
	    if (config === void 0) {
	      config = {};
	    }

	    var extraCommandProps = config.extraCommandProps || {};
	    var positionAttribute = config.positionAttribute || 'aPosition',
	        barycentricAttribute = config.barycentricAttribute || 'aBarycentric';
	    extraCommandProps = extend({}, extraCommandProps, {
	      blend: {
	        enable: true,
	        func: {
	          src: 'src alpha',
	          dst: 'one minus src alpha'
	        },
	        equation: 'add'
	      },
	      sample: {
	        alpha: true
	      }
	    });
	    var vert = wireframeVert;

	    if (positionAttribute !== 'aPosition') {
	      vert = vert.replace(/aPosition/g, positionAttribute);
	    }

	    if (barycentricAttribute !== 'aBarycentric') {
	      vert = vert.replace(/aBarycentric/g, barycentricAttribute);
	    }

	    return _MeshShader.call(this, {
	      vert: vert,
	      frag: wireframeFrag,
	      uniforms: ['time', 'fill', 'stroke', 'dualStroke', 'seeThrough', 'insideAltColor', 'thickness', 'secondThickness', 'dashEnabled', 'dashRepeats', 'dashOverlap', 'dashLength', 'dashAnimate', 'squeeze', 'squeezeMin', 'squeezeMax', 'opacity', 'projViewMatrix', {
	        name: 'projViewModelMatrix',
	        type: 'function',
	        fn: function fn(context, props) {
	          return multiply$3([], props['projViewMatrix'], props['modelMatrix']);
	        }
	      }],
	      extraCommandProps: extraCommandProps
	    }) || this;
	  }

	  return WireframeShader;
	}(MeshShader);

	var phongFrag = "\n\nprecision mediump float;\n\nvarying vec2 vTexCoords;\n\nuniform float materialShininess;//反光度，即影响镜面高光的散射/半径\n\nuniform float opacity;\n\nuniform float ambientStrength;\n\nuniform float specularStrength;\n\n\n\n\n\nuniform vec3 lightPosition;\n\nuniform vec4 lightAmbient;\n\nuniform vec4 lightDiffuse;\n\nuniform vec4 lightSpecular;\n\n\n\nvarying vec3 vNormal;\n\nvarying vec4 vFragPos;\n\nuniform vec3 viewPos;\n\n\n\n#ifdef USE_INSTANCE\n\n    varying vec4 vInstanceColor;\n\n#endif\n\n\n\n#ifdef USE_BASECOLORTEXTURE\n\n    uniform sampler2D baseColorTexture;\n\n#endif\n\nuniform vec4 baseColorFactor;\n\n\n\nvoid main() {\n\n    //环境光\n\n    #ifdef USE_BASECOLORTEXTURE\n\n        #ifdef USE_INSTANCE\n\n            vec3 ambientColor = ambientStrength * vInstanceColor.xyz * texture2D(baseColorTexture, vTexCoords).rgb;\n\n        #else\n\n            vec3 ambientColor = ambientStrength * lightAmbient.xyz * texture2D(baseColorTexture, vTexCoords).rgb;\n\n        #endif\n\n    #else\n\n        #ifdef USE_INSTANCE\n\n            vec3 ambientColor = ambientStrength * vInstanceColor.xyz ;\n\n        #else\n\n            vec3 ambientColor = ambientStrength * lightAmbient.xyz;\n\n        #endif\n\n    #endif\n\n    vec3 ambient = ambientColor * baseColorFactor.xyz;\n\n\n\n    //漫反射光\n\n    vec3 norm = normalize(vNormal);\n\n    vec3 lightDir = vec3(normalize(lightPosition -vec3(vFragPos)));\n\n    float diff = max(dot(norm, lightDir), 0.0);\n\n    #ifdef USE_BASECOLORTEXTURE\n\n        vec3 diffuse = lightDiffuse.xyz * diff * texture2D(baseColorTexture, vTexCoords).rgb;\n\n    #else\n\n        vec3 diffuse = lightDiffuse.xyz * diff;\n\n    #endif\n\n\n\n    //镜面反色光\n\n    vec3 viewDir = vec3(normalize(viewPos -vec3(vFragPos)));\n\n    // vec3 reflectDir = reflect(-lightDir, norm);\n\n    vec3 halfwayDir = normalize(lightDir + viewDir);\n\n    float spec = pow(max(dot(norm, halfwayDir), 0.0), materialShininess);\n\n    vec3 specular = specularStrength * lightSpecular.xyz * spec;\n\n\n\n\n\n    vec3 result = ambient +diffuse +specular;\n\n    gl_FragColor = vec4(result, 1.0) * opacity;\n\n}\n\n";
	var phongVert = "attribute vec3 aPosition;\n\n#ifdef USE_BASECOLORTEXTURE\n\n    attribute vec2 TEXCOORD_0;\n\n    varying vec2 vTexCoords;\n\n#endif\n\nattribute vec3 NORMAL;\n\n\n\nvarying vec4 vFragPos;\n\nvarying vec3 vNormal;\n\nuniform mat4 projViewModelMatrix;\n\nuniform mat4 projViewMatrix;\n\nuniform mat4 normalMatrix;\n\nuniform mat4 modelMatrix;\n\n\n\n#ifdef USE_INSTANCE\n\n    #include <invert_vert>\n\n    #include <instance_vert>\n\n    varying vec4 vInstanceColor;\n\n#endif\n\n\n\n#ifdef USE_SKIN\n\n    #include <invert_vert>\n\n    #include <skin_vert>\n\n#endif\n\nvoid main()\n\n{\n\n    #ifdef USE_INSTANCE\n\n        mat4 attributeMatrix = instance_getAttributeMatrix();\n\n        vFragPos = attributeMatrix * vec4(aPosition, 1.0);\n\n        mat4 inverseMat = invert(attributeMatrix);\n\n        mat4 normalMat = transpose(inverseMat);\n\n        vNormal = normalize(vec3(normalMat * vec4(NORMAL, 1.0)));\n\n        #ifdef USE_SKIN\n\n            mat4 worldMatrix = attributeMatrix * skin_getSkinMatrix();\n\n            mat4 pvmMatrix = projViewMatrix * worldMatrix;\n\n        #else\n\n            mat4 pvmMatrix = projViewMatrix * attributeMatrix;\n\n        #endif\n\n        gl_Position = = pvmMatrix * vec4(aPosition, 1.0);\n\n        vInstanceColor = instance_getInstanceColor();\n\n    #else\n\n        #ifdef USE_SKIN\n\n            mat4 worldMatrix =  modelMatrix * skin_getSkinMatrix();\n\n            vFragPos = worldMatrix * vec4(aPosition, 1.0);\n\n            gl_Position = projViewMatrix * worldMatrix * vec4(aPosition, 1.0);\n\n            mat4 inverseMat = invert(worldMatrix);\n\n            mat4 normalMat = transpose(worldMatrix);\n\n            vNormal = normalize(vec3(normalMat * vec4(NORMAL, 1.0)));\n\n        #else\n\n            vFragPos = modelMatrix * vec4(aPosition, 1.0);\n\n            gl_Position = projViewModelMatrix * vec4(aPosition, 1.0);\n\n            vNormal = normalize(vec3(normalMatrix * vec4(NORMAL, 1.0)));\n\n        #endif\n\n    #endif\n\n    #ifdef USE_BASECOLORTEXTURE\n\n        vTexCoords = TEXCOORD_0;\n\n    #endif\n\n}\n\n";

	var PhongShader = function (_MeshShader2) {
	  _inheritsLoose(PhongShader, _MeshShader2);

	  function PhongShader(config) {
	    if (config === void 0) {
	      config = {};
	    }

	    var extraCommandProps = config.extraCommandProps || {};
	    var positionAttribute = config.positionAttribute || 'aPosition';
	    var vert = phongVert;

	    if (positionAttribute !== 'aPosition') {
	      vert = vert.replace(/aPosition/g, positionAttribute);
	    }

	    return _MeshShader2.call(this, {
	      vert: vert,
	      frag: phongFrag,
	      uniforms: ['viewPos', 'lightAmbient', 'lightDiffuse', 'lightSpecular', 'ambientStrength', 'specularStrength', 'materialShininess', 'projViewMatrix', 'opacity', 'baseColorTexture', 'baseColorFactor', 'lightPosition', {
	        name: 'normalMatrix',
	        type: 'function',
	        fn: function fn(context, props) {
	          var normalMatrix = [];
	          invert$3(normalMatrix, props['modelMatrix']);
	          transpose$2(normalMatrix, normalMatrix);
	          return normalMatrix;
	        }
	      }, {
	        name: 'projViewModelMatrix',
	        type: 'function',
	        fn: function fn(context, props) {
	          return multiply$3([], props['projViewMatrix'], props['modelMatrix']);
	        }
	      }],
	      defines: {},
	      extraCommandProps: extraCommandProps
	    }) || this;
	  }

	  return PhongShader;
	}(MeshShader);

	var skyboxData = {
	  vertices: [-1.0, 1.0, -1.0, -1.0, -1.0, -1.0, 1.0, -1.0, -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, -1.0, -1.0, 1.0, -1.0, -1.0, -1.0, 1.0, -1.0, -1.0, -1.0, -1.0, 1.0, -1.0, -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, -1.0, -1.0, 1.0, 1.0, -1.0, -1.0, 1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, 1.0, -1.0, -1.0, -1.0, -1.0, 1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, 1.0, -1.0, -1.0, 1.0, -1.0, 1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, 1.0, 1.0, -1.0, 1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, 1.0, 1.0, -1.0, -1.0, 1.0, -1.0, -1.0, -1.0, -1.0, 1.0, 1.0, -1.0, 1.0]
	};
	var skyboxVS = "    attribute vec3 aPosition;\n\n\n\n    uniform mat4 projMatrix;\n\n    uniform mat4 viewMatrix;\n\n\n\n    varying vec3 vWorldPos;\n\n\n\n    void main()\n\n    {\n\n        vWorldPos = aPosition;\n\n\n\n        mat4 rotViewMatrix = mat4(mat3(viewMatrix)); // remove translation from the view matrix\n\n        vec4 clipPos = projMatrix * rotViewMatrix * vec4(vWorldPos, 1.0);\n\n\n\n        gl_Position = clipPos.xyww;\n\n    }\n\n";
	var skyboxFrag = "precision mediump float;\n\n\n\nvarying vec3 vWorldPos;\n\n\n\nuniform samplerCube cubeMap;\n\n\n\nvoid main()\n\n{\n\n    vec3 envColor = textureCube(cubeMap, vWorldPos).rgb;\n\n\n\n    #ifdef USE_HDR\n\n    envColor = envColor / (envColor + vec3(1.0));\n\n    envColor = pow(envColor, vec3(1.0/2.2));\n\n    #endif\n\n\n\n    gl_FragColor = vec4(envColor, 1.0);\n\n}\n\n";
	var command, commandHDR;
	var config;

	function drawSkybox(regl, cubeMap, viewMatrix, projMatrix, useHDR, frameBuffer) {
	  var drawCommand;
	  config = config || {
	    vert: skyboxVS,
	    attributes: {
	      'aPosition': skyboxData.vertices
	    },
	    uniforms: {
	      'cubeMap': regl.prop('cubeMap'),
	      'viewMatrix': regl.prop('viewMatrix'),
	      'projMatrix': regl.prop('projMatrix')
	    },
	    count: skyboxData.vertices.length / 3,
	    framebuffer: regl.prop('frameBuffer'),
	    depth: {
	      enable: true,
	      func: 'lequal'
	    }
	  };

	  if (useHDR) {
	    config['frag'] = '#define USE_HDR \n' + skyboxFrag;
	    drawCommand = commandHDR = commandHDR || regl(config);
	  } else {
	    config['frag'] = skyboxFrag;
	    drawCommand = command = command || regl(config);
	  }

	  drawCommand({
	    cubeMap: cubeMap,
	    viewMatrix: viewMatrix,
	    projMatrix: projMatrix,
	    frameBuffer: frameBuffer
	  });
	}

	var SkyboxHelper = Object.freeze({
	  drawSkybox: drawSkybox
	});

	var renderToCube = function () {
	  var cameraPos = [0, 0, 0];
	  var captureViews = [lookAt([], cameraPos, [1, 0, 0], [0, -1, 0]), lookAt([], cameraPos, [-1, 0, 0], [0, -1, 0]), lookAt([], cameraPos, [0, 1, 0], [0, 0, 1]), lookAt([], cameraPos, [0, -1, 0], [0, 0, -1]), lookAt([], cameraPos, [0, 0, 1], [0, -1, 0]), lookAt([], cameraPos, [0, 0, -1], [0, -1, 0])];
	  var fov = 90 * Math.PI / 180;
	  var clearColor = [0, 0, 0, 0];
	  var pmat = new Array(16);
	  return function (regl, fbo, drawCommand, props, cb) {
	    var aspect = 1;
	    var near = 0.5;
	    var far = 1.1;
	    var projMatrix = perspective(pmat, fov, aspect, near, far);
	    var config = {
	      context: {
	        viewMatrix: function viewMatrix(context, props, batchId) {
	          return captureViews[batchId];
	        },
	        projMatrix: projMatrix
	      }
	    };

	    if (fbo) {
	      if (fbo.faces) {
	        config.framebuffer = function (context, props, batchId) {
	          return fbo.faces[batchId];
	        };
	      } else {
	        config.framebuffer = fbo;
	      }
	    }

	    var setupFace = regl(config);
	    setupFace(6, function () {
	      regl.clear({
	        color: clearColor,
	        depth: 1
	      });
	      drawCommand(props);
	      if (cb) cb();
	    });
	    return fbo;
	  };
	}();

	var cubeData = {
	  vertices: [1.0, 1.0, 1.0, -1.0, 1.0, 1.0, -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, 1.0, 1.0, -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0, -1.0, 1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, 1.0, -1.0, -1.0, -1.0, 1.0, -1.0, -1.0, 1.0, -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, 1.0, -1.0, 1.0, 1.0, -1.0],
	  textures: [1.0, 1.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0],
	  indices: [0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11, 12, 13, 14, 12, 14, 15, 16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23]
	};
	var cubemapVS = "attribute vec3 aPosition;\n\n\n\nvarying vec3 vWorldPos;\n\n\n\nuniform mat4 projMatrix;\n\nuniform mat4 viewMatrix;\n\n\n\nvoid main()\n\n{\n\n    vWorldPos = aPosition;\n\n    gl_Position =  projMatrix * viewMatrix * vec4(vWorldPos, 1.0);\n\n}\n\n";
	var equirectangularMapFS = "//平面图转成cubemap\n\nprecision mediump float;\n\n\n\nvarying vec3 vWorldPos;\n\n\n\nuniform sampler2D equirectangularMap;\n\n\n\nconst vec2 invAtan = vec2(0.1591, 0.3183);\n\nvec2 SampleSphericalMap(vec3 v)\n\n{\n\n    vec2 uv = vec2(atan(v.y, v.x), asin(v.z));\n\n    uv *= invAtan;\n\n    uv += 0.5;\n\n    return uv;\n\n}\n\n\n\nvoid main()\n\n{\n\n    vec2 uv = SampleSphericalMap(normalize(vWorldPos)); // make sure to normalize localPos\n\n    vec3 color = texture2D(equirectangularMap, uv).rgb;\n\n\n\n    gl_FragColor = vec4(color, 1.0);\n\n    // gl_FragColor = vec4(uv, 0.0, 1.0);\n\n}\n\n\n\n";
	var prefilterFS = "precision mediump float;\n\n\n\nvarying vec3 vWorldPos;\n\n\n\nuniform samplerCube environmentMap;\n\nuniform sampler2D distributionMap;\n\nuniform float roughness;\n\nuniform float resolution; // resolution of source cubemap (per face)\n\n\n\nconst float PI = 3.14159265359;\n\n\n\n// ----------------------------------------------------------------------------\n\nfloat DistributionGGX(vec3 N, vec3 H, float roughness)\n\n{\n\n    float a = roughness*roughness;\n\n    float a2 = a*a;\n\n    float NdotH = max(dot(N, H), 0.0);\n\n    float NdotH2 = NdotH*NdotH;\n\n\n\n    float nom   = a2;\n\n    float denom = (NdotH2 * (a2 - 1.0) + 1.0);\n\n    denom = PI * denom * denom;\n\n\n\n    return nom / denom;\n\n}\n\n\n\n// ----------------------------------------------------------------------------\n\nvec3 ImportanceSampleGGX(float Xi, vec3 N, float roughness)\n\n{\n\n    vec3 H = texture2D(distributionMap, vec2(roughness, Xi)).rgb;\n\n\n\n    // from tangent-space H vector to world-space sample vector\n\n    vec3 up          = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);\n\n    vec3 tangent   = normalize(cross(up, N));\n\n    vec3 bitangent = cross(N, tangent);\n\n\n\n    vec3 sampleVec = tangent * H.x + bitangent * H.y + N * H.z;\n\n    return normalize(sampleVec);\n\n}\n\n// ----------------------------------------------------------------------------\n\nvoid main()\n\n{\n\n    vec3 N = normalize(vWorldPos);\n\n\n\n    // make the simplyfying assumption that V equals R equals the normal\n\n    vec3 R = N;\n\n    vec3 V = R;\n\n\n\n    const int SAMPLE_COUNT = 1024;\n\n    vec3 prefilteredColor = vec3(0.0);\n\n    float totalWeight = 0.0;\n\n\n\n    for(int i = 0; i < SAMPLE_COUNT; ++i)\n\n    {\n\n        // generates a sample vector that's biased towards the preferred alignment direction (importance sampling).\n\n        vec3 H = ImportanceSampleGGX(float(i) / float(SAMPLE_COUNT), N, roughness);\n\n        vec3 L  = normalize(2.0 * dot(V, H) * H - V);\n\n\n\n        float NdotL = max(dot(N, L), 0.0);\n\n        if(NdotL > 0.0)\n\n        {\n\n            // a more precision method,  sample from the environment's mip level based on roughness/pdf\n\n            float D   = DistributionGGX(N, H, roughness);\n\n            float NdotH = max(dot(N, H), 0.0);\n\n            float HdotV = max(dot(H, V), 0.0);\n\n            float pdf = D * NdotH / (4.0 * HdotV) + 0.0001;\n\n\n\n            float saTexel  = 4.0 * PI / (6.0 * resolution * resolution);\n\n            float saSample = 1.0 / (float(SAMPLE_COUNT) * pdf + 0.0001);\n\n\n\n            float mipLevel = roughness == 0.0 ? 0.0 : 0.5 * log2(saSample / saTexel);\n\n\n\n            prefilteredColor += textureCube(environmentMap, L, mipLevel).rgb * NdotL;\n\n            totalWeight      += NdotL;\n\n            //--------------------------------------------------------\n\n            // prefilteredColor += textureCube(environmentMap, L).rgb * NdotL;\n\n            // totalWeight      += NdotL;\n\n        }\n\n    }\n\n\n\n    prefilteredColor = prefilteredColor / totalWeight;\n\n\n\n    gl_FragColor = vec4(prefilteredColor, 1.0);\n\n    // gl_FragColor = vec4(totalWeight, 0.0, 0.0, 1.0);\n\n    // gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);\n\n}\n\n";
	var dfgFS = "//生成 BRDF LUT\n\nprecision mediump float;\n\n\n\nvarying vec2 vTexCoords;\n\nuniform sampler2D distributionMap;\n\n\n\nconst float PI = 3.14159265359;\n\n\n\nvec3 ImportanceSampleGGX(float Xi, vec3 N, float roughness)\n\n{\n\n    vec3 H = texture2D(distributionMap, vec2(roughness, Xi)).rgb;\n\n    \n\n    // from tangent-space H vector to world-space sample vector\n\n    vec3 up          = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);\n\n    vec3 tangent   = normalize(cross(up, N));\n\n    vec3 bitangent = cross(N, tangent);\n\n    \n\n    vec3 sampleVec = tangent * H.x + bitangent * H.y + N * H.z;\n\n    return normalize(sampleVec);\n\n}\n\n// ----------------------------------------------------------------------------\n\nfloat GeometrySchlickGGX(float NdotV, float roughness)\n\n{\n\n    // note that we use a different k for IBL\n\n    float a = roughness;\n\n    float k = (a * a) / 2.0;\n\n\n\n    float nom   = NdotV;\n\n    float denom = NdotV * (1.0 - k) + k;\n\n\n\n    return nom / denom;\n\n}\n\n// ----------------------------------------------------------------------------\n\nfloat GeometrySmith(vec3 N, vec3 V, vec3 L, float roughness)\n\n{\n\n    float NdotV = max(dot(N, V), 0.0);\n\n    float NdotL = max(dot(N, L), 0.0);\n\n    float ggx2 = GeometrySchlickGGX(NdotV, roughness);\n\n    float ggx1 = GeometrySchlickGGX(NdotL, roughness);\n\n\n\n    return ggx1 * ggx2;\n\n}\n\n// ----------------------------------------------------------------------------\n\nvec2 IntegrateBRDF(float NdotV, float roughness)\n\n{\n\n    vec3 V;\n\n    V.x = sqrt(1.0 - NdotV*NdotV);\n\n    V.y = 0.0;\n\n    V.z = NdotV;\n\n\n\n    float A = 0.0;\n\n    float B = 0.0; \n\n\n\n    vec3 N = vec3(0.0, 0.0, 1.0);\n\n    \n\n    const int SAMPLE_COUNT = 1024;\n\n    for(int i = 0; i < SAMPLE_COUNT; ++i)\n\n    {\n\n        // generates a sample vector that's biased towards the\n\n        // preferred alignment direction (importance sampling).\n\n        vec3 H = ImportanceSampleGGX(float(i) / float(SAMPLE_COUNT), N, roughness);\n\n        vec3 L  = normalize(2.0 * dot(V, H) * H - V);\n\n\n\n        float NdotL = max(L.z, 0.0);\n\n        float NdotH = max(H.z, 0.0);\n\n        float VdotH = max(dot(V, H), 0.0);\n\n\n\n        if(NdotL > 0.0)\n\n        {\n\n            float G = GeometrySmith(N, V, L, roughness);\n\n            float G_Vis = (G * VdotH) / (NdotH * NdotV);\n\n            float Fc = pow(1.0 - VdotH, 5.0);\n\n\n\n            A += (1.0 - Fc) * G_Vis;\n\n            B += Fc * G_Vis;\n\n        }\n\n    }\n\n    A /= float(SAMPLE_COUNT);\n\n    B /= float(SAMPLE_COUNT);\n\n    return vec2(A, B);\n\n}\n\n// ----------------------------------------------------------------------------\n\nvoid main() \n\n{\n\n    vec2 integratedBRDF = IntegrateBRDF(vTexCoords.x, vTexCoords.y);\n\n    gl_FragColor = vec4(integratedBRDF, 0.0, 1.0);\n\n    // gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);\n\n}\n\n";
	var dfgVS = "attribute vec3 aPosition;\n\nattribute vec2 aTexCoord;\n\n\n\nvarying vec2 vTexCoords;\n\n\n\nvoid main()\n\n{\n\n    vTexCoords = aTexCoord;\n\n    gl_Position = vec4(aPosition, 1.0);\n\n}\n\n";
	var epsilon = 0.000001;
	var create_1 = create$9;

	function create$9() {
	  var out = new Float32Array(3);
	  out[0] = 0;
	  out[1] = 0;
	  out[2] = 0;
	  return out;
	}

	var clone_1 = clone$9;

	function clone$9(a) {
	  var out = new Float32Array(3);
	  out[0] = a[0];
	  out[1] = a[1];
	  out[2] = a[2];
	  return out;
	}

	var fromValues_1 = fromValues$9;

	function fromValues$9(x, y, z) {
	  var out = new Float32Array(3);
	  out[0] = x;
	  out[1] = y;
	  out[2] = z;
	  return out;
	}

	var normalize_1 = normalize$1$1;

	function normalize$1$1(out, a) {
	  var x = a[0],
	      y = a[1],
	      z = a[2];
	  var len$$1 = x * x + y * y + z * z;

	  if (len$$1 > 0) {
	    len$$1 = 1 / Math.sqrt(len$$1);
	    out[0] = a[0] * len$$1;
	    out[1] = a[1] * len$$1;
	    out[2] = a[2] * len$$1;
	  }

	  return out;
	}

	var dot_1 = dot$5;

	function dot$5(a, b) {
	  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
	}

	var angle_1 = angle$2;

	function angle$2(a, b) {
	  var tempA = fromValues_1(a[0], a[1], a[2]);
	  var tempB = fromValues_1(b[0], b[1], b[2]);
	  normalize_1(tempA, tempA);
	  normalize_1(tempB, tempB);
	  var cosine = dot_1(tempA, tempB);

	  if (cosine > 1.0) {
	    return 0;
	  } else {
	    return Math.acos(cosine);
	  }
	}

	var copy_1 = copy$9;

	function copy$9(out, a) {
	  out[0] = a[0];
	  out[1] = a[1];
	  out[2] = a[2];
	  return out;
	}

	var set_1 = set$a;

	function set$a(out, x, y, z) {
	  out[0] = x;
	  out[1] = y;
	  out[2] = z;
	  return out;
	}

	var equals_1 = equals$a;

	function equals$a(a, b) {
	  var a0 = a[0];
	  var a1 = a[1];
	  var a2 = a[2];
	  var b0 = b[0];
	  var b1 = b[1];
	  var b2 = b[2];
	  return Math.abs(a0 - b0) <= epsilon * Math.max(1.0, Math.abs(a0), Math.abs(b0)) && Math.abs(a1 - b1) <= epsilon * Math.max(1.0, Math.abs(a1), Math.abs(b1)) && Math.abs(a2 - b2) <= epsilon * Math.max(1.0, Math.abs(a2), Math.abs(b2));
	}

	var exactEquals_1 = exactEquals$9;

	function exactEquals$9(a, b) {
	  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
	}

	var add_1 = add$9;

	function add$9(out, a, b) {
	  out[0] = a[0] + b[0];
	  out[1] = a[1] + b[1];
	  out[2] = a[2] + b[2];
	  return out;
	}

	var subtract_1 = subtract$7;

	function subtract$7(out, a, b) {
	  out[0] = a[0] - b[0];
	  out[1] = a[1] - b[1];
	  out[2] = a[2] - b[2];
	  return out;
	}

	var sub$7 = subtract_1;
	var multiply_1 = multiply$9;

	function multiply$9(out, a, b) {
	  out[0] = a[0] * b[0];
	  out[1] = a[1] * b[1];
	  out[2] = a[2] * b[2];
	  return out;
	}

	var mul$9 = multiply_1;
	var divide_1 = divide$3;

	function divide$3(out, a, b) {
	  out[0] = a[0] / b[0];
	  out[1] = a[1] / b[1];
	  out[2] = a[2] / b[2];
	  return out;
	}

	var div$3 = divide_1;
	var min_1 = min$3;

	function min$3(out, a, b) {
	  out[0] = Math.min(a[0], b[0]);
	  out[1] = Math.min(a[1], b[1]);
	  out[2] = Math.min(a[2], b[2]);
	  return out;
	}

	var max_1 = max$3;

	function max$3(out, a, b) {
	  out[0] = Math.max(a[0], b[0]);
	  out[1] = Math.max(a[1], b[1]);
	  out[2] = Math.max(a[2], b[2]);
	  return out;
	}

	var floor_1 = floor$3;

	function floor$3(out, a) {
	  out[0] = Math.floor(a[0]);
	  out[1] = Math.floor(a[1]);
	  out[2] = Math.floor(a[2]);
	  return out;
	}

	var ceil_1 = ceil$3;

	function ceil$3(out, a) {
	  out[0] = Math.ceil(a[0]);
	  out[1] = Math.ceil(a[1]);
	  out[2] = Math.ceil(a[2]);
	  return out;
	}

	var round_1 = round$3;

	function round$3(out, a) {
	  out[0] = Math.round(a[0]);
	  out[1] = Math.round(a[1]);
	  out[2] = Math.round(a[2]);
	  return out;
	}

	var scale_1 = scale$9;

	function scale$9(out, a, b) {
	  out[0] = a[0] * b;
	  out[1] = a[1] * b;
	  out[2] = a[2] * b;
	  return out;
	}

	var scaleAndAdd_1 = scaleAndAdd$3;

	function scaleAndAdd$3(out, a, b, scale$$1) {
	  out[0] = a[0] + b[0] * scale$$1;
	  out[1] = a[1] + b[1] * scale$$1;
	  out[2] = a[2] + b[2] * scale$$1;
	  return out;
	}

	var distance_1 = distance$3;

	function distance$3(a, b) {
	  var x = b[0] - a[0],
	      y = b[1] - a[1],
	      z = b[2] - a[2];
	  return Math.sqrt(x * x + y * y + z * z);
	}

	var dist$3 = distance_1;
	var squaredDistance_1 = squaredDistance$3;

	function squaredDistance$3(a, b) {
	  var x = b[0] - a[0],
	      y = b[1] - a[1],
	      z = b[2] - a[2];
	  return x * x + y * y + z * z;
	}

	var sqrDist$3 = squaredDistance_1;
	var length_1 = length$5;

	function length$5(a) {
	  var x = a[0],
	      y = a[1],
	      z = a[2];
	  return Math.sqrt(x * x + y * y + z * z);
	}

	var len$5 = length_1;
	var squaredLength_1 = squaredLength$5;

	function squaredLength$5(a) {
	  var x = a[0],
	      y = a[1],
	      z = a[2];
	  return x * x + y * y + z * z;
	}

	var sqrLen$5 = squaredLength_1;
	var negate_1 = negate$3;

	function negate$3(out, a) {
	  out[0] = -a[0];
	  out[1] = -a[1];
	  out[2] = -a[2];
	  return out;
	}

	var inverse_1 = inverse$3;

	function inverse$3(out, a) {
	  out[0] = 1.0 / a[0];
	  out[1] = 1.0 / a[1];
	  out[2] = 1.0 / a[2];
	  return out;
	}

	var cross_1 = cross$2;

	function cross$2(out, a, b) {
	  var ax = a[0],
	      ay = a[1],
	      az = a[2],
	      bx = b[0],
	      by = b[1],
	      bz = b[2];
	  out[0] = ay * bz - az * by;
	  out[1] = az * bx - ax * bz;
	  out[2] = ax * by - ay * bx;
	  return out;
	}

	var lerp_1 = lerp$5;

	function lerp$5(out, a, b, t) {
	  var ax = a[0],
	      ay = a[1],
	      az = a[2];
	  out[0] = ax + t * (b[0] - ax);
	  out[1] = ay + t * (b[1] - ay);
	  out[2] = az + t * (b[2] - az);
	  return out;
	}

	var random_1 = random$4;

	function random$4(out, scale$$1) {
	  scale$$1 = scale$$1 || 1.0;
	  var r = Math.random() * 2.0 * Math.PI;
	  var z = Math.random() * 2.0 - 1.0;
	  var zScale = Math.sqrt(1.0 - z * z) * scale$$1;
	  out[0] = Math.cos(r) * zScale;
	  out[1] = Math.sin(r) * zScale;
	  out[2] = z * scale$$1;
	  return out;
	}

	var transformMat4_1 = transformMat4$3;

	function transformMat4$3(out, a, m) {
	  var x = a[0],
	      y = a[1],
	      z = a[2],
	      w = m[3] * x + m[7] * y + m[11] * z + m[15];
	  w = w || 1.0;
	  out[0] = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
	  out[1] = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
	  out[2] = (m[2] * x + m[6] * y + m[10] * z + m[14]) / w;
	  return out;
	}

	var transformMat3_1 = transformMat3$2;

	function transformMat3$2(out, a, m) {
	  var x = a[0],
	      y = a[1],
	      z = a[2];
	  out[0] = x * m[0] + y * m[3] + z * m[6];
	  out[1] = x * m[1] + y * m[4] + z * m[7];
	  out[2] = x * m[2] + y * m[5] + z * m[8];
	  return out;
	}

	var transformQuat_1 = transformQuat$2;

	function transformQuat$2(out, a, q) {
	  var x = a[0],
	      y = a[1],
	      z = a[2],
	      qx = q[0],
	      qy = q[1],
	      qz = q[2],
	      qw = q[3],
	      ix = qw * x + qy * z - qz * y,
	      iy = qw * y + qz * x - qx * z,
	      iz = qw * z + qx * y - qy * x,
	      iw = -qx * x - qy * y - qz * z;
	  out[0] = ix * qw + iw * -qx + iy * -qz - iz * -qy;
	  out[1] = iy * qw + iw * -qy + iz * -qx - ix * -qz;
	  out[2] = iz * qw + iw * -qz + ix * -qy - iy * -qx;
	  return out;
	}

	var rotateX_1 = rotateX$4;

	function rotateX$4(out, a, b, c) {
	  var by = b[1];
	  var bz = b[2];
	  var py = a[1] - by;
	  var pz = a[2] - bz;
	  var sc = Math.sin(c);
	  var cc = Math.cos(c);
	  out[0] = a[0];
	  out[1] = by + py * cc - pz * sc;
	  out[2] = bz + py * sc + pz * cc;
	  return out;
	}

	var rotateY_1 = rotateY$4;

	function rotateY$4(out, a, b, c) {
	  var bx = b[0];
	  var bz = b[2];
	  var px = a[0] - bx;
	  var pz = a[2] - bz;
	  var sc = Math.sin(c);
	  var cc = Math.cos(c);
	  out[0] = bx + pz * sc + px * cc;
	  out[1] = a[1];
	  out[2] = bz + pz * cc - px * sc;
	  return out;
	}

	var rotateZ_1 = rotateZ$4;

	function rotateZ$4(out, a, b, c) {
	  var bx = b[0];
	  var by = b[1];
	  var px = a[0] - bx;
	  var py = a[1] - by;
	  var sc = Math.sin(c);
	  var cc = Math.cos(c);
	  out[0] = bx + px * cc - py * sc;
	  out[1] = by + px * sc + py * cc;
	  out[2] = a[2];
	  return out;
	}

	var forEach_1 = forEach$3;
	var vec = create_1();

	function forEach$3(a, stride, offset, count, fn, arg) {
	  var i, l;

	  if (!stride) {
	    stride = 3;
	  }

	  if (!offset) {
	    offset = 0;
	  }

	  if (count) {
	    l = Math.min(count * stride + offset, a.length);
	  } else {
	    l = a.length;
	  }

	  for (i = offset; i < l; i += stride) {
	    vec[0] = a[i];
	    vec[1] = a[i + 1];
	    vec[2] = a[i + 2];
	    fn(vec, vec, arg);
	    a[i] = vec[0];
	    a[i + 1] = vec[1];
	    a[i + 2] = vec[2];
	  }

	  return a;
	}

	var glVec3 = {
	  EPSILON: epsilon,
	  create: create_1,
	  clone: clone_1,
	  angle: angle_1,
	  fromValues: fromValues_1,
	  copy: copy_1,
	  set: set_1,
	  equals: equals_1,
	  exactEquals: exactEquals_1,
	  add: add_1,
	  subtract: subtract_1,
	  sub: sub$7,
	  multiply: multiply_1,
	  mul: mul$9,
	  divide: divide_1,
	  div: div$3,
	  min: min_1,
	  max: max_1,
	  floor: floor_1,
	  ceil: ceil_1,
	  round: round_1,
	  scale: scale_1,
	  scaleAndAdd: scaleAndAdd_1,
	  distance: distance_1,
	  dist: dist$3,
	  squaredDistance: squaredDistance_1,
	  sqrDist: sqrDist$3,
	  length: length_1,
	  len: len$5,
	  squaredLength: squaredLength_1,
	  sqrLen: sqrLen$5,
	  negate: negate_1,
	  inverse: inverse_1,
	  normalize: normalize_1,
	  dot: dot_1,
	  cross: cross_1,
	  lerp: lerp_1,
	  random: random_1,
	  transformMat4: transformMat4_1,
	  transformMat3: transformMat3_1,
	  transformQuat: transformQuat_1,
	  rotateX: rotateX_1,
	  rotateY: rotateY_1,
	  rotateZ: rotateZ_1,
	  forEach: forEach_1
	};
	var cubemapFaceNormals = [[[0, 0, -1], [0, -1, 0], [1, 0, 0]], [[0, 0, 1], [0, -1, 0], [-1, 0, 0]], [[1, 0, 0], [0, 0, 1], [0, 1, 0]], [[1, 0, 0], [0, 0, -1], [0, -1, 0]], [[1, 0, 0], [0, -1, 0], [0, 0, 1]], [[-1, 0, 0], [0, -1, 0], [0, 0, -1]]];

	var cubemapSh = function cubemapSh(faces, cubemapSize, ch) {
	  var size = cubemapSize || 128;
	  var channels = ch || 4;
	  var cubeMapVecs = [];
	  faces.forEach(function (face, index) {
	    var faceVecs = [];

	    for (var v = 0; v < size; v++) {
	      for (var u = 0; u < size; u++) {
	        var fU = 2.0 * u / (size - 1.0) - 1.0;
	        var fV = 2.0 * v / (size - 1.0) - 1.0;
	        var vecX = [];
	        glVec3.scale(vecX, cubemapFaceNormals[index][0], fU);
	        var vecY = [];
	        glVec3.scale(vecY, cubemapFaceNormals[index][1], fV);
	        var vecZ = cubemapFaceNormals[index][2];
	        var res = [];
	        glVec3.add(res, vecX, vecY);
	        glVec3.add(res, res, vecZ);
	        glVec3.normalize(res, res);
	        faceVecs.push(res);
	      }
	    }

	    cubeMapVecs.push(faceVecs);
	  });
	  var sh = [new Float32Array(3), new Float32Array(3), new Float32Array(3), new Float32Array(3), new Float32Array(3), new Float32Array(3), new Float32Array(3), new Float32Array(3), new Float32Array(3)];
	  var weightAccum = 0;
	  faces.forEach(function (face, index) {
	    var pixels = face;
	    var gammaCorrect = true;
	    if (Object.prototype.toString.call(pixels) === '[object Float32Array]') gammaCorrect = false;

	    for (var y = 0; y < size; y++) {
	      for (var x = 0; x < size; x++) {
	        var texelVect = cubeMapVecs[index][y * size + x];
	        var weight = texelSolidAngle(x, y, size, size);
	        var weight1 = weight * 4 / 17;
	        var weight2 = weight * 8 / 17;
	        var weight3 = weight * 15 / 17;
	        var weight4 = weight * 5 / 68;
	        var weight5 = weight * 15 / 68;
	        var dx = texelVect[0];
	        var dy = texelVect[1];
	        var dz = texelVect[2];

	        for (var c = 0; c < 3; c++) {
	          var value = pixels[y * size * channels + x * channels + c] / 255;
	          if (gammaCorrect) value = Math.pow(value, 2.2);
	          sh[0][c] += value * weight1;
	          sh[1][c] += value * weight2 * dx;
	          sh[2][c] += value * weight2 * dy;
	          sh[3][c] += value * weight2 * dz;
	          sh[4][c] += value * weight3 * dx * dz;
	          sh[5][c] += value * weight3 * dz * dy;
	          sh[6][c] += value * weight3 * dy * dx;
	          sh[7][c] += value * weight4 * (3.0 * dz * dz - 1.0);
	          sh[8][c] += value * weight5 * (dx * dx - dy * dy);
	          weightAccum += weight;
	        }
	      }
	    }
	  });

	  for (var i = 0; i < sh.length; i++) {
	    sh[i][0] *= 4 * Math.PI / weightAccum;
	    sh[i][1] *= 4 * Math.PI / weightAccum;
	    sh[i][2] *= 4 * Math.PI / weightAccum;
	  }

	  return sh;
	};

	function texelSolidAngle(aU, aV, width, height) {
	  var U = 2.0 * (aU + 0.5) / width - 1.0;
	  var V = 2.0 * (aV + 0.5) / height - 1.0;
	  var invResolutionW = 1.0 / width;
	  var invResolutionH = 1.0 / height;
	  var x0 = U - invResolutionW;
	  var y0 = V - invResolutionH;
	  var x1 = U + invResolutionW;
	  var y1 = V + invResolutionH;
	  var angle$$1 = areaElement(x0, y0) - areaElement(x0, y1) - areaElement(x1, y0) + areaElement(x1, y1);
	  return angle$$1;
	}

	function areaElement(x, y) {
	  return Math.atan2(x * y, Math.sqrt(x * x + y * y + 1.0));
	}

	function createIBLMaps(regl, config) {
	  if (config === void 0) {
	    config = {};
	  }

	  var envTexture = config.envTexture;
	  var envCubeSize = config.envCubeSize || 512;
	  var sampleSize = config.sampleSize || 1024;
	  var roughnessLevels = config.roughnessLevels || 256;
	  var prefilterCubeSize = config.prefilterCubeSize || 256;
	  var dfgSize = config.dfgSize || 512;
	  var envMap;

	  if (!Array.isArray(envTexture)) {
	    envMap = createEquirectangularMapCube(regl, envTexture, envCubeSize);
	  } else {
	    var cube = regl.cube.apply(regl, envTexture);
	    envMap = createSkybox(regl, cube, envCubeSize);
	    cube.destroy();
	  }

	  var prefilterMap = createPrefilterCube(regl, envMap, prefilterCubeSize, sampleSize, roughnessLevels);
	  var dfgLUT = generateDFGLUT(regl, dfgSize, sampleSize, roughnessLevels);
	  var sh;

	  if (!config.ignoreSH) {
	    var faces = getEnvmapPixels(regl, envMap, envCubeSize);
	    sh = cubemapSh(faces, envCubeSize, 4);
	  }

	  var maps = {
	    envMap: envMap,
	    prefilterMap: prefilterMap,
	    dfgLUT: dfgLUT
	  };

	  if (sh) {
	    maps['sh'] = sh;
	  }

	  return maps;
	}

	function createSkybox(regl, cubemap, envCubeSize) {
	  var drawCube = regl({
	    frag: skyboxFrag,
	    vert: cubemapVS,
	    attributes: {
	      'aPosition': cubeData.vertices
	    },
	    uniforms: {
	      'projMatrix': regl.context('projMatrix'),
	      'viewMatrix': regl.context('viewMatrix'),
	      'cubeMap': cubemap
	    },
	    elements: cubeData.indices
	  });
	  var tmpFBO = regl.framebufferCube(envCubeSize);
	  renderToCube(regl, tmpFBO, drawCube);
	  return tmpFBO;
	}

	function getEnvmapPixels(regl, cubemap, envCubeSize) {
	  var drawCube = regl({
	    frag: skyboxFrag,
	    vert: cubemapVS,
	    attributes: {
	      'aPosition': cubeData.vertices
	    },
	    uniforms: {
	      'projMatrix': regl.context('projMatrix'),
	      'viewMatrix': regl.context('viewMatrix'),
	      'cubeMap': cubemap
	    },
	    elements: cubeData.indices
	  });
	  var faces = [];
	  var tmpFBO = regl.framebuffer(envCubeSize);
	  renderToCube(regl, tmpFBO, drawCube, {
	    size: envCubeSize
	  }, function () {
	    var pixels = regl.read();
	    faces.push(pixels);
	  });
	  tmpFBO.destroy();
	  return faces;
	}

	function createEquirectangularMapCube(regl, texture, size) {
	  size = size || 512;
	  var drawCube = regl({
	    frag: equirectangularMapFS,
	    vert: cubemapVS,
	    attributes: {
	      'aPosition': cubeData.vertices
	    },
	    uniforms: {
	      'projMatrix': regl.context('projMatrix'),
	      'viewMatrix': regl.context('viewMatrix'),
	      'equirectangularMap': texture
	    },
	    elements: cubeData.indices
	  });
	  var envMapFBO = regl.framebufferCube(size);
	  renderToCube(regl, envMapFBO, drawCube);
	  return envMapFBO;
	}

	function createPrefilterMipmap(regl, fromCubeMap, SIZE, sampleSize, roughnessLevels) {
	  sampleSize = sampleSize || 1024;
	  roughnessLevels = roughnessLevels || 256;
	  var distro = generateNormalDistribution(sampleSize, roughnessLevels);
	  var distributionMap = regl.texture({
	    data: distro,
	    width: roughnessLevels,
	    height: sampleSize,
	    min: 'nearest',
	    mag: 'nearest'
	  });
	  var drawCube = regl({
	    frag: prefilterFS,
	    vert: cubemapVS,
	    attributes: {
	      'aPosition': cubeData.vertices
	    },
	    uniforms: {
	      'projMatrix': regl.context('projMatrix'),
	      'viewMatrix': regl.context('viewMatrix'),
	      'environmentMap': fromCubeMap,
	      'distributionMap': distributionMap,
	      'roughness': regl.prop('roughness'),
	      'resolution': SIZE
	    },
	    elements: cubeData.indices,
	    viewport: {
	      x: 0,
	      y: 0,
	      width: regl.prop('size'),
	      height: regl.prop('size')
	    }
	  });
	  var size = SIZE;
	  var tmpFBO = regl.framebuffer(size);
	  var maxLevels = Math.log(size) / Math.log(2);
	  var mipmap = [];

	  var _loop4 = function _loop4(i) {
	    var roughness = i / (maxLevels - 1);
	    var faceId = 0;
	    renderToCube(regl, tmpFBO, drawCube, {
	      roughness: Math.sqrt(roughness),
	      size: size
	    }, function () {
	      var pixels = regl.read();

	      if (!mipmap[faceId]) {
	        mipmap[faceId] = {
	          mipmap: []
	        };
	      }

	      mipmap[faceId].mipmap.push(pixels);
	      faceId++;
	    });
	    size /= 2;
	    tmpFBO.resize(size);
	  };

	  for (var i = 0; i <= maxLevels; i++) {
	    _loop4(i);
	  }

	  tmpFBO.destroy();
	  return mipmap;
	}

	function createPrefilterCube(regl, fromCubeMap, SIZE, sampleSize, roughnessLevels) {
	  var mipmap = createPrefilterMipmap(regl, fromCubeMap, SIZE, sampleSize, roughnessLevels);
	  var prefilterMapFBO = regl.cube({
	    radius: SIZE,
	    min: 'linear mipmap linear',
	    mag: 'linear',
	    faces: mipmap
	  });
	  return prefilterMapFBO;
	}

	var quadVertices = [-1.0, 1.0, 0.0, -1.0, -1.0, 0.0, 1.0, 1.0, 0.0, 1.0, -1.0, 0.0];
	var quadTexcoords = [0.0, 1.0, 0.0, 0.0, 1.0, 1.0, 1.0, 0.0];
	var DFG_CACHE = {};

	function generateDFGLUT(regl, size, sampleSize, roughnessLevels) {
	  sampleSize = sampleSize || 1024;
	  roughnessLevels = roughnessLevels || 256;
	  var key = size + '-' + sampleSize + '-' + roughnessLevels;
	  var distro;

	  if (DFG_CACHE[key]) {
	    distro = DFG_CACHE[key];
	  } else {
	    distro = generateNormalDistribution(sampleSize, roughnessLevels);
	    DFG_CACHE[key] = distro;
	  }

	  var distributionMap = regl.texture({
	    data: distro,
	    width: roughnessLevels,
	    height: sampleSize,
	    type: 'float',
	    min: 'nearest',
	    mag: 'nearest'
	  });
	  var quadBuf = regl.buffer(quadVertices);
	  var quadTexBuf = regl.buffer(quadTexcoords);
	  var fbo = regl.framebuffer({
	    radius: size,
	    type: 'float',
	    min: 'nearest',
	    mag: 'nearest'
	  });
	  var drawLUT = regl({
	    frag: dfgFS,
	    vert: dfgVS,
	    attributes: {
	      'aPosition': {
	        buffer: quadBuf
	      },
	      'aTexCoord': {
	        buffer: quadTexBuf
	      }
	    },
	    uniforms: {
	      'distributionMap': distributionMap
	    },
	    framebuffer: fbo,
	    viewport: {
	      x: 0,
	      y: 0,
	      width: size,
	      height: size
	    },
	    count: quadVertices.length / 3,
	    primitive: 'triangle strip'
	  });
	  drawLUT();
	  quadBuf.destroy();
	  quadTexBuf.destroy();
	  return fbo;
	}

	function generateNormalDistribution(sampleSize, roughnessLevels) {
	  var pixels = new Array(sampleSize * roughnessLevels * 4);

	  for (var i = 0; i < sampleSize; i++) {
	    var _hammersley = hammersley(i, sampleSize),
	        x = _hammersley.x,
	        y = _hammersley.y;

	    for (var j = 0; j < roughnessLevels; j++) {
	      var roughness = j / roughnessLevels;
	      var a = roughness * roughness;
	      var phi = 2.0 * Math.PI * x;
	      var cosTheta = Math.sqrt((1 - y) / (1 + (a * a - 1.0) * y));
	      var sinTheta = Math.sqrt(1.0 - cosTheta * cosTheta);
	      var offset = (i * roughnessLevels + j) * 4;
	      pixels[offset] = sinTheta * Math.cos(phi);
	      pixels[offset + 1] = sinTheta * Math.sin(phi);
	      pixels[offset + 2] = cosTheta;
	      pixels[offset + 3] = 1.0;
	    }
	  }

	  return pixels;
	}

	function hammersley(i, sampleSize) {
	  var x = i / sampleSize;
	  var y = (i << 16 | i >>> 16) >>> 0;
	  y = ((y & 1431655765) << 1 | (y & 2863311530) >>> 1) >>> 0;
	  y = ((y & 858993459) << 2 | (y & 3435973836) >>> 2) >>> 0;
	  y = ((y & 252645135) << 4 | (y & 4042322160) >>> 4) >>> 0;
	  y = (((y & 16711935) << 8 | (y & 4278255360) >>> 8) >>> 0) / 4294967296;
	  return {
	    x: x,
	    y: y
	  };
	}

	var PBRHelper = Object.freeze({
	  createIBLMaps: createIBLMaps
	});
	var DEFAULT_UNIFORMS = {
	  baseColorTexture: null,
	  baseColorFactor: [1, 1, 1, 1],
	  metallicRoughnessTexture: null,
	  metallicFactor: 1,
	  roughnessFactor: 1,
	  occlusionTexture: null,
	  occlusion: 0,
	  occlusionStrength: 1,
	  normalTexture: null,
	  normalStrength: 1,
	  reflectance: 0.5,
	  emissiveTexture: null,
	  emissiveFactor: [0, 0, 0, 0],
	  clearCoat: undefined,
	  clearCoatRoughnessTexture: null,
	  clearCoatRoughness: 0,
	  clearCoatNormalTexture: null,
	  clearCoatIorChange: true,
	  anisotropy: undefined,
	  anisotropyDirection: [1, 0, 0],
	  postLightingColor: [0, 0, 0, 0],
	  HAS_TONE_MAPPING: 1,
	  GAMMA_CORRECT_INPUT: 1,
	  uvScale: [1, 1],
	  uvOffset: [0, 0]
	};

	var LitMaterial = function (_Material$3) {
	  _inheritsLoose(LitMaterial, _Material$3);

	  function LitMaterial(uniforms) {
	    return _Material$3.call(this, uniforms, DEFAULT_UNIFORMS) || this;
	  }

	  var _proto15 = LitMaterial.prototype;

	  _proto15.createDefines = function createDefines() {
	    var uniforms = this.uniforms;
	    var defines = {
	      BLEND_MODE_TRANSPARENT: 1
	    };

	    if (uniforms['baseColorFactor'] && uniforms['baseColorFactor'][3] < 1) {
	      defines['BLEND_MODE_TRANSPARENT'] = 1;
	      defines['TRANSPARENT_MATERIAL'] = 1;
	    }

	    if (uniforms['baseColorTexture']) {
	      defines['MATERIAL_HAS_BASECOLOR_MAP'] = 1;
	    }

	    if (uniforms['metallicRoughnessTexture']) {
	      defines['MATERIAL_HAS_METALLICROUGHNESS_MAP'] = 1;
	    }

	    if (uniforms['occlusionTexture']) {
	      defines['MATERIAL_HAS_AO_MAP'] = 1;
	      defines['MATERIAL_HAS_AMBIENT_OCCLUSION'] = 1;
	    }

	    if (uniforms['emissiveTexture']) {
	      defines['MATERIAL_HAS_EMISSIVE_MAP'] = 1;
	      defines['MATERIAL_HAS_EMISSIVE'] = 1;
	    }

	    if (uniforms['clearCoatRoughnessTexture']) {
	      defines['MATERIAL_HAS_CLEARCOAT_ROUGNESS_MAP'] = 1;
	    }

	    if (uniforms['clearCoatNormalTexture']) {
	      defines['MATERIAL_HAS_CLEAR_COAT_NORMAL'] = 1;
	    }

	    if (uniforms['anisotropy'] !== undefined) {
	      defines['MATERIAL_HAS_ANISOTROPY'] = 1;
	    }

	    if (uniforms['normalTexture']) {
	      defines['MATERIAL_HAS_NORMAL'] = 1;
	    }

	    if (uniforms['clearCoat'] !== undefined) {
	      defines['MATERIAL_HAS_CLEAR_COAT'] = 1;
	    }

	    if (uniforms['clearCoatIorChange']) {
	      defines['CLEAR_COAT_IOR_CHANGE'] = 1;
	    }

	    if (uniforms['postLightingColor']) {
	      defines['MATERIAL_HAS_POST_LIGHTING_COLOR'] = 1;
	    }

	    if (defines['MATERIAL_HAS_BASECOLOR_MAP'] || defines['MATERIAL_HAS_METALLICROUGHNESS_MAP'] || defines['MATERIAL_HAS_METMATERIAL_HAS_AO_MAPALLICROUGHNESS_MAP'] || defines['MATERIAL_HAS_EMISSIVE_MAP'] || defines['MATERIAL_HAS_CLEARCOAT_ROUGNESS_MAP'] || defines['MATERIAL_HAS_CLEAR_COAT_NORMAL']) {
	      defines['MATERIAL_HAS_MAP'] = 1;
	    }

	    if (uniforms['HAS_TONE_MAPPING']) {
	      defines['HAS_TONE_MAPPING'] = 1;
	    }

	    if (uniforms['GAMMA_CORRECT_INPUT']) {
	      defines['GAMMA_CORRECT_INPUT'] = 1;
	    }

	    return defines;
	  };

	  _proto15.getUniforms = function getUniforms(regl) {
	    var uniforms = _Material$3.prototype.getUniforms.call(this, regl);

	    return {
	      material: uniforms,
	      uvScale: uniforms.uvScale,
	      uvOffset: uniforms.uvOffset
	    };
	  };

	  return LitMaterial;
	}(Material$1);

	var litFrag = "#include <fl_header_frag>\n\n\n\n#if defined(HAS_SHADOWING)\n\n#include <vsm_shadow_frag>\n\n#endif\n\n\n\n//webgl 2.0中的函数实现\n\n#include <fl_common_math_glsl>\n\n#include <fl_common_graphics_glsl>\n\n//initialize frameUniforms\n\n#include <fl_uniforms_glsl>\n\n//varyings\n\n#include <fl_inputs_frag>\n\n//brdf functions\n\n#include <fl_brdf_frag>\n\n//MaterialInputs结构定义\n\n//mapatalksgl的Material => MaterialInputs\n\n#include <fl_common_shading_frag>\n\n#include <fl_getters_frag>\n\n#include <fl_material_inputs_frag>\n\n#include <fl_common_material_frag>\n\n//构造各类shading_*的值\n\n#include <fl_shading_params>\n\n//PixelParams结构定义\n\n#include <fl_common_lighting_frag>\n\n\n\n#include <fl_material_uniforms_frag>\n\n//初始化light相关的uniforms，如light_iblDFG等\n\n#include <fl_light_uniforms_frag>\n\n\n\n#include <fl_ambient_occlusion_frag>\n\n//IBL灯光的计算逻辑\n\n#include <fl_light_indirect>\n\n#include <fl_shading_model_standard_frag>\n\n//有向光的计算逻辑\n\n#include <fl_light_directional>\n\n\n\n//lit材质的逻辑\n\n#include <fl_shading_lit>\n\n\n\n#include <fl_main>\n\n";
	var vertSource = "#define SHADER_NAME standard_vertex\n\n\n\n    attribute vec3 aPosition;\n\n#ifdef IS_LINE_EXTRUSION\n\n    #define EXTRUDE_SCALE 63.0;\n\n    attribute vec2 aExtrude;\n\n    uniform float lineWidth;\n\n    uniform float lineHeight;\n\n    uniform float linePixelScale;\n\n#endif\n\n#ifdef HAS_ATTRIBUTE_TANGENTS\n\n    #ifndef HAS_ATTRIBUTE_NORMALS\n\n    attribute vec4 aTangent;\n\n    #else\n\n    attribute vec3 aNormal;\n\n    #endif\n\n#endif\n\n#ifdef HAS_COLOR\n\n    attribute vec3 aColor;\n\n#endif\n\n\n\n\n\n#if defined(HAS_ATTRIBUTE_UV0)\n\n    attribute vec2 aTexCoord0;\n\n    uniform vec2 uvScale;\n\n    uniform vec2 uvOffset;\n\n#endif\n\n#if defined(HAS_ATTRIBUTE_UV1)\n\n    attribute vec2 aTexCoord1;\n\n#endif\n\n\n\n    uniform mat3 normalMatrix;\n\n    uniform mat4 modelMatrix;\n\n    uniform mat4 modelViewMatrix;\n\n    uniform mat4 projViewMatrix;\n\n    uniform mat4 projViewModelMatrix;\n\n\n\n#include <fl_uniforms_glsl>\n\n#include <fl_inputs_vert>\n\n\n\n    struct ObjectUniforms {\n\n        mat4 worldFromModelMatrix;\n\n        mat3 worldFromModelNormalMatrix;\n\n    } objectUniforms;\n\n\n\n    vec4 computeWorldPosition() {\n\n        return modelMatrix * mesh_position;\n\n    }\n\n\n\n#include <fl_material_inputs_vert>\n\n#include <fl_common_math_glsl>\n\n\n\n#ifdef HAS_SHADOWING\n\n    #include <vsm_shadow_vert>\n\n#endif\n\n\n\n    void initMeshPosition() {\n\n        #ifdef IS_LINE_EXTRUSION\n\n            float halfwidth = lineWidth / 2.0;\n\n            float outset = halfwidth;\n\n            vec2 dist = outset * aExtrude / EXTRUDE_SCALE;\n\n            //linePixelScale = tileRatio * resolution / tileResolution\n\n            mesh_position = vec4(aPosition + vec3(dist, 0.0) * linePixelScale, 1.0);\n\n        #else\n\n            mesh_position = vec4(aPosition, 1.0);\n\n        #endif\n\n    }\n\n\n\n    void initAttributes() {\n\n        initMeshPosition();\n\n        #if defined(MATERIAL_HAS_ANISOTROPY) || defined(MATERIAL_HAS_NORMAL) || defined(MATERIAL_HAS_CLEAR_COAT_NORMAL)\n\n            mesh_tangents = aTangent;\n\n        #endif\n\n        #if defined(HAS_ATTRIBUTE_COLOR)\n\n            mesh_color = vec4(aColor, 1.0);\n\n        #endif\n\n        #if defined(HAS_ATTRIBUTE_UV0)\n\n            mesh_uv0 = (aTexCoord0 + uvOffset) * uvScale;\n\n        #endif\n\n        #if defined(HAS_ATTRIBUTE_UV1)\n\n            mesh_uv1 = aTexCoord1;\n\n        #endif\n\n\n\n        //TODO SKINNING的相关属性\n\n        // mesh_bone_indices // vec4\n\n        // mesh_bone_weights // vec4\n\n    }\n\n\n\n    void initObjectUniforms() {\n\n        objectUniforms.worldFromModelMatrix = modelMatrix;\n\n        objectUniforms.worldFromModelNormalMatrix = normalMatrix;\n\n    }\n\n\n\n    void initTangents(inout MaterialVertexInputs material) {\n\n        #if defined(HAS_ATTRIBUTE_TANGENTS)\n\n            // If the material defines a value for the \"normal\" property, we need to output\n\n            // the full orthonormal basis to apply normal mapping\n\n            #if defined(MATERIAL_HAS_ANISOTROPY) || defined(MATERIAL_HAS_NORMAL) || defined(MATERIAL_HAS_CLEAR_COAT_NORMAL)\n\n                // Extract the normal and tangent in world space from the input quaternion\n\n                // We encode the orthonormal basis as a quaternion to save space in the attributes\n\n                toTangentFrame(mesh_tangents, material.worldNormal, vertex_worldTangent);\n\n\n\n                #if defined(HAS_SKINNING)\n\n                    skinNormal(material.worldNormal, mesh_bone_indices, mesh_bone_weights);\n\n                    skinNormal(vertex_worldTangent, mesh_bone_indices, mesh_bone_weights);\n\n                #endif\n\n\n\n                // We don't need to normalize here, even if there's a scale in the matrix\n\n                // because we ensure the worldFromModelNormalMatrix pre-scales the normal such that\n\n                // all its components are < 1.0. This precents the bitangent to exceed the range of fp16\n\n                // in the fragment shader, where we renormalize after interpolation\n\n                vertex_worldTangent = objectUniforms.worldFromModelNormalMatrix * vertex_worldTangent;\n\n                material.worldNormal = objectUniforms.worldFromModelNormalMatrix * material.worldNormal;\n\n\n\n                // Reconstruct the bitangent from the normal and tangent. We don't bother with\n\n                // normalization here since we'll do it after interpolation in the fragment stage\n\n                vertex_worldBitangent =\n\n                        cross(material.worldNormal, vertex_worldTangent) * sign(mesh_tangents.w);\n\n            #else\n\n                #if defined(HAS_ATTRIBUTE_NORMALS)\n\n                    material.worldNormal = aNormal;\n\n                #else\n\n                    // Without anisotropy or normal mapping we only need the normal vector\n\n                    toTangentFrame(mesh_tangents, material.worldNormal);\n\n                #endif\n\n                material.worldNormal = objectUniforms.worldFromModelNormalMatrix * material.worldNormal;\n\n                #if defined(HAS_SKINNING)\n\n                    skinNormal(material.worldNormal, mesh_bone_indices, mesh_bone_weights);\n\n                #endif\n\n            #endif\n\n        #endif\n\n    }\n\n    #ifdef USE_INSTANCE\n\n        #include <invert_vert>\n\n        #include <instance_vert>\n\n        varying vec4 vInstanceColor;\n\n    #endif\n\n\n\n    #ifdef USE_SKIN\n\n        #include <invert_vert>\n\n        #include <skin_vert>\n\n    #endif\n\n    void main()\n\n    {\n\n        initAttributes();\n\n        initFrameUniforms();\n\n        initObjectUniforms();\n\n        MaterialVertexInputs material;\n\n        initMaterialVertex(material);\n\n        initTangents(material);\n\n\n\n         // Handle built-in interpolated attributes\n\n        #if defined(HAS_ATTRIBUTE_COLOR)\n\n            vertex_color = material.color;\n\n        #endif\n\n        #if defined(HAS_ATTRIBUTE_UV0)\n\n            vertex_uv01.xy = material.uv0;\n\n        #endif\n\n        #if defined(HAS_ATTRIBUTE_UV1)\n\n            vertex_uv01.zw = material.uv1;\n\n        #endif\n\n\n\n\n\n            // The world position can be changed by the user in materialVertex()\n\n            vertex_worldPosition = material.worldPosition.xyz;\n\n        #ifdef HAS_ATTRIBUTE_TANGENTS\n\n            vertex_worldNormal = material.worldNormal;\n\n        #endif\n\n\n\n\n\n        #ifdef USE_INSTANCE\n\n            mat4 attributeMatrix = instance_getAttributeMatrix();\n\n            #ifdef USE_SKIN\n\n                mat4 worldMatrix = attributeMatrix * skin_getSkinMatrix();\n\n                mat4 pvmMatrix = projViewMatrix * worldMatrix;\n\n            #else\n\n                mat4 pvmMatrix = projViewMatrix * attributeMatrix;\n\n            #endif\n\n            gl_Position = = pvmMatrix * mesh_position;\n\n        #else\n\n            #ifdef USE_SKIN\n\n                mat4 worldMatrix =  modelMatrix * skin_getSkinMatrix();\n\n                gl_Position = projViewMatrix * worldMatrix * mesh_position;\n\n            #else\n\n                gl_Position = projViewModelMatrix * mesh_position;\n\n            #endif\n\n        #endif\n\n        // gl_Position =  projViewModelMatrix * mesh_position;\n\n\n\n        #ifdef HAS_SHADOWING\n\n            shadow_computeShadowPars(mesh_position);\n\n        #endif\n\n    }\n\n\n\n    //------------------------------------------------------------------------------\n\n    // Shadowing\n\n    //------------------------------------------------------------------------------\n\n\n\n    // #if defined(HAS_SHADOWING) && defined(HAS_DIRECTIONAL_LIGHTING)\n\n    //\n\n    // vec4 getLightSpacePosition(const vec3 p, const vec3 n) {\n\n    //     float NoL = saturate(dot(n, frameUniforms.lightDirection));\n\n\n\n    // #ifdef TARGET_MOBILE\n\n    //     float normalBias = 1.0 - NoL * NoL;\n\n    // #else\n\n    //     float normalBias = sqrt(1.0 - NoL * NoL);\n\n    // #endif\n\n\n\n    //     vec3 offsetPosition = p + n * (normalBias * frameUniforms.shadowBias.y);\n\n    //     vec4 lightSpacePosition = (getLightFromWorldMatrix() * vec4(offsetPosition, 1.0));\n\n    //     lightSpacePosition.z -= frameUniforms.shadowBias.x;\n\n\n\n    //     return lightSpacePosition;\n\n    // }\n\n    // #endif\n\n\n\n";

	var StandardShader = function (_MeshShader3) {
	  _inheritsLoose(StandardShader, _MeshShader3);

	  function StandardShader(config, frag, materialUniforms) {
	    var _this9;

	    if (config === void 0) {
	      config = {};
	    }

	    var extraCommandProps = config.extraCommandProps || {};
	    var positionAttribute = config.positionAttribute || 'aPosition';
	    var normalAttribute = config.normalAttribute || 'aNormal';
	    var tangentAttribute = config.tangentAttribute || 'aTangent';
	    var colorAttribute = config.colorAttribute || 'aColor';
	    var uv0Attribute = config.uv0Attribute || 'aTexCoord0';
	    var uv1Attribute = config.uv1Attribute || 'aTexCoord1';
	    extraCommandProps = extend({}, extraCommandProps, {
	      blend: {
	        enable: true,
	        func: {
	          src: 'one',
	          dst: 'one minus src alpha'
	        },
	        equation: 'add'
	      },
	      sample: {
	        alpha: true
	      }
	    });
	    var vert = vertSource;

	    if (positionAttribute !== 'aPosition') {
	      vert = vert.replace(/aPosition/g, positionAttribute);
	    }

	    if (normalAttribute !== 'aNormal') {
	      vert = vert.replace(/aNormal/g, normalAttribute);
	    }

	    if (tangentAttribute !== 'aTangent') {
	      vert = vert.replace(/aTangent/g, tangentAttribute);
	    }

	    if (colorAttribute !== 'aColor') {
	      vert = vert.replace(/aColor/g, colorAttribute);
	    }

	    if (uv0Attribute !== 'aTexCoord0') {
	      vert = vert.replace(/aTexCoord0/g, uv0Attribute);
	    }

	    if (uv1Attribute !== 'aTexCoord1') {
	      vert = vert.replace(/aTexCoord1/g, uv1Attribute);
	    }

	    _this9 = _MeshShader3.call(this, {
	      vert: vert,
	      frag: frag,
	      uniforms: [{
	        name: 'normalMatrix',
	        type: 'function',
	        fn: function fn(context, props) {
	          return fromMat4([], props['modelMatrix']);
	        }
	      }, 'modelMatrix', {
	        name: 'projViewModelMatrix',
	        type: 'function',
	        fn: function fn(context, props) {
	          return multiply$3([], props['projViewMatrix'], props['modelMatrix']);
	        }
	      }, {
	        name: 'modelViewMatrix',
	        type: 'function',
	        fn: function fn(context, props) {
	          return multiply$3([], props['viewMatrix'], props['modelMatrix']);
	        }
	      }, 'uvScale', 'uvOffset', 'resolution', 'cameraPosition', 'time', 'lightColorIntensity', 'sun', 'lightDirection', 'iblLuminance', 'exposure', 'ev100', 'light_iblDFG', 'light_iblSpecular', 'iblSH[9]', 'iblMaxMipLevel', 'projViewMatrix'].concat(materialUniforms).concat(config.uniforms || []),
	      extraCommandProps: extraCommandProps,
	      defines: config.defines
	    }) || this;
	    _this9.positionAttribute = positionAttribute;
	    _this9.normalAttribute = normalAttribute;
	    _this9.tangentAttribute = tangentAttribute;
	    _this9.colorAttribute = colorAttribute;
	    _this9.uv0Attribute = uv0Attribute;
	    _this9.uv1Attribute = uv1Attribute;
	    return _this9;
	  }

	  var _proto16 = StandardShader.prototype;

	  _proto16.getGeometryDefines = function getGeometryDefines(geometry) {
	    var defines = {};

	    if (geometry.data[this.tangentAttribute] || geometry.data[this.normalAttribute]) {
	      defines['HAS_ATTRIBUTE_TANGENTS'] = 1;

	      if (!geometry.data[this.tangentAttribute]) {
	        defines['HAS_ATTRIBUTE_NORMALS'] = 1;
	      }
	    }

	    if (geometry.data[this.colorAttribute]) {
	      defines['HAS_COLOR'] = 1;
	      defines['HAS_ATTRIBUTE_COLOR'] = 1;
	    }

	    if (geometry.data[this.uv0Attribute]) {
	      defines['HAS_ATTRIBUTE_UV0'] = 1;
	    }

	    if (geometry.data[this.uv1Attribute]) {
	      defines['HAS_ATTRIBUTE_UV1'] = 1;
	    }

	    return defines;
	  };

	  return StandardShader;
	}(MeshShader);

	var UNIFORMS = ['material.baseColorTexture', 'material.baseColorFactor', 'material.metallicRoughnessTexture', 'material.metallicFactor', 'material.roughnessFactor', 'material.occlusionTexture', 'material.occlusion', 'material.occlusionStrength', 'material.emissiveTexture', 'material.emissiveFactor', 'material.postLightingColor', 'material.reflectance', 'material.clearCoat', 'material.clearCoatRoughnessTexture', 'material.clearCoatRoughness', 'material.clearCoatNormalTexture', 'material.anisotropy', 'material.anisotropyDirection', 'material.normalTexture'];

	var LitShader = function (_StandardShader) {
	  _inheritsLoose(LitShader, _StandardShader);

	  function LitShader(config) {
	    if (config === void 0) {
	      config = {};
	    }

	    return _StandardShader.call(this, config, litFrag, UNIFORMS) || this;
	  }

	  return LitShader;
	}(StandardShader);

	var DEFAULT_UNIFORMS$1 = {
	  baseColorTexture: null,
	  baseColorFactor: [1, 1, 1, 1],
	  metallicRoughnessTexture: null,
	  roughnessFactor: 1,
	  occlusionTexture: null,
	  occlusion: 0,
	  occlusionStrength: 1,
	  normalTexture: null,
	  normalStrength: 1,
	  emissiveTexture: null,
	  emissiveFactor: [0, 0, 0, 0],
	  postLightingColor: [0, 0, 0, 0],
	  HAS_TONE_MAPPING: 1,
	  sheenColor: [-1, -1, -1],
	  subsurfaceColor: undefined,
	  uvScale: [1, 1],
	  uvOffset: [0, 0]
	};

	var ClothMaterial = function (_Material$4) {
	  _inheritsLoose(ClothMaterial, _Material$4);

	  function ClothMaterial(uniforms) {
	    return _Material$4.call(this, uniforms, DEFAULT_UNIFORMS$1) || this;
	  }

	  var _proto17 = ClothMaterial.prototype;

	  _proto17.createDefines = function createDefines() {
	    var uniforms = this.uniforms;
	    var defines = {
	      'SHADING_MODEL_CLOTH': 1
	    };

	    if (uniforms['baseColorTexture']) {
	      defines['MATERIAL_HAS_BASECOLOR_MAP'] = 1;
	    }

	    if (uniforms['metallicRoughnessTexture']) {
	      defines['MATERIAL_HAS_METALLICROUGHNESS_MAP'] = 1;
	    }

	    if (uniforms['occlusionTexture']) {
	      defines['MATERIAL_HAS_AO_MAP'] = 1;
	      defines['MATERIAL_HAS_AMBIENT_OCCLUSION'] = 1;
	    }

	    if (uniforms['emissiveTexture']) {
	      defines['MATERIAL_HAS_EMISSIVE_MAP'] = 1;
	      defines['MATERIAL_HAS_EMISSIVE'] = 1;
	    }

	    if (uniforms['normalTexture']) {
	      defines['MATERIAL_HAS_NORMAL'] = 1;
	    }

	    if (uniforms['postLightingColor']) {
	      defines['MATERIAL_HAS_POST_LIGHTING_COLOR'] = 1;
	    }

	    if (defines['MATERIAL_HAS_BASECOLOR_MAP'] || defines['MATERIAL_HAS_METALLICROUGHNESS_MAP'] || defines['MATERIAL_HAS_METMATERIAL_HAS_AO_MAPALLICROUGHNESS_MAP'] || defines['MATERIAL_HAS_EMISSIVE_MAP']) {
	      defines['MATERIAL_HAS_MAP'] = 1;
	    }

	    if (uniforms['HAS_TONE_MAPPING']) {
	      defines['HAS_TONE_MAPPING'] = 1;
	    }

	    if (uniforms['subsurfaceColor'] !== undefined) {
	      defines['MATERIAL_HAS_SUBSURFACE_COLOR'] = 1;
	    }

	    return defines;
	  };

	  _proto17.getUniforms = function getUniforms(regl) {
	    var uniforms = _Material$4.prototype.getUniforms.call(this, regl);

	    return {
	      material: uniforms,
	      uvScale: uniforms.uvScale,
	      uvOffset: uniforms.uvOffset
	    };
	  };

	  return ClothMaterial;
	}(Material$1);

	var clothFrag = "#include <fl_header_frag>\n\n\n\n#if defined(HAS_SHADOWING)\n\n#include <vsm_shadow_frag>\n\n#endif\n\n\n\n//webgl 2.0中的函数实现\n\n#include <fl_common_math_glsl>\n\n#include <fl_common_graphics_glsl>\n\n//initialize frameUniforms\n\n#include <fl_uniforms_glsl>\n\n//varyings\n\n#include <fl_inputs_frag>\n\n//brdf functions\n\n#include <fl_brdf_frag>\n\n//MaterialInputs结构定义\n\n//mapatalksgl的Material => MaterialInputs\n\n#include <fl_common_shading_frag>\n\n#include <fl_getters_frag>\n\n#include <fl_material_inputs_frag>\n\n#include <fl_common_material_frag>\n\n//构造各类shading_*的值\n\n#include <fl_shading_params>\n\n//PixelParams结构定义\n\n#include <fl_common_lighting_frag>\n\n\n\n#include <fl_material_uniforms_frag>\n\n//初始化light相关的uniforms，如light_iblDFG等\n\n#include <fl_light_uniforms_frag>\n\n\n\n#include <fl_ambient_occlusion_frag>\n\n//IBL灯光的计算逻辑\n\n#include <fl_light_indirect>\n\n#include <fl_shading_model_cloth_frag>\n\n//有向光的计算逻辑\n\n#include <fl_light_directional>\n\n\n\n//lit材质的逻辑\n\n#include <fl_shading_lit>\n\n\n\n#include <fl_main>\n\n";
	var UNIFORMS$1 = ['material.baseColorTexture', 'material.baseColorFactor', 'material.metallicRoughnessTexture', 'material.roughnessFactor', 'material.occlusionTexture', 'material.occlusion', 'material.occlusionStrength', 'material.emissiveTexture', 'material.emissiveFactor', 'material.postLightingColor', 'material.normalTexture', 'material.sheenColor', 'material.subsurfaceColor'];

	var ClothShader = function (_StandardShader2) {
	  _inheritsLoose(ClothShader, _StandardShader2);

	  function ClothShader(config) {
	    if (config === void 0) {
	      config = {};
	    }

	    return _StandardShader2.call(this, config, clothFrag, UNIFORMS$1) || this;
	  }

	  return ClothShader;
	}(StandardShader);

	var DEFAULT_UNIFORMS$2 = {
	  baseColorTexture: null,
	  baseColorFactor: [1, 1, 1, 1],
	  metallicRoughnessTexture: null,
	  roughnessFactor: 1,
	  occlusionTexture: null,
	  occlusion: 0,
	  occlusionStrength: 1,
	  normalTexture: null,
	  normalStrength: 1,
	  emissiveTexture: null,
	  emissiveFactor: [0, 0, 0, 0],
	  postLightingColor: [0, 0, 0, 0],
	  HAS_TONE_MAPPING: 1,
	  thickness: 0.5,
	  subsurfacePower: 12.234,
	  subsurfaceColor: [1, 1, 1],
	  uvScale: [1, 1],
	  uvOffset: [0, 0]
	};

	var ClothMaterial$1 = function (_Material$5) {
	  _inheritsLoose(ClothMaterial$1, _Material$5);

	  function ClothMaterial$1(uniforms) {
	    return _Material$5.call(this, uniforms, DEFAULT_UNIFORMS$2) || this;
	  }

	  var _proto18 = ClothMaterial$1.prototype;

	  _proto18.createDefines = function createDefines() {
	    var uniforms = this.uniforms;
	    var defines = {
	      'SHADING_MODEL_SUBSURFACE': 1,
	      'BLEND_MODE_TRANSPARENT': 1
	    };

	    if (uniforms['baseColorTexture']) {
	      defines['MATERIAL_HAS_BASECOLOR_MAP'] = 1;
	    }

	    if (uniforms['metallicRoughnessTexture']) {
	      defines['MATERIAL_HAS_METALLICROUGHNESS_MAP'] = 1;
	    }

	    if (uniforms['occlusionTexture']) {
	      defines['MATERIAL_HAS_AO_MAP'] = 1;
	      defines['MATERIAL_HAS_AMBIENT_OCCLUSION'] = 1;
	    }

	    if (uniforms['emissiveTexture']) {
	      defines['MATERIAL_HAS_EMISSIVE_MAP'] = 1;
	      defines['MATERIAL_HAS_EMISSIVE'] = 1;
	    }

	    if (uniforms['normalTexture']) {
	      defines['MATERIAL_HAS_NORMAL'] = 1;
	    }

	    if (uniforms['postLightingColor']) {
	      defines['MATERIAL_HAS_POST_LIGHTING_COLOR'] = 1;
	    }

	    if (defines['MATERIAL_HAS_BASECOLOR_MAP'] || defines['MATERIAL_HAS_METALLICROUGHNESS_MAP'] || defines['MATERIAL_HAS_METMATERIAL_HAS_AO_MAPALLICROUGHNESS_MAP'] || defines['MATERIAL_HAS_EMISSIVE_MAP']) {
	      defines['MATERIAL_HAS_MAP'] = 1;
	    }

	    if (uniforms['HAS_TONE_MAPPING']) {
	      defines['HAS_TONE_MAPPING'] = 1;
	    }

	    return defines;
	  };

	  _proto18.getUniforms = function getUniforms(regl) {
	    var uniforms = _Material$5.prototype.getUniforms.call(this, regl);

	    return {
	      material: uniforms,
	      uvScale: uniforms.uvScale,
	      uvOffset: uniforms.uvOffset
	    };
	  };

	  return ClothMaterial$1;
	}(Material$1);

	var subsurfaceFrag = "#include <fl_header_frag>\n\n\n\n#if defined(HAS_SHADOWING)\n\n#include <vsm_shadow_frag>\n\n#endif\n\n\n\n//webgl 2.0中的函数实现\n\n#include <fl_common_math_glsl>\n\n#include <fl_common_graphics_glsl>\n\n//initialize frameUniforms\n\n#include <fl_uniforms_glsl>\n\n//varyings\n\n#include <fl_inputs_frag>\n\n//brdf functions\n\n#include <fl_brdf_frag>\n\n//MaterialInputs结构定义\n\n//mapatalksgl的Material => MaterialInputs\n\n#include <fl_common_shading_frag>\n\n#include <fl_getters_frag>\n\n#include <fl_material_inputs_frag>\n\n#include <fl_common_material_frag>\n\n#include <fl_shading_params>\n\n//PixelParams结构定义\n\n#include <fl_common_lighting_frag>\n\n\n\n#include <fl_material_uniforms_frag>\n\n//初始化light相关的uniforms，如light_iblDFG等\n\n#include <fl_light_uniforms_frag>\n\n\n\n#include <fl_ambient_occlusion_frag>\n\n//IBL灯光的计算逻辑\n\n#include <fl_light_indirect>\n\n#include <fl_shading_model_subsurface_frag>\n\n//有向光的计算逻辑\n\n#include <fl_light_directional>\n\n\n\n//lit材质的逻辑\n\n#include <fl_shading_lit>\n\n\n\n#include <fl_main>\n\n";
	var UNIFORMS$2 = ['material.baseColorTexture', 'material.baseColorFactor', 'material.metallicRoughnessTexture', 'material.roughnessFactor', 'material.occlusionTexture', 'material.occlusion', 'material.occlusionStrength', 'material.emissiveTexture', 'material.emissiveFactor', 'material.postLightingColor', 'material.normalTexture', 'material.thickness', 'material.subsurfacePower', 'material.subsurfaceColor'];

	var ClothShader$1 = function (_StandardShader3) {
	  _inheritsLoose(ClothShader$1, _StandardShader3);

	  function ClothShader$1(config) {
	    if (config === void 0) {
	      config = {};
	    }

	    return _StandardShader3.call(this, config, subsurfaceFrag, UNIFORMS$2) || this;
	  }

	  return ClothShader$1;
	}(StandardShader);

	var vsmFrag = "#define SHADER_NAME vsm_mapping\n\n// #extension GL_OES_standard_derivatives : enable\n\n\n\n// precision mediump float;\n\n\n\n// varying vec4 vPosition;\n\n\n\n//VSM\n\nvoid main()\n\n{\n\n    // float depth = gl_FragCoord.z;//vPosition.z / vPosition.w;\n\n    // depth = depth * 0.5 + 0.5;\n\n    // float moment1 = depth;\n\n    // float moment2 = depth * depth;\n\n\n\n    // // Adjusting moments using partial derivative\n\n    // float dx = dFdx(depth);\n\n    // float dy = dFdy(depth);\n\n    // // Resovle shadow acne\n\n    // moment2 += 0.25 * (dx * dx + dy * dy);\n\n    // gl_FragColor = vec4(moment1, moment2, depth, 0.0);\n\n\n\n    gl_FragColor = vec4(gl_FragCoord.z, 0.0, 0.0, 1.0);\n\n}\n\n";
	var vsmVert = "attribute vec3 aPosition;\n\n\n\nuniform mat4 lightProjViewModelMatrix;\n\n\n\nvarying vec4 vPosition;\n\n\n\nvoid main()\n\n{\n\n    gl_Position = lightProjViewModelMatrix * vec4(aPosition, 1.);\n\n    vPosition = gl_Position;\n\n}\n\n";

	var ShadowMapShader = function (_MeshShader4) {
	  _inheritsLoose(ShadowMapShader, _MeshShader4);

	  function ShadowMapShader() {
	    return _MeshShader4.call(this, {
	      vert: vsmVert,
	      frag: vsmFrag,
	      uniforms: [{
	        name: 'lightProjViewModelMatrix',
	        type: 'function',
	        fn: function fn(context, props) {
	          return multiply$3([], props['lightProjViewMatrix'], props['modelMatrix']);
	        }
	      }],
	      extraCommandProps: {}
	    }) || this;
	  }

	  var _proto19 = ShadowMapShader.prototype;

	  _proto19.filter = function filter(mesh) {
	    return mesh.castShadow;
	  };

	  _proto19.getMeshCommand = function getMeshCommand(regl, mesh) {
	    if (!this.commands['shadowmap']) {
	      this.commands['shadowmap'] = this.createREGLCommand(regl, null, mesh.getAttributes(), null, mesh.getElements());
	    }

	    return this.commands['shadowmap'];
	  };

	  return ShadowMapShader;
	}(MeshShader);

	var boxBlurFrag = "precision mediump float;\n\n\n\nvarying vec2 vTexCoord;\n\n\n\nuniform sampler2D textureSource;\n\nuniform vec2 textureSize;\n\n\n\nvoid main()\n\n{\n\n    float c = 0.0;\n\n    for (int x = -BOXBLUR_OFFSET; x <= BOXBLUR_OFFSET; ++x)\n\n    for (int y = -BOXBLUR_OFFSET; y <= BOXBLUR_OFFSET; ++y)\n\n	{\n\n        c += texture2D(textureSource, vTexCoord.st + vec2(float(x) / textureSize.x, float(y) / textureSize.y)).r;\n\n	}\n\n    float color = c / float((2 * BOXBLUR_OFFSET + 1) * (2 * BOXBLUR_OFFSET + 1));\n\n    gl_FragColor = vec4(color, 0.0, 0.0, 1.0);\n\n}\n\n";
	var boxBlurVert = "attribute vec3 aPosition;\n\nattribute vec2 aTexCoord;\n\n\n\nvarying vec2 vTexCoord;\n\n\n\nvoid main()\n\n{\n\n  gl_Position = vec4(aPosition, 1.);\n\n  vTexCoord = aTexCoord;\n\n}\n\n";
	var quadVertices$1 = new Float32Array([-1.0, 1.0, 0.0, -1.0, -1.0, 0.0, 1.0, 1.0, 0.0, 1.0, -1.0, 0.0]);
	var quadTexcoords$1 = new Float32Array([0.0, 1.0, 0.0, 0.0, 1.0, 1.0, 1.0, 0.0]);

	var QuadShader = function (_MeshShader5) {
	  _inheritsLoose(QuadShader, _MeshShader5);

	  function QuadShader() {
	    return _MeshShader5.apply(this, arguments) || this;
	  }

	  var _proto20 = QuadShader.prototype;

	  _proto20.draw = function draw(regl) {
	    if (!this._quadMesh) {
	      this._createQuadMesh(regl);
	    }

	    return _MeshShader5.prototype.draw.call(this, regl, this._quadMesh);
	  };

	  _proto20.getMeshCommand = function getMeshCommand(regl) {
	    if (!this.commands['quad']) {
	      this.commands['quad'] = this.createREGLCommand(regl, null, this._quadMesh[0].getAttributes(), null, this._quadMesh[0].getElements());
	    }

	    return this.commands['quad'];
	  };

	  _proto20._createQuadMesh = function _createQuadMesh(regl) {
	    var geometry = new Geometry({
	      aPosition: quadVertices$1,
	      aTexCoord: quadTexcoords$1
	    }, null, quadVertices$1.length / 3, {
	      primitive: 'triangle strip'
	    });
	    geometry.generateBuffers(regl);
	    this._quadMesh = [new Mesh(geometry)];
	  };

	  _proto20.dispose = function dispose() {
	    if (this._quadMesh) {
	      var mesh = this._quadMesh[0];
	      mesh.geometry.dispose();
	      mesh.dispose();
	    }

	    delete this._quadMesh;
	    return _MeshShader5.prototype.dispose.call(this);
	  };

	  return QuadShader;
	}(MeshShader);

	var BoxBlurShader = function (_QuadShader) {
	  _inheritsLoose(BoxBlurShader, _QuadShader);

	  function BoxBlurShader(_ref4) {
	    var blurOffset = _ref4.blurOffset;
	    return _QuadShader.call(this, {
	      vert: boxBlurVert,
	      frag: boxBlurFrag,
	      uniforms: ['textureSource', 'textureSize'],
	      defines: {
	        'BOXBLUR_OFFSET': blurOffset || 2
	      }
	    }) || this;
	  }

	  var _proto21 = BoxBlurShader.prototype;

	  _proto21.getMeshCommand = function getMeshCommand(regl, mesh) {
	    if (!this.commands['shadow']) {
	      this.commands['shadow'] = this.createREGLCommand(regl, null, mesh.getAttributes(), null, mesh.getElements());
	    }

	    return this.commands['shadow'];
	  };

	  return BoxBlurShader;
	}(QuadShader);

	var getFrustumWorldSpace, getDirLightCameraProjView;

	var ShadowPass = function () {
	  function ShadowPass(renderer, _ref5) {
	    var width = _ref5.width,
	        height = _ref5.height,
	        blurOffset = _ref5.blurOffset;
	    this.renderer = renderer;
	    this.width = width || 512;
	    this.height = height || 512;
	    this.blurOffset = isNil(blurOffset) ? 2 : blurOffset;

	    this._init();
	  }

	  var _proto22 = ShadowPass.prototype;

	  _proto22.render = function render(scene, _ref6) {
	    var cameraProjViewMatrix = _ref6.cameraProjViewMatrix,
	        lightDir = _ref6.lightDir,
	        farPlane = _ref6.farPlane;

	    if (!this.isSupported()) {
	      return null;
	    }

	    var lightProjViewMatrix = this._renderShadow(scene, cameraProjViewMatrix, lightDir, farPlane);

	    return {
	      lightProjViewMatrix: lightProjViewMatrix,
	      shadowMap: this.blurTex || this.depthTex,
	      depthFBO: this.depthFBO,
	      blurFBO: this.blurFBO
	    };
	  };

	  _proto22.resize = function resize(width, height) {
	    if (this.depthTex) {
	      this.depthTex.resize(width, height);
	      this.depthFBO.resize(width, height);
	    }

	    if (this.blurFBO) {
	      this.blurTex.resize(width, height);
	      this.blurFBO.resize(width, height);
	    }

	    return this;
	  };

	  _proto22.isSupported = function isSupported() {
	    return this._supported;
	  };

	  _proto22._renderShadow = function _renderShadow(scene, cameraProjViewMatrix, lightDir, farPlane) {
	    var renderer = this.renderer;

	    if (!this.vsmShader) {
	      this.vsmShader = new ShadowMapShader();
	    }

	    var frustum$$1 = getFrustumWorldSpace(cameraProjViewMatrix);

	    if (farPlane) {
	      for (var i = 4; i < 8; i++) {
	        frustum$$1[i] = farPlane[i - 4];
	      }
	    }

	    var lightProjViewMatrix = getDirLightCameraProjView(frustum$$1, lightDir);
	    renderer.clear({
	      color: [0, 0, 0, 1],
	      depth: 1,
	      framebuffer: this.depthFBO
	    });
	    renderer.render(this.vsmShader, {
	      lightProjViewMatrix: lightProjViewMatrix
	    }, scene, this.depthFBO);

	    if (this.blurFBO) {
	      if (!this.boxBlurShader) {
	        this.boxBlurShader = new BoxBlurShader({
	          blurOffset: this.blurOffset
	        });
	      }

	      renderer.clear({
	        color: [0, 0, 0, 1],
	        depth: 1,
	        framebuffer: this.blurFBO
	      });
	      renderer.render(this.boxBlurShader, {
	        textureSize: [this.depthTex.width, this.depthTex.height],
	        textureSource: this.depthTex
	      }, null, this.blurFBO);
	    }

	    return lightProjViewMatrix;
	  };

	  _proto22._init = function _init() {
	    var regl = this.renderer.regl;
	    this._supported = regl.hasExtension('oes_texture_float_linear');

	    if (!this.isSupported()) {
	      console.warn('WebGL oes_texture_float_linear extension is not supported, shadow rendering is disabled.');
	      return;
	    }

	    var width = this.width,
	        height = this.height;
	    this.depthTex = regl.texture({
	      width: width,
	      height: height,
	      format: 'rgb',
	      type: 'float',
	      min: 'linear',
	      mag: 'linear'
	    });
	    this.depthFBO = regl.framebuffer({
	      color: this.depthTex
	    });

	    if (this.blurOffset <= 0) {
	      return;
	    }

	    this.blurTex = regl.texture({
	      width: width,
	      height: height,
	      format: 'rgb',
	      type: 'float',
	      min: 'linear',
	      mag: 'linear'
	    });
	    this.blurFBO = regl.framebuffer({
	      color: this.blurTex
	    });
	  };

	  _proto22.dispose = function dispose() {
	    if (this.depthTex) {
	      this.depthTex.destroy();
	      this.depthFBO.destroy();
	      delete this.depthTex;
	      delete this.depthFBO;
	    }

	    if (this.blurTex) {
	      this.blurTex.destroy();
	      this.blurFBO.destroy();
	      delete this.blurTex;
	      delete this.blurFBO;
	    }

	    if (this.vsmShader) {
	      this.vsmShader.dispose();
	      delete this.vsmShader;
	    }

	    if (this.boxBlurShader) {
	      this.boxBlurShader.dispose();
	      delete this.boxBlurShader;
	    }
	  };

	  return ShadowPass;
	}();

	getFrustumWorldSpace = function () {
	  var clipPlanes = [[-1, -1, -1, 1], [1, -1, -1, 1], [1, 1, -1, 1], [-1, 1, -1, 1], [-1, -1, 1, 1], [1, -1, 1, 1], [1, 1, 1, 1], [-1, 1, 1, 1]];
	  var inverseProjectionMatrix = new Array(16);
	  return function (cameraProjView) {
	    invert$3(inverseProjectionMatrix, cameraProjView);
	    var frustum$$1 = [];

	    for (var i = 0; i < clipPlanes.length; i++) {
	      var projWorldSpacePosition = transformMat4$1([], clipPlanes[i], inverseProjectionMatrix);
	      scale$5(projWorldSpacePosition, projWorldSpacePosition, 1 / projWorldSpacePosition[3]);
	      frustum$$1.push(projWorldSpacePosition);
	    }

	    return frustum$$1;
	  };
	}();

	getDirLightCameraProjView = function () {
	  var transf = new Array(4);
	  var frustumCenter = [0, 0, 0, 0];
	  var cameraUp = [0, 1, 0];
	  var v3 = new Array(3);
	  var lvMatrix = new Array(16);
	  var lpMatrix = new Array(16);
	  var cropMatrix = new Array(16);
	  var scaleV = [1, 1, 1];
	  var offsetV = [0, 0, 0];
	  return function (frustum$$1, lightDir) {
	    scale$5(frustumCenter, frustumCenter, 0);

	    for (var i = 4; i < frustum$$1.length; i++) {
	      add$5(frustumCenter, frustumCenter, frustum$$1[i]);
	    }

	    scale$5(frustumCenter, frustumCenter, 1 / 4);
	    lvMatrix = lookAt(lvMatrix, add$4(v3, frustumCenter, normalize(v3, lightDir)), frustumCenter, cameraUp);
	    transformMat4$1(transf, frustum$$1[0], lvMatrix);
	    var minZ = transf[2],
	        maxZ = transf[2],
	        minX = transf[0],
	        maxX = transf[0],
	        minY = transf[1],
	        maxY = transf[1];

	    for (var _i5 = 1; _i5 < 8; _i5++) {
	      transf = transformMat4$1(transf, frustum$$1[_i5], lvMatrix);
	      if (transf[2] > maxZ) maxZ = transf[2];
	      if (transf[2] < minZ) minZ = transf[2];
	      if (transf[0] > maxX) maxX = transf[0];
	      if (transf[0] < minX) minX = transf[0];
	      if (transf[1] > maxY) maxY = transf[1];
	      if (transf[1] < minY) minY = transf[1];
	    }

	    lpMatrix = ortho(lpMatrix, -1, 1, -1, 1, -maxZ, -minZ);
	    var scaleX = scaleV[0] = 2 / (maxX - minX);
	    var scaleY = scaleV[1] = -2 / (maxY - minY);
	    offsetV[0] = -0.5 * (minX + maxX) * scaleX;
	    offsetV[1] = -0.5 * (minY + maxY) * scaleY;
	    identity$3(cropMatrix);
	    translate$2(cropMatrix, cropMatrix, offsetV);
	    scale$3(cropMatrix, cropMatrix, scaleV);
	    var projMatrix = multiply$3(lpMatrix, cropMatrix, lpMatrix);
	    return multiply$3(new Array(16), projMatrix, lvMatrix);
	  };
	}();

	var shadowDisplayFrag = "precision mediump float;\n\n\n\nuniform vec3 color;\n\n\n\n#include <vsm_shadow_frag>\n\n\n\nvoid main() {\n\n    float shadow = shadow_computeShadow();\n\n    float alpha = 1.0 - shadow;\n\n	gl_FragColor = vec4(color, alpha);\n\n}\n\n";
	var shadowDisplayVert = "attribute vec3 aPosition;\n\n\n\nuniform mat4 projViewModelMatrix;\n\n\n\nvarying vec4 vPosition;\n\n\n\n#include <vsm_shadow_vert>\n\n\n\nvoid main() {\n\n    vec4 pos = vec4(aPosition, 1.);\n\n\n\n    gl_Position = projViewModelMatrix * pos;\n\n    vPosition = gl_Position;\n\n\n\n    shadow_computeShadowPars(pos);\n\n}\n\n";

	var ShadowDisplayShader = function (_MeshShader6) {
	  _inheritsLoose(ShadowDisplayShader, _MeshShader6);

	  function ShadowDisplayShader(viewport, defines) {
	    return _MeshShader6.call(this, {
	      vert: shadowDisplayVert,
	      frag: shadowDisplayFrag,
	      uniforms: [{
	        name: 'projViewModelMatrix',
	        type: 'function',
	        fn: function fn(context, props) {
	          var projViewModelMatrix = [];
	          multiply$3(projViewModelMatrix, props['viewMatrix'], props['modelMatrix']);
	          multiply$3(projViewModelMatrix, props['projMatrix'], projViewModelMatrix);
	          return projViewModelMatrix;
	        }
	      }, 'vsm_shadow_lightProjViewModelMatrix', 'vsm_shadow_shadowMap', 'vsm_shadow_threshold', 'color', 'vsm_shadow_opacity'],
	      defines: defines || {
	        'USE_ESM': 1
	      },
	      extraCommandProps: {
	        viewport: viewport
	      }
	    }) || this;
	  }

	  var _proto23 = ShadowDisplayShader.prototype;

	  _proto23.getMeshCommand = function getMeshCommand(regl, mesh) {
	    if (!this.commands['shadow_display']) {
	      this.commands['shadow_display'] = this.createREGLCommand(regl, null, mesh.getAttributes(), null, mesh.getElements());
	    }

	    return this.commands['shadow_display'];
	  };

	  return ShadowDisplayShader;
	}(MeshShader);

	function pack3(array) {
	  return array[2] * 256 * 256 + array[1] * 256 + array[0];
	}

	var UINT8_VIEW = new Uint8Array(4);
	var FLOAT_VIEW = new Float32Array(UINT8_VIEW.buffer);

	function packDepth(array) {
	  UINT8_VIEW[0] = array[3];
	  UINT8_VIEW[1] = array[2];
	  UINT8_VIEW[2] = array[1];
	  UINT8_VIEW[3] = array[0];
	  return FLOAT_VIEW[0];
	}

	var unpackFun = "\n    vec3 unpack(highp float f) {\n        highp vec3 color;\n        color.b = floor(f / 65536.0);\n        color.g = floor((f - color.b * 65536.0) / 256.0);\n        color.r = f - floor(color.b * 65536.0) - floor(color.g * 256.0);\n        // now we have a vec3 with the 3 components in range [0..255]. Let's normalize it!\n        return color / 255.0;\n    }\n";
	var frag0 = "\n    precision highp float;\n\n    varying float vPickingId;\n    varying float vFbo_picking_visible;\n\n    uniform float fbo_picking_meshId;\n\n    " + unpackFun + "\n\n    void main() {\n        if (vFbo_picking_visible == 0.0) {\n            discard;\n            return;\n        }\n        gl_FragColor = vec4(unpack(vPickingId), fbo_picking_meshId / 255.0);\n    }\n";
	var frag1 = "\n    precision highp float;\n\n    uniform int fbo_picking_meshId;\n    varying float vFbo_picking_visible;\n\n    " + unpackFun + "\n\n    void main() {\n        if (vFbo_picking_visible == 0.0) {\n            discard;\n            return;\n        }\n        gl_FragColor = vec4(unpack(float(fbo_picking_meshId)), 1.0);\n        // gl_FragColor = vec4(unpack(float(35)), 1.0);\n    }\n";
	var frag2 = "\n    precision highp float;\n\n    varying float vPickingId;\n    varying float vFbo_picking_visible;\n\n    " + unpackFun + "\n\n    void main() {\n        if (vFbo_picking_visible == 0.0) {\n            discard;\n            return;\n        }\n        gl_FragColor = vec4(unpack(vPickingId), 1.0);\n    }\n";
	var depthFrag = "\n    #define SHADER_NAME depth\n    #define FLOAT_MAX  1.70141184e38\n    #define FLOAT_MIN  1.17549435e-38\n\n    precision highp float;\n    varying float vFbo_picking_viewZ;\n\n    lowp vec4 unpack(highp float v) {\n        highp float av = abs(v);\n\n        //Handle special cases\n        if(av < FLOAT_MIN) {\n            return vec4(0.0, 0.0, 0.0, 0.0);\n        } else if(v > FLOAT_MAX) {\n            return vec4(127.0, 128.0, 0.0, 0.0) / 255.0;\n        } else if(v < -FLOAT_MAX) {\n            return vec4(255.0, 128.0, 0.0, 0.0) / 255.0;\n        }\n\n        highp vec4 c = vec4(0,0,0,0);\n\n        //Compute exponent and mantissa\n        highp float e = floor(log2(av));\n        highp float m = av * pow(2.0, -e) - 1.0;\n\n        //Unpack mantissa\n        c[1] = floor(128.0 * m);\n        m -= c[1] / 128.0;\n        c[2] = floor(32768.0 * m);\n        m -= c[2] / 32768.0;\n        c[3] = floor(8388608.0 * m);\n\n        //Unpack exponent\n        highp float ebias = e + 127.0;\n        c[0] = floor(ebias / 2.0);\n        ebias -= c[0] * 2.0;\n        c[1] += floor(ebias) * 128.0;\n\n        //Unpack sign bit\n        c[0] += 128.0 * step(0.0, -v);\n\n        //Scale back to range\n        return c / 255.0;\n    }\n\n    void main() {\n        gl_FragColor = unpack(vFbo_picking_viewZ);\n        // gl_FragColor = unpack(34678.3456789);\n    }\n";

	var FBORayPicking = function () {
	  function FBORayPicking(renderer, _ref7, fbo) {
	    var vert = _ref7.vert,
	        uniforms = _ref7.uniforms,
	        defines = _ref7.defines,
	        extraCommandProps = _ref7.extraCommandProps;
	    this._renderer = renderer;
	    this._fbo = fbo;

	    this._clearFbo(fbo);

	    this._vert = vert;
	    this._uniforms = uniforms;
	    this._defines = defines;
	    this._extraCommandProps = extraCommandProps;
	    this._currentMeshes = [];

	    this._init();
	  }

	  var _proto24 = FBORayPicking.prototype;

	  _proto24._init = function _init() {
	    var uniforms = ['fbo_picking_meshId'];

	    if (this._uniforms) {
	      uniforms.push.apply(uniforms, this._uniforms);
	    }

	    var defines = {
	      'ENABLE_PICKING': 1,
	      'USE_PICKING_ID': 1
	    };

	    if (this._defines) {
	      for (var p in this._defines) {
	        defines[p] = this._defines[p];
	      }
	    }

	    var vert = this._vert,
	        extraCommandProps = this._extraCommandProps;
	    this._shader0 = new MeshShader({
	      vert: vert,
	      frag: frag0,
	      uniforms: uniforms,
	      defines: defines,
	      extraCommandProps: extraCommandProps
	    });
	    this._shader2 = new MeshShader({
	      vert: vert,
	      frag: frag2,
	      uniforms: uniforms,
	      defines: defines,
	      extraCommandProps: extraCommandProps
	    });
	    var defines1 = {
	      'ENABLE_PICKING': 1,
	      'USE_PICKING_ID': 1
	    };

	    if (this._defines) {
	      for (var _p2 in this._defines) {
	        defines1[_p2] = this._defines[_p2];
	      }
	    }

	    this._shader1 = new MeshShader({
	      vert: vert,
	      frag: frag1,
	      uniforms: uniforms,
	      defines: defines1,
	      extraCommandProps: extraCommandProps
	    });
	    this._depthShader = new MeshShader({
	      vert: vert,
	      frag: depthFrag,
	      uniforms: uniforms,
	      defines: defines1,
	      extraCommandProps: extraCommandProps
	    });
	    this._scene = new Scene();
	    this._scene1 = new Scene();
	  };

	  _proto24.filter = function filter() {
	    return true;
	  };

	  _proto24.render = function render(meshes, uniforms, once) {
	    var _this10 = this;

	    if (once === void 0) {
	      once = false;
	    }

	    if (!meshes || !meshes.length) {
	      return this;
	    }

	    var fbo = this._fbo;

	    if (once) {
	      this.clear();
	    }

	    this._scene.setMeshes(meshes);

	    var shader = this._getShader(meshes, once);

	    shader.filter = this.filter;

	    if (this._currentShader && shader !== this._currentShader) {
	      this.clear();
	    }

	    this._currentShader = shader;
	    meshes.forEach(function (m, idx) {
	      m.setUniform('fbo_picking_meshId', idx + _this10._currentMeshes.length);
	    });

	    for (var i = 0; i < meshes.length; i++) {
	      this._currentMeshes.push(meshes[i]);
	    }

	    this._renderer.render(shader, uniforms, this._scene, fbo);

	    return this;
	  };

	  _proto24.pick = function pick(x, y, tolerance, uniforms, options) {
	    if (options === void 0) {
	      options = {};
	    }

	    var shader = this._currentShader;
	    var meshes = this._currentMeshes;

	    if (!shader || !meshes || !meshes.length) {
	      return {
	        pickingId: null,
	        meshId: null,
	        point: null
	      };
	    }

	    x = Math.round(x);
	    y = Math.round(y);
	    var fbo = this._fbo;

	    if (x < 0 || x > fbo.width || y < 0 || y > fbo.height) {
	      return {
	        pickingId: null,
	        meshId: null,
	        point: null
	      };
	    }

	    var _this$_getParams = this._getParams(x, y, tolerance, fbo),
	        px = _this$_getParams.px,
	        py = _this$_getParams.py,
	        width = _this$_getParams.width,
	        height = _this$_getParams.height;

	    var pixels = new Uint8Array(4 * width * height);
	    var regl = this._renderer.regl;
	    var data = regl.read({
	      data: pixels,
	      x: px,
	      y: py,
	      framebuffer: fbo,
	      width: width,
	      height: height
	    });
	    var meshIds = [];
	    var pickingIds = [];

	    for (var i = 0; i < data.length; i += 4) {
	      var _this$_packData = this._packData(data.subarray(i, i + 4), shader),
	          pickingId = _this$_packData.pickingId,
	          meshId = _this$_packData.meshId;

	      meshIds.push(meshId);
	      pickingIds.push(pickingId);
	    }

	    var visited = {};
	    var pickedMeshes = meshIds.filter(function (id) {
	      if (id != null && !visited[id]) {
	        visited[id] = 1;
	        return true;
	      }

	      return false;
	    }).map(function (id) {
	      return meshes[id];
	    });

	    if (meshIds.length && shader === this._shader1 && meshes[0].geometry.data['aPickingId']) {
	      pickingIds = this._getPickingId(px, py, width, height, pixels, pickedMeshes, uniforms);
	    }

	    var points = [];

	    if (meshIds.length && options['returnPoint']) {
	      var _options = options,
	          viewMatrix = _options.viewMatrix,
	          projMatrix = _options.projMatrix;

	      var depths = this._pickDepth(px, py, width, height, pixels, pickedMeshes, uniforms);

	      for (var _i6 = 0; _i6 < depths.length; _i6++) {
	        if (depths[_i6] && meshIds[_i6] != null && pickingIds[_i6] != null) {
	          var point = this._getWorldPos(x, y, depths[_i6], viewMatrix, projMatrix);

	          points.push(point);
	        } else {
	          points.push(null);
	        }
	      }
	    }

	    var iterDists = [];

	    for (var _i7 = 0; _i7 <= tolerance; _i7++) {
	      iterDists.push(_i7);

	      if (_i7 > 0) {
	        iterDists.push(-_i7);
	      }
	    }

	    for (var _i8 = 0; _i8 < iterDists.length; _i8++) {
	      for (var j = 0; j < iterDists.length; j++) {
	        var ii = (iterDists[j] + tolerance) * width + (iterDists[_i8] + tolerance);

	        if (meshIds[ii] != null && pickingIds[ii] != null) {
	          return {
	            meshId: meshIds[ii],
	            pickingId: pickingIds[ii],
	            point: points[ii] || null
	          };
	        }
	      }
	    }

	    return {
	      pickingId: null,
	      meshId: null,
	      point: null
	    };
	  };

	  _proto24.clear = function clear() {
	    if (this._fbo) {
	      this._clearFbo(this._fbo);
	    }

	    this._currentMeshes = [];
	    delete this._currentShader;
	    return this;
	  };

	  _proto24.getMeshAt = function getMeshAt(idx) {
	    if (!this._currentMeshes) {
	      return null;
	    }

	    return this._currentMeshes[idx];
	  };

	  _proto24.getRenderedMeshes = function getRenderedMeshes() {
	    return this._currentMeshes;
	  };

	  _proto24.dispose = function dispose() {
	    this.clear();

	    if (this._shader0) {
	      this._shader0.dispose();
	    }

	    if (this._shader1) {
	      this._shader1.dispose();
	    }

	    if (this._shader2) {
	      this._shader2.dispose();
	    }

	    if (this._scene) {
	      this._scene.clear();
	    }

	    if (this._scene1) {
	      this._scene1.clear();
	    }
	  };

	  _proto24._getWorldPos = function _getWorldPos(x, y, depth, viewMatrix, projMatrix) {
	    var fbo = this._fbo;
	    var mat = [];
	    var w2 = fbo.width / 2 || 1,
	        h2 = fbo.height / 2 || 1;
	    var cp0 = [(x - w2) / w2, (h2 - y) / h2, 0, 1],
	        cp1 = [(x - w2) / w2, (h2 - y) / h2, 1, 1];
	    var inverseProjMatrix = invert$3(mat, projMatrix);
	    var vcp0 = [],
	        vcp1 = [];
	    applyMatrix(vcp0, cp0, inverseProjMatrix);
	    applyMatrix(vcp1, cp1, inverseProjMatrix);
	    var n = -vcp0[2],
	        f = -vcp1[2];
	    var t = (depth - n) / (f - n);
	    var projViewMatrix = multiply$3(mat, projMatrix, viewMatrix);
	    var inverseProjViewMatrix = invert$3(mat, projViewMatrix);
	    var near = applyMatrix(cp0, cp0, inverseProjViewMatrix),
	        far = applyMatrix(cp1, cp1, inverseProjViewMatrix);
	    return [interpolate(near[0], far[0], t), interpolate(near[1], far[1], t), interpolate(near[2], far[2], t)];
	  };

	  _proto24._getPickingId = function _getPickingId(x, y, width, height, pixels, meshes, uniforms) {
	    var regl = this._renderer.regl;

	    var fbo1 = this._getFBO1();

	    this._clearFbo(fbo1);

	    this._scene1.setMeshes(meshes);

	    this._renderer.render(this._shader2, uniforms, this._scene1, fbo1);

	    var data = regl.read({
	      data: pixels,
	      x: x,
	      y: y,
	      framebuffer: fbo1,
	      width: width,
	      height: height
	    });
	    var ids = [];

	    for (var i = 0; i < data.length; i += 4) {
	      ids.push(pack3(data.subarray(i, i + 4)));
	    }

	    return ids;
	  };

	  _proto24._pickDepth = function _pickDepth(x, y, width, height, pixels, meshes, uniforms) {
	    var regl = this._renderer.regl;

	    var fbo1 = this._getFBO1();

	    this._scene1.setMeshes(meshes);

	    this._clearFbo(fbo1);

	    this._renderer.render(this._depthShader, uniforms, this._scene1, fbo1);

	    var data = regl.read({
	      data: pixels,
	      x: x,
	      y: y,
	      framebuffer: fbo1,
	      width: width,
	      height: height
	    });
	    var depths = [];

	    for (var i = 0; i < data.length; i += 4) {
	      depths.push(packDepth(data.subarray(i, i + 4)));
	    }

	    return depths;
	  };

	  _proto24._packData = function _packData(data, shader) {
	    if (data[0] === 255 && data[1] === 255 && data[2] === 255 && data[3] === 255) {
	      return {
	        meshId: null,
	        pickingId: null
	      };
	    }

	    var pickingId = null;
	    var meshId = null;

	    if (shader === this._shader1) {
	      meshId = pack3(data);
	    } else if (shader === this._shader0) {
	      meshId = data[3];
	      pickingId = pack3(data);
	    } else {
	      meshId = null;
	      pickingId = pack3(data);
	    }

	    return {
	      meshId: meshId,
	      pickingId: pickingId
	    };
	  };

	  _proto24._clearFbo = function _clearFbo(framebuffer) {
	    this._renderer.regl.clear({
	      color: [1, 1, 1, 1],
	      depth: 1,
	      stencil: 0,
	      framebuffer: framebuffer
	    });
	  };

	  _proto24._getShader = function _getShader(meshes, once) {
	    if (once && meshes.length < 256) {
	      return this._shader0;
	    }

	    return this._shader1;
	  };

	  _proto24._getFBO1 = function _getFBO1() {
	    var regl = this._renderer.regl;
	    var fbo = this._fbo;

	    if (!this._fbo1) {
	      this._fbo1 = regl.framebuffer(fbo.width, fbo.height);
	    } else if (this._fbo1.width !== fbo.width || this._fbo1.height !== fbo.height) {
	      this._fbo1.resize(fbo.width, fbo.height);
	    }

	    return this._fbo1;
	  };

	  _proto24._getParams = function _getParams(px, py, tolerance, fbo) {
	    px -= tolerance;
	    py = fbo.height - py;
	    py -= tolerance;
	    var width = 2 * tolerance + 1;
	    var height = 2 * tolerance + 1;
	    var right = px + width;
	    var top = py + height;

	    if (right > fbo.width) {
	      width -= right - fbo.width;
	    }

	    if (top > fbo.height) {
	      height -= top - fbo.height;
	    }

	    px = px < 0 ? 0 : px;
	    py = py < 0 ? 0 : py;
	    return {
	      px: px,
	      py: py,
	      width: width,
	      height: height
	    };
	  };

	  return FBORayPicking;
	}();

	function applyMatrix(out, v, e) {
	  var x = v[0],
	      y = v[1],
	      z = v[2];
	  var w = 1 / (e[3] * x + e[7] * y + e[11] * z + e[15]);
	  out[0] = (e[0] * x + e[4] * y + e[8] * z + e[12]) * w;
	  out[1] = (e[1] * x + e[5] * y + e[9] * z + e[13]) * w;
	  out[2] = (e[2] * x + e[6] * y + e[10] * z + e[14]) * w;
	  return out;
	}

	var HDR = {
	  parseHDR: parseRGBE
	};
	var pbr = {
	  PBRHelper: PBRHelper,
	  LitShader: LitShader,
	  LitMaterial: LitMaterial,
	  ClothShader: ClothShader,
	  ClothMaterial: ClothMaterial,
	  SubsurfaceShader: ClothShader$1,
	  SubsurfaceMaterial: ClothMaterial$1
	};

	var reshadergl_es = /*#__PURE__*/Object.freeze({
		AbstractTexture: Texture,
		DeferredRenderer: DeferredRenderer,
		FBORayPicking: FBORayPicking,
		Geometry: Geometry,
		HDR: HDR,
		InstancedMesh: InstancedMesh,
		Material: Material$1,
		Mesh: Mesh,
		MeshShader: MeshShader,
		PhongMaterial: PhongMaterial,
		PhongShader: PhongShader,
		Plane: Plane,
		Renderer: Renderer,
		ResourceLoader: ResourceLoader$1,
		Scene: Scene,
		Shader: Shader,
		ShadowDisplayShader: ShadowDisplayShader,
		ShadowPass: ShadowPass,
		SkyboxHelper: SkyboxHelper,
		Texture2D: Texture2D,
		TextureCube: TextureCube,
		Util: Util,
		WireFrameMaterial: WireFrameMaterial,
		WireframeShader: WireframeShader,
		pbr: pbr
	});

	var EPSILON$1 = 0.000001;
	var ARRAY_TYPE$1 = typeof Float32Array !== 'undefined' ? Float32Array : Array;
	var RANDOM$1 = Math.random;
	function setMatrixArrayType$1(type) {
	  ARRAY_TYPE$1 = type;
	}
	var degree$1 = Math.PI / 180;
	function toRadian$1(a) {
	  return a * degree$1;
	}
	function equals$b(a, b) {
	  return Math.abs(a - b) <= EPSILON$1 * Math.max(1.0, Math.abs(a), Math.abs(b));
	}

	var common = /*#__PURE__*/Object.freeze({
		EPSILON: EPSILON$1,
		get ARRAY_TYPE () { return ARRAY_TYPE$1; },
		RANDOM: RANDOM$1,
		setMatrixArrayType: setMatrixArrayType$1,
		toRadian: toRadian$1,
		equals: equals$b
	});

	function create$a() {
	  var out = new ARRAY_TYPE$1(4);

	  if (ARRAY_TYPE$1 != Float32Array) {
	    out[1] = 0;
	    out[2] = 0;
	  }

	  out[0] = 1;
	  out[3] = 1;
	  return out;
	}
	function clone$a(a) {
	  var out = new ARRAY_TYPE$1(4);
	  out[0] = a[0];
	  out[1] = a[1];
	  out[2] = a[2];
	  out[3] = a[3];
	  return out;
	}
	function copy$a(out, a) {
	  out[0] = a[0];
	  out[1] = a[1];
	  out[2] = a[2];
	  out[3] = a[3];
	  return out;
	}
	function identity$6(out) {
	  out[0] = 1;
	  out[1] = 0;
	  out[2] = 0;
	  out[3] = 1;
	  return out;
	}
	function fromValues$a(m00, m01, m10, m11) {
	  var out = new ARRAY_TYPE$1(4);
	  out[0] = m00;
	  out[1] = m01;
	  out[2] = m10;
	  out[3] = m11;
	  return out;
	}
	function set$b(out, m00, m01, m10, m11) {
	  out[0] = m00;
	  out[1] = m01;
	  out[2] = m10;
	  out[3] = m11;
	  return out;
	}
	function transpose$3(out, a) {
	  if (out === a) {
	    var a1 = a[1];
	    out[1] = a[2];
	    out[2] = a1;
	  } else {
	    out[0] = a[0];
	    out[1] = a[2];
	    out[2] = a[1];
	    out[3] = a[3];
	  }

	  return out;
	}
	function invert$6(out, a) {
	  var a0 = a[0],
	      a1 = a[1],
	      a2 = a[2],
	      a3 = a[3];
	  var det = a0 * a3 - a2 * a1;

	  if (!det) {
	    return null;
	  }

	  det = 1.0 / det;
	  out[0] = a3 * det;
	  out[1] = -a1 * det;
	  out[2] = -a2 * det;
	  out[3] = a0 * det;
	  return out;
	}
	function adjoint$3(out, a) {
	  var a0 = a[0];
	  out[0] = a[3];
	  out[1] = -a[1];
	  out[2] = -a[2];
	  out[3] = a0;
	  return out;
	}
	function determinant$4(a) {
	  return a[0] * a[3] - a[2] * a[1];
	}
	function multiply$a(out, a, b) {
	  var a0 = a[0],
	      a1 = a[1],
	      a2 = a[2],
	      a3 = a[3];
	  var b0 = b[0],
	      b1 = b[1],
	      b2 = b[2],
	      b3 = b[3];
	  out[0] = a0 * b0 + a2 * b1;
	  out[1] = a1 * b0 + a3 * b1;
	  out[2] = a0 * b2 + a2 * b3;
	  out[3] = a1 * b2 + a3 * b3;
	  return out;
	}
	function rotate$5(out, a, rad) {
	  var a0 = a[0],
	      a1 = a[1],
	      a2 = a[2],
	      a3 = a[3];
	  var s = Math.sin(rad);
	  var c = Math.cos(rad);
	  out[0] = a0 * c + a2 * s;
	  out[1] = a1 * c + a3 * s;
	  out[2] = a0 * -s + a2 * c;
	  out[3] = a1 * -s + a3 * c;
	  return out;
	}
	function scale$a(out, a, v) {
	  var a0 = a[0],
	      a1 = a[1],
	      a2 = a[2],
	      a3 = a[3];
	  var v0 = v[0],
	      v1 = v[1];
	  out[0] = a0 * v0;
	  out[1] = a1 * v0;
	  out[2] = a2 * v1;
	  out[3] = a3 * v1;
	  return out;
	}
	function fromRotation$5(out, rad) {
	  var s = Math.sin(rad);
	  var c = Math.cos(rad);
	  out[0] = c;
	  out[1] = s;
	  out[2] = -s;
	  out[3] = c;
	  return out;
	}
	function fromScaling$4(out, v) {
	  out[0] = v[0];
	  out[1] = 0;
	  out[2] = 0;
	  out[3] = v[1];
	  return out;
	}
	function str$9(a) {
	  return 'mat2(' + a[0] + ', ' + a[1] + ', ' + a[2] + ', ' + a[3] + ')';
	}
	function frob$4(a) {
	  return Math.sqrt(Math.pow(a[0], 2) + Math.pow(a[1], 2) + Math.pow(a[2], 2) + Math.pow(a[3], 2));
	}
	function LDU$1(L, D, U, a) {
	  L[2] = a[2] / a[0];
	  U[0] = a[0];
	  U[1] = a[1];
	  U[3] = a[3] - L[2] * U[1];
	  return [L, D, U];
	}
	function add$a(out, a, b) {
	  out[0] = a[0] + b[0];
	  out[1] = a[1] + b[1];
	  out[2] = a[2] + b[2];
	  out[3] = a[3] + b[3];
	  return out;
	}
	function subtract$8(out, a, b) {
	  out[0] = a[0] - b[0];
	  out[1] = a[1] - b[1];
	  out[2] = a[2] - b[2];
	  out[3] = a[3] - b[3];
	  return out;
	}
	function exactEquals$a(a, b) {
	  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
	}
	function equals$c(a, b) {
	  var a0 = a[0],
	      a1 = a[1],
	      a2 = a[2],
	      a3 = a[3];
	  var b0 = b[0],
	      b1 = b[1],
	      b2 = b[2],
	      b3 = b[3];
	  return Math.abs(a0 - b0) <= EPSILON$1 * Math.max(1.0, Math.abs(a0), Math.abs(b0)) && Math.abs(a1 - b1) <= EPSILON$1 * Math.max(1.0, Math.abs(a1), Math.abs(b1)) && Math.abs(a2 - b2) <= EPSILON$1 * Math.max(1.0, Math.abs(a2), Math.abs(b2)) && Math.abs(a3 - b3) <= EPSILON$1 * Math.max(1.0, Math.abs(a3), Math.abs(b3));
	}
	function multiplyScalar$4(out, a, b) {
	  out[0] = a[0] * b;
	  out[1] = a[1] * b;
	  out[2] = a[2] * b;
	  out[3] = a[3] * b;
	  return out;
	}
	function multiplyScalarAndAdd$4(out, a, b, scale) {
	  out[0] = a[0] + b[0] * scale;
	  out[1] = a[1] + b[1] * scale;
	  out[2] = a[2] + b[2] * scale;
	  out[3] = a[3] + b[3] * scale;
	  return out;
	}
	var mul$a = multiply$a;
	var sub$8 = subtract$8;

	var mat2 = /*#__PURE__*/Object.freeze({
		create: create$a,
		clone: clone$a,
		copy: copy$a,
		identity: identity$6,
		fromValues: fromValues$a,
		set: set$b,
		transpose: transpose$3,
		invert: invert$6,
		adjoint: adjoint$3,
		determinant: determinant$4,
		multiply: multiply$a,
		rotate: rotate$5,
		scale: scale$a,
		fromRotation: fromRotation$5,
		fromScaling: fromScaling$4,
		str: str$9,
		frob: frob$4,
		LDU: LDU$1,
		add: add$a,
		subtract: subtract$8,
		exactEquals: exactEquals$a,
		equals: equals$c,
		multiplyScalar: multiplyScalar$4,
		multiplyScalarAndAdd: multiplyScalarAndAdd$4,
		mul: mul$a,
		sub: sub$8
	});

	function create$b() {
	  var out = new ARRAY_TYPE$1(6);

	  if (ARRAY_TYPE$1 != Float32Array) {
	    out[1] = 0;
	    out[2] = 0;
	    out[4] = 0;
	    out[5] = 0;
	  }

	  out[0] = 1;
	  out[3] = 1;
	  return out;
	}
	function clone$b(a) {
	  var out = new ARRAY_TYPE$1(6);
	  out[0] = a[0];
	  out[1] = a[1];
	  out[2] = a[2];
	  out[3] = a[3];
	  out[4] = a[4];
	  out[5] = a[5];
	  return out;
	}
	function copy$b(out, a) {
	  out[0] = a[0];
	  out[1] = a[1];
	  out[2] = a[2];
	  out[3] = a[3];
	  out[4] = a[4];
	  out[5] = a[5];
	  return out;
	}
	function identity$7(out) {
	  out[0] = 1;
	  out[1] = 0;
	  out[2] = 0;
	  out[3] = 1;
	  out[4] = 0;
	  out[5] = 0;
	  return out;
	}
	function fromValues$b(a, b, c, d, tx, ty) {
	  var out = new ARRAY_TYPE$1(6);
	  out[0] = a;
	  out[1] = b;
	  out[2] = c;
	  out[3] = d;
	  out[4] = tx;
	  out[5] = ty;
	  return out;
	}
	function set$c(out, a, b, c, d, tx, ty) {
	  out[0] = a;
	  out[1] = b;
	  out[2] = c;
	  out[3] = d;
	  out[4] = tx;
	  out[5] = ty;
	  return out;
	}
	function invert$7(out, a) {
	  var aa = a[0],
	      ab = a[1],
	      ac = a[2],
	      ad = a[3];
	  var atx = a[4],
	      aty = a[5];
	  var det = aa * ad - ab * ac;

	  if (!det) {
	    return null;
	  }

	  det = 1.0 / det;
	  out[0] = ad * det;
	  out[1] = -ab * det;
	  out[2] = -ac * det;
	  out[3] = aa * det;
	  out[4] = (ac * aty - ad * atx) * det;
	  out[5] = (ab * atx - aa * aty) * det;
	  return out;
	}
	function determinant$5(a) {
	  return a[0] * a[3] - a[1] * a[2];
	}
	function multiply$b(out, a, b) {
	  var a0 = a[0],
	      a1 = a[1],
	      a2 = a[2],
	      a3 = a[3],
	      a4 = a[4],
	      a5 = a[5];
	  var b0 = b[0],
	      b1 = b[1],
	      b2 = b[2],
	      b3 = b[3],
	      b4 = b[4],
	      b5 = b[5];
	  out[0] = a0 * b0 + a2 * b1;
	  out[1] = a1 * b0 + a3 * b1;
	  out[2] = a0 * b2 + a2 * b3;
	  out[3] = a1 * b2 + a3 * b3;
	  out[4] = a0 * b4 + a2 * b5 + a4;
	  out[5] = a1 * b4 + a3 * b5 + a5;
	  return out;
	}
	function rotate$6(out, a, rad) {
	  var a0 = a[0],
	      a1 = a[1],
	      a2 = a[2],
	      a3 = a[3],
	      a4 = a[4],
	      a5 = a[5];
	  var s = Math.sin(rad);
	  var c = Math.cos(rad);
	  out[0] = a0 * c + a2 * s;
	  out[1] = a1 * c + a3 * s;
	  out[2] = a0 * -s + a2 * c;
	  out[3] = a1 * -s + a3 * c;
	  out[4] = a4;
	  out[5] = a5;
	  return out;
	}
	function scale$b(out, a, v) {
	  var a0 = a[0],
	      a1 = a[1],
	      a2 = a[2],
	      a3 = a[3],
	      a4 = a[4],
	      a5 = a[5];
	  var v0 = v[0],
	      v1 = v[1];
	  out[0] = a0 * v0;
	  out[1] = a1 * v0;
	  out[2] = a2 * v1;
	  out[3] = a3 * v1;
	  out[4] = a4;
	  out[5] = a5;
	  return out;
	}
	function translate$4(out, a, v) {
	  var a0 = a[0],
	      a1 = a[1],
	      a2 = a[2],
	      a3 = a[3],
	      a4 = a[4],
	      a5 = a[5];
	  var v0 = v[0],
	      v1 = v[1];
	  out[0] = a0;
	  out[1] = a1;
	  out[2] = a2;
	  out[3] = a3;
	  out[4] = a0 * v0 + a2 * v1 + a4;
	  out[5] = a1 * v0 + a3 * v1 + a5;
	  return out;
	}
	function fromRotation$6(out, rad) {
	  var s = Math.sin(rad),
	      c = Math.cos(rad);
	  out[0] = c;
	  out[1] = s;
	  out[2] = -s;
	  out[3] = c;
	  out[4] = 0;
	  out[5] = 0;
	  return out;
	}
	function fromScaling$5(out, v) {
	  out[0] = v[0];
	  out[1] = 0;
	  out[2] = 0;
	  out[3] = v[1];
	  out[4] = 0;
	  out[5] = 0;
	  return out;
	}
	function fromTranslation$4(out, v) {
	  out[0] = 1;
	  out[1] = 0;
	  out[2] = 0;
	  out[3] = 1;
	  out[4] = v[0];
	  out[5] = v[1];
	  return out;
	}
	function str$a(a) {
	  return 'mat2d(' + a[0] + ', ' + a[1] + ', ' + a[2] + ', ' + a[3] + ', ' + a[4] + ', ' + a[5] + ')';
	}
	function frob$5(a) {
	  return Math.sqrt(Math.pow(a[0], 2) + Math.pow(a[1], 2) + Math.pow(a[2], 2) + Math.pow(a[3], 2) + Math.pow(a[4], 2) + Math.pow(a[5], 2) + 1);
	}
	function add$b(out, a, b) {
	  out[0] = a[0] + b[0];
	  out[1] = a[1] + b[1];
	  out[2] = a[2] + b[2];
	  out[3] = a[3] + b[3];
	  out[4] = a[4] + b[4];
	  out[5] = a[5] + b[5];
	  return out;
	}
	function subtract$9(out, a, b) {
	  out[0] = a[0] - b[0];
	  out[1] = a[1] - b[1];
	  out[2] = a[2] - b[2];
	  out[3] = a[3] - b[3];
	  out[4] = a[4] - b[4];
	  out[5] = a[5] - b[5];
	  return out;
	}
	function multiplyScalar$5(out, a, b) {
	  out[0] = a[0] * b;
	  out[1] = a[1] * b;
	  out[2] = a[2] * b;
	  out[3] = a[3] * b;
	  out[4] = a[4] * b;
	  out[5] = a[5] * b;
	  return out;
	}
	function multiplyScalarAndAdd$5(out, a, b, scale) {
	  out[0] = a[0] + b[0] * scale;
	  out[1] = a[1] + b[1] * scale;
	  out[2] = a[2] + b[2] * scale;
	  out[3] = a[3] + b[3] * scale;
	  out[4] = a[4] + b[4] * scale;
	  out[5] = a[5] + b[5] * scale;
	  return out;
	}
	function exactEquals$b(a, b) {
	  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3] && a[4] === b[4] && a[5] === b[5];
	}
	function equals$d(a, b) {
	  var a0 = a[0],
	      a1 = a[1],
	      a2 = a[2],
	      a3 = a[3],
	      a4 = a[4],
	      a5 = a[5];
	  var b0 = b[0],
	      b1 = b[1],
	      b2 = b[2],
	      b3 = b[3],
	      b4 = b[4],
	      b5 = b[5];
	  return Math.abs(a0 - b0) <= EPSILON$1 * Math.max(1.0, Math.abs(a0), Math.abs(b0)) && Math.abs(a1 - b1) <= EPSILON$1 * Math.max(1.0, Math.abs(a1), Math.abs(b1)) && Math.abs(a2 - b2) <= EPSILON$1 * Math.max(1.0, Math.abs(a2), Math.abs(b2)) && Math.abs(a3 - b3) <= EPSILON$1 * Math.max(1.0, Math.abs(a3), Math.abs(b3)) && Math.abs(a4 - b4) <= EPSILON$1 * Math.max(1.0, Math.abs(a4), Math.abs(b4)) && Math.abs(a5 - b5) <= EPSILON$1 * Math.max(1.0, Math.abs(a5), Math.abs(b5));
	}
	var mul$b = multiply$b;
	var sub$9 = subtract$9;

	var mat2d = /*#__PURE__*/Object.freeze({
		create: create$b,
		clone: clone$b,
		copy: copy$b,
		identity: identity$7,
		fromValues: fromValues$b,
		set: set$c,
		invert: invert$7,
		determinant: determinant$5,
		multiply: multiply$b,
		rotate: rotate$6,
		scale: scale$b,
		translate: translate$4,
		fromRotation: fromRotation$6,
		fromScaling: fromScaling$5,
		fromTranslation: fromTranslation$4,
		str: str$a,
		frob: frob$5,
		add: add$b,
		subtract: subtract$9,
		multiplyScalar: multiplyScalar$5,
		multiplyScalarAndAdd: multiplyScalarAndAdd$5,
		exactEquals: exactEquals$b,
		equals: equals$d,
		mul: mul$b,
		sub: sub$9
	});

	function create$c() {
	  var out = new ARRAY_TYPE$1(9);

	  if (ARRAY_TYPE$1 != Float32Array) {
	    out[1] = 0;
	    out[2] = 0;
	    out[3] = 0;
	    out[5] = 0;
	    out[6] = 0;
	    out[7] = 0;
	  }

	  out[0] = 1;
	  out[4] = 1;
	  out[8] = 1;
	  return out;
	}
	function fromMat4$2(out, a) {
	  out[0] = a[0];
	  out[1] = a[1];
	  out[2] = a[2];
	  out[3] = a[4];
	  out[4] = a[5];
	  out[5] = a[6];
	  out[6] = a[8];
	  out[7] = a[9];
	  out[8] = a[10];
	  return out;
	}
	function clone$c(a) {
	  var out = new ARRAY_TYPE$1(9);
	  out[0] = a[0];
	  out[1] = a[1];
	  out[2] = a[2];
	  out[3] = a[3];
	  out[4] = a[4];
	  out[5] = a[5];
	  out[6] = a[6];
	  out[7] = a[7];
	  out[8] = a[8];
	  return out;
	}
	function copy$c(out, a) {
	  out[0] = a[0];
	  out[1] = a[1];
	  out[2] = a[2];
	  out[3] = a[3];
	  out[4] = a[4];
	  out[5] = a[5];
	  out[6] = a[6];
	  out[7] = a[7];
	  out[8] = a[8];
	  return out;
	}
	function fromValues$c(m00, m01, m02, m10, m11, m12, m20, m21, m22) {
	  var out = new ARRAY_TYPE$1(9);
	  out[0] = m00;
	  out[1] = m01;
	  out[2] = m02;
	  out[3] = m10;
	  out[4] = m11;
	  out[5] = m12;
	  out[6] = m20;
	  out[7] = m21;
	  out[8] = m22;
	  return out;
	}
	function set$d(out, m00, m01, m02, m10, m11, m12, m20, m21, m22) {
	  out[0] = m00;
	  out[1] = m01;
	  out[2] = m02;
	  out[3] = m10;
	  out[4] = m11;
	  out[5] = m12;
	  out[6] = m20;
	  out[7] = m21;
	  out[8] = m22;
	  return out;
	}
	function identity$8(out) {
	  out[0] = 1;
	  out[1] = 0;
	  out[2] = 0;
	  out[3] = 0;
	  out[4] = 1;
	  out[5] = 0;
	  out[6] = 0;
	  out[7] = 0;
	  out[8] = 1;
	  return out;
	}
	function transpose$4(out, a) {
	  if (out === a) {
	    var a01 = a[1],
	        a02 = a[2],
	        a12 = a[5];
	    out[1] = a[3];
	    out[2] = a[6];
	    out[3] = a01;
	    out[5] = a[7];
	    out[6] = a02;
	    out[7] = a12;
	  } else {
	    out[0] = a[0];
	    out[1] = a[3];
	    out[2] = a[6];
	    out[3] = a[1];
	    out[4] = a[4];
	    out[5] = a[7];
	    out[6] = a[2];
	    out[7] = a[5];
	    out[8] = a[8];
	  }

	  return out;
	}
	function invert$8(out, a) {
	  var a00 = a[0],
	      a01 = a[1],
	      a02 = a[2];
	  var a10 = a[3],
	      a11 = a[4],
	      a12 = a[5];
	  var a20 = a[6],
	      a21 = a[7],
	      a22 = a[8];
	  var b01 = a22 * a11 - a12 * a21;
	  var b11 = -a22 * a10 + a12 * a20;
	  var b21 = a21 * a10 - a11 * a20;
	  var det = a00 * b01 + a01 * b11 + a02 * b21;

	  if (!det) {
	    return null;
	  }

	  det = 1.0 / det;
	  out[0] = b01 * det;
	  out[1] = (-a22 * a01 + a02 * a21) * det;
	  out[2] = (a12 * a01 - a02 * a11) * det;
	  out[3] = b11 * det;
	  out[4] = (a22 * a00 - a02 * a20) * det;
	  out[5] = (-a12 * a00 + a02 * a10) * det;
	  out[6] = b21 * det;
	  out[7] = (-a21 * a00 + a01 * a20) * det;
	  out[8] = (a11 * a00 - a01 * a10) * det;
	  return out;
	}
	function adjoint$4(out, a) {
	  var a00 = a[0],
	      a01 = a[1],
	      a02 = a[2];
	  var a10 = a[3],
	      a11 = a[4],
	      a12 = a[5];
	  var a20 = a[6],
	      a21 = a[7],
	      a22 = a[8];
	  out[0] = a11 * a22 - a12 * a21;
	  out[1] = a02 * a21 - a01 * a22;
	  out[2] = a01 * a12 - a02 * a11;
	  out[3] = a12 * a20 - a10 * a22;
	  out[4] = a00 * a22 - a02 * a20;
	  out[5] = a02 * a10 - a00 * a12;
	  out[6] = a10 * a21 - a11 * a20;
	  out[7] = a01 * a20 - a00 * a21;
	  out[8] = a00 * a11 - a01 * a10;
	  return out;
	}
	function determinant$6(a) {
	  var a00 = a[0],
	      a01 = a[1],
	      a02 = a[2];
	  var a10 = a[3],
	      a11 = a[4],
	      a12 = a[5];
	  var a20 = a[6],
	      a21 = a[7],
	      a22 = a[8];
	  return a00 * (a22 * a11 - a12 * a21) + a01 * (-a22 * a10 + a12 * a20) + a02 * (a21 * a10 - a11 * a20);
	}
	function multiply$c(out, a, b) {
	  var a00 = a[0],
	      a01 = a[1],
	      a02 = a[2];
	  var a10 = a[3],
	      a11 = a[4],
	      a12 = a[5];
	  var a20 = a[6],
	      a21 = a[7],
	      a22 = a[8];
	  var b00 = b[0],
	      b01 = b[1],
	      b02 = b[2];
	  var b10 = b[3],
	      b11 = b[4],
	      b12 = b[5];
	  var b20 = b[6],
	      b21 = b[7],
	      b22 = b[8];
	  out[0] = b00 * a00 + b01 * a10 + b02 * a20;
	  out[1] = b00 * a01 + b01 * a11 + b02 * a21;
	  out[2] = b00 * a02 + b01 * a12 + b02 * a22;
	  out[3] = b10 * a00 + b11 * a10 + b12 * a20;
	  out[4] = b10 * a01 + b11 * a11 + b12 * a21;
	  out[5] = b10 * a02 + b11 * a12 + b12 * a22;
	  out[6] = b20 * a00 + b21 * a10 + b22 * a20;
	  out[7] = b20 * a01 + b21 * a11 + b22 * a21;
	  out[8] = b20 * a02 + b21 * a12 + b22 * a22;
	  return out;
	}
	function translate$5(out, a, v) {
	  var a00 = a[0],
	      a01 = a[1],
	      a02 = a[2],
	      a10 = a[3],
	      a11 = a[4],
	      a12 = a[5],
	      a20 = a[6],
	      a21 = a[7],
	      a22 = a[8],
	      x = v[0],
	      y = v[1];
	  out[0] = a00;
	  out[1] = a01;
	  out[2] = a02;
	  out[3] = a10;
	  out[4] = a11;
	  out[5] = a12;
	  out[6] = x * a00 + y * a10 + a20;
	  out[7] = x * a01 + y * a11 + a21;
	  out[8] = x * a02 + y * a12 + a22;
	  return out;
	}
	function rotate$7(out, a, rad) {
	  var a00 = a[0],
	      a01 = a[1],
	      a02 = a[2],
	      a10 = a[3],
	      a11 = a[4],
	      a12 = a[5],
	      a20 = a[6],
	      a21 = a[7],
	      a22 = a[8],
	      s = Math.sin(rad),
	      c = Math.cos(rad);
	  out[0] = c * a00 + s * a10;
	  out[1] = c * a01 + s * a11;
	  out[2] = c * a02 + s * a12;
	  out[3] = c * a10 - s * a00;
	  out[4] = c * a11 - s * a01;
	  out[5] = c * a12 - s * a02;
	  out[6] = a20;
	  out[7] = a21;
	  out[8] = a22;
	  return out;
	}
	function scale$c(out, a, v) {
	  var x = v[0],
	      y = v[1];
	  out[0] = x * a[0];
	  out[1] = x * a[1];
	  out[2] = x * a[2];
	  out[3] = y * a[3];
	  out[4] = y * a[4];
	  out[5] = y * a[5];
	  out[6] = a[6];
	  out[7] = a[7];
	  out[8] = a[8];
	  return out;
	}
	function fromTranslation$5(out, v) {
	  out[0] = 1;
	  out[1] = 0;
	  out[2] = 0;
	  out[3] = 0;
	  out[4] = 1;
	  out[5] = 0;
	  out[6] = v[0];
	  out[7] = v[1];
	  out[8] = 1;
	  return out;
	}
	function fromRotation$7(out, rad) {
	  var s = Math.sin(rad),
	      c = Math.cos(rad);
	  out[0] = c;
	  out[1] = s;
	  out[2] = 0;
	  out[3] = -s;
	  out[4] = c;
	  out[5] = 0;
	  out[6] = 0;
	  out[7] = 0;
	  out[8] = 1;
	  return out;
	}
	function fromScaling$6(out, v) {
	  out[0] = v[0];
	  out[1] = 0;
	  out[2] = 0;
	  out[3] = 0;
	  out[4] = v[1];
	  out[5] = 0;
	  out[6] = 0;
	  out[7] = 0;
	  out[8] = 1;
	  return out;
	}
	function fromMat2d$1(out, a) {
	  out[0] = a[0];
	  out[1] = a[1];
	  out[2] = 0;
	  out[3] = a[2];
	  out[4] = a[3];
	  out[5] = 0;
	  out[6] = a[4];
	  out[7] = a[5];
	  out[8] = 1;
	  return out;
	}
	function fromQuat$2(out, q) {
	  var x = q[0],
	      y = q[1],
	      z = q[2],
	      w = q[3];
	  var x2 = x + x;
	  var y2 = y + y;
	  var z2 = z + z;
	  var xx = x * x2;
	  var yx = y * x2;
	  var yy = y * y2;
	  var zx = z * x2;
	  var zy = z * y2;
	  var zz = z * z2;
	  var wx = w * x2;
	  var wy = w * y2;
	  var wz = w * z2;
	  out[0] = 1 - yy - zz;
	  out[3] = yx - wz;
	  out[6] = zx + wy;
	  out[1] = yx + wz;
	  out[4] = 1 - xx - zz;
	  out[7] = zy - wx;
	  out[2] = zx - wy;
	  out[5] = zy + wx;
	  out[8] = 1 - xx - yy;
	  return out;
	}
	function normalFromMat4$1(out, a) {
	  var a00 = a[0],
	      a01 = a[1],
	      a02 = a[2],
	      a03 = a[3];
	  var a10 = a[4],
	      a11 = a[5],
	      a12 = a[6],
	      a13 = a[7];
	  var a20 = a[8],
	      a21 = a[9],
	      a22 = a[10],
	      a23 = a[11];
	  var a30 = a[12],
	      a31 = a[13],
	      a32 = a[14],
	      a33 = a[15];
	  var b00 = a00 * a11 - a01 * a10;
	  var b01 = a00 * a12 - a02 * a10;
	  var b02 = a00 * a13 - a03 * a10;
	  var b03 = a01 * a12 - a02 * a11;
	  var b04 = a01 * a13 - a03 * a11;
	  var b05 = a02 * a13 - a03 * a12;
	  var b06 = a20 * a31 - a21 * a30;
	  var b07 = a20 * a32 - a22 * a30;
	  var b08 = a20 * a33 - a23 * a30;
	  var b09 = a21 * a32 - a22 * a31;
	  var b10 = a21 * a33 - a23 * a31;
	  var b11 = a22 * a33 - a23 * a32;
	  var det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;

	  if (!det) {
	    return null;
	  }

	  det = 1.0 / det;
	  out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
	  out[1] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
	  out[2] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
	  out[3] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
	  out[4] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
	  out[5] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
	  out[6] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
	  out[7] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
	  out[8] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
	  return out;
	}
	function projection$1(out, width, height) {
	  out[0] = 2 / width;
	  out[1] = 0;
	  out[2] = 0;
	  out[3] = 0;
	  out[4] = -2 / height;
	  out[5] = 0;
	  out[6] = -1;
	  out[7] = 1;
	  out[8] = 1;
	  return out;
	}
	function str$b(a) {
	  return 'mat3(' + a[0] + ', ' + a[1] + ', ' + a[2] + ', ' + a[3] + ', ' + a[4] + ', ' + a[5] + ', ' + a[6] + ', ' + a[7] + ', ' + a[8] + ')';
	}
	function frob$6(a) {
	  return Math.sqrt(Math.pow(a[0], 2) + Math.pow(a[1], 2) + Math.pow(a[2], 2) + Math.pow(a[3], 2) + Math.pow(a[4], 2) + Math.pow(a[5], 2) + Math.pow(a[6], 2) + Math.pow(a[7], 2) + Math.pow(a[8], 2));
	}
	function add$c(out, a, b) {
	  out[0] = a[0] + b[0];
	  out[1] = a[1] + b[1];
	  out[2] = a[2] + b[2];
	  out[3] = a[3] + b[3];
	  out[4] = a[4] + b[4];
	  out[5] = a[5] + b[5];
	  out[6] = a[6] + b[6];
	  out[7] = a[7] + b[7];
	  out[8] = a[8] + b[8];
	  return out;
	}
	function subtract$a(out, a, b) {
	  out[0] = a[0] - b[0];
	  out[1] = a[1] - b[1];
	  out[2] = a[2] - b[2];
	  out[3] = a[3] - b[3];
	  out[4] = a[4] - b[4];
	  out[5] = a[5] - b[5];
	  out[6] = a[6] - b[6];
	  out[7] = a[7] - b[7];
	  out[8] = a[8] - b[8];
	  return out;
	}
	function multiplyScalar$6(out, a, b) {
	  out[0] = a[0] * b;
	  out[1] = a[1] * b;
	  out[2] = a[2] * b;
	  out[3] = a[3] * b;
	  out[4] = a[4] * b;
	  out[5] = a[5] * b;
	  out[6] = a[6] * b;
	  out[7] = a[7] * b;
	  out[8] = a[8] * b;
	  return out;
	}
	function multiplyScalarAndAdd$6(out, a, b, scale) {
	  out[0] = a[0] + b[0] * scale;
	  out[1] = a[1] + b[1] * scale;
	  out[2] = a[2] + b[2] * scale;
	  out[3] = a[3] + b[3] * scale;
	  out[4] = a[4] + b[4] * scale;
	  out[5] = a[5] + b[5] * scale;
	  out[6] = a[6] + b[6] * scale;
	  out[7] = a[7] + b[7] * scale;
	  out[8] = a[8] + b[8] * scale;
	  return out;
	}
	function exactEquals$c(a, b) {
	  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3] && a[4] === b[4] && a[5] === b[5] && a[6] === b[6] && a[7] === b[7] && a[8] === b[8];
	}
	function equals$e(a, b) {
	  var a0 = a[0],
	      a1 = a[1],
	      a2 = a[2],
	      a3 = a[3],
	      a4 = a[4],
	      a5 = a[5],
	      a6 = a[6],
	      a7 = a[7],
	      a8 = a[8];
	  var b0 = b[0],
	      b1 = b[1],
	      b2 = b[2],
	      b3 = b[3],
	      b4 = b[4],
	      b5 = b[5],
	      b6 = b[6],
	      b7 = b[7],
	      b8 = b[8];
	  return Math.abs(a0 - b0) <= EPSILON$1 * Math.max(1.0, Math.abs(a0), Math.abs(b0)) && Math.abs(a1 - b1) <= EPSILON$1 * Math.max(1.0, Math.abs(a1), Math.abs(b1)) && Math.abs(a2 - b2) <= EPSILON$1 * Math.max(1.0, Math.abs(a2), Math.abs(b2)) && Math.abs(a3 - b3) <= EPSILON$1 * Math.max(1.0, Math.abs(a3), Math.abs(b3)) && Math.abs(a4 - b4) <= EPSILON$1 * Math.max(1.0, Math.abs(a4), Math.abs(b4)) && Math.abs(a5 - b5) <= EPSILON$1 * Math.max(1.0, Math.abs(a5), Math.abs(b5)) && Math.abs(a6 - b6) <= EPSILON$1 * Math.max(1.0, Math.abs(a6), Math.abs(b6)) && Math.abs(a7 - b7) <= EPSILON$1 * Math.max(1.0, Math.abs(a7), Math.abs(b7)) && Math.abs(a8 - b8) <= EPSILON$1 * Math.max(1.0, Math.abs(a8), Math.abs(b8));
	}
	var mul$c = multiply$c;
	var sub$a = subtract$a;

	var mat3 = /*#__PURE__*/Object.freeze({
		create: create$c,
		fromMat4: fromMat4$2,
		clone: clone$c,
		copy: copy$c,
		fromValues: fromValues$c,
		set: set$d,
		identity: identity$8,
		transpose: transpose$4,
		invert: invert$8,
		adjoint: adjoint$4,
		determinant: determinant$6,
		multiply: multiply$c,
		translate: translate$5,
		rotate: rotate$7,
		scale: scale$c,
		fromTranslation: fromTranslation$5,
		fromRotation: fromRotation$7,
		fromScaling: fromScaling$6,
		fromMat2d: fromMat2d$1,
		fromQuat: fromQuat$2,
		normalFromMat4: normalFromMat4$1,
		projection: projection$1,
		str: str$b,
		frob: frob$6,
		add: add$c,
		subtract: subtract$a,
		multiplyScalar: multiplyScalar$6,
		multiplyScalarAndAdd: multiplyScalarAndAdd$6,
		exactEquals: exactEquals$c,
		equals: equals$e,
		mul: mul$c,
		sub: sub$a
	});

	function create$d() {
	  var out = new ARRAY_TYPE$1(16);

	  if (ARRAY_TYPE$1 != Float32Array) {
	    out[1] = 0;
	    out[2] = 0;
	    out[3] = 0;
	    out[4] = 0;
	    out[6] = 0;
	    out[7] = 0;
	    out[8] = 0;
	    out[9] = 0;
	    out[11] = 0;
	    out[12] = 0;
	    out[13] = 0;
	    out[14] = 0;
	  }

	  out[0] = 1;
	  out[5] = 1;
	  out[10] = 1;
	  out[15] = 1;
	  return out;
	}
	function clone$d(a) {
	  var out = new ARRAY_TYPE$1(16);
	  out[0] = a[0];
	  out[1] = a[1];
	  out[2] = a[2];
	  out[3] = a[3];
	  out[4] = a[4];
	  out[5] = a[5];
	  out[6] = a[6];
	  out[7] = a[7];
	  out[8] = a[8];
	  out[9] = a[9];
	  out[10] = a[10];
	  out[11] = a[11];
	  out[12] = a[12];
	  out[13] = a[13];
	  out[14] = a[14];
	  out[15] = a[15];
	  return out;
	}
	function copy$d(out, a) {
	  out[0] = a[0];
	  out[1] = a[1];
	  out[2] = a[2];
	  out[3] = a[3];
	  out[4] = a[4];
	  out[5] = a[5];
	  out[6] = a[6];
	  out[7] = a[7];
	  out[8] = a[8];
	  out[9] = a[9];
	  out[10] = a[10];
	  out[11] = a[11];
	  out[12] = a[12];
	  out[13] = a[13];
	  out[14] = a[14];
	  out[15] = a[15];
	  return out;
	}
	function fromValues$d(m00, m01, m02, m03, m10, m11, m12, m13, m20, m21, m22, m23, m30, m31, m32, m33) {
	  var out = new ARRAY_TYPE$1(16);
	  out[0] = m00;
	  out[1] = m01;
	  out[2] = m02;
	  out[3] = m03;
	  out[4] = m10;
	  out[5] = m11;
	  out[6] = m12;
	  out[7] = m13;
	  out[8] = m20;
	  out[9] = m21;
	  out[10] = m22;
	  out[11] = m23;
	  out[12] = m30;
	  out[13] = m31;
	  out[14] = m32;
	  out[15] = m33;
	  return out;
	}
	function set$e(out, m00, m01, m02, m03, m10, m11, m12, m13, m20, m21, m22, m23, m30, m31, m32, m33) {
	  out[0] = m00;
	  out[1] = m01;
	  out[2] = m02;
	  out[3] = m03;
	  out[4] = m10;
	  out[5] = m11;
	  out[6] = m12;
	  out[7] = m13;
	  out[8] = m20;
	  out[9] = m21;
	  out[10] = m22;
	  out[11] = m23;
	  out[12] = m30;
	  out[13] = m31;
	  out[14] = m32;
	  out[15] = m33;
	  return out;
	}
	function identity$9(out) {
	  out[0] = 1;
	  out[1] = 0;
	  out[2] = 0;
	  out[3] = 0;
	  out[4] = 0;
	  out[5] = 1;
	  out[6] = 0;
	  out[7] = 0;
	  out[8] = 0;
	  out[9] = 0;
	  out[10] = 1;
	  out[11] = 0;
	  out[12] = 0;
	  out[13] = 0;
	  out[14] = 0;
	  out[15] = 1;
	  return out;
	}
	function transpose$5(out, a) {
	  if (out === a) {
	    var a01 = a[1],
	        a02 = a[2],
	        a03 = a[3];
	    var a12 = a[6],
	        a13 = a[7];
	    var a23 = a[11];
	    out[1] = a[4];
	    out[2] = a[8];
	    out[3] = a[12];
	    out[4] = a01;
	    out[6] = a[9];
	    out[7] = a[13];
	    out[8] = a02;
	    out[9] = a12;
	    out[11] = a[14];
	    out[12] = a03;
	    out[13] = a13;
	    out[14] = a23;
	  } else {
	    out[0] = a[0];
	    out[1] = a[4];
	    out[2] = a[8];
	    out[3] = a[12];
	    out[4] = a[1];
	    out[5] = a[5];
	    out[6] = a[9];
	    out[7] = a[13];
	    out[8] = a[2];
	    out[9] = a[6];
	    out[10] = a[10];
	    out[11] = a[14];
	    out[12] = a[3];
	    out[13] = a[7];
	    out[14] = a[11];
	    out[15] = a[15];
	  }

	  return out;
	}
	function invert$9(out, a) {
	  var a00 = a[0],
	      a01 = a[1],
	      a02 = a[2],
	      a03 = a[3];
	  var a10 = a[4],
	      a11 = a[5],
	      a12 = a[6],
	      a13 = a[7];
	  var a20 = a[8],
	      a21 = a[9],
	      a22 = a[10],
	      a23 = a[11];
	  var a30 = a[12],
	      a31 = a[13],
	      a32 = a[14],
	      a33 = a[15];
	  var b00 = a00 * a11 - a01 * a10;
	  var b01 = a00 * a12 - a02 * a10;
	  var b02 = a00 * a13 - a03 * a10;
	  var b03 = a01 * a12 - a02 * a11;
	  var b04 = a01 * a13 - a03 * a11;
	  var b05 = a02 * a13 - a03 * a12;
	  var b06 = a20 * a31 - a21 * a30;
	  var b07 = a20 * a32 - a22 * a30;
	  var b08 = a20 * a33 - a23 * a30;
	  var b09 = a21 * a32 - a22 * a31;
	  var b10 = a21 * a33 - a23 * a31;
	  var b11 = a22 * a33 - a23 * a32;
	  var det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;

	  if (!det) {
	    return null;
	  }

	  det = 1.0 / det;
	  out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
	  out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
	  out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
	  out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
	  out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
	  out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
	  out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
	  out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
	  out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
	  out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
	  out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
	  out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
	  out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
	  out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
	  out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
	  out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
	  return out;
	}
	function adjoint$5(out, a) {
	  var a00 = a[0],
	      a01 = a[1],
	      a02 = a[2],
	      a03 = a[3];
	  var a10 = a[4],
	      a11 = a[5],
	      a12 = a[6],
	      a13 = a[7];
	  var a20 = a[8],
	      a21 = a[9],
	      a22 = a[10],
	      a23 = a[11];
	  var a30 = a[12],
	      a31 = a[13],
	      a32 = a[14],
	      a33 = a[15];
	  out[0] = a11 * (a22 * a33 - a23 * a32) - a21 * (a12 * a33 - a13 * a32) + a31 * (a12 * a23 - a13 * a22);
	  out[1] = -(a01 * (a22 * a33 - a23 * a32) - a21 * (a02 * a33 - a03 * a32) + a31 * (a02 * a23 - a03 * a22));
	  out[2] = a01 * (a12 * a33 - a13 * a32) - a11 * (a02 * a33 - a03 * a32) + a31 * (a02 * a13 - a03 * a12);
	  out[3] = -(a01 * (a12 * a23 - a13 * a22) - a11 * (a02 * a23 - a03 * a22) + a21 * (a02 * a13 - a03 * a12));
	  out[4] = -(a10 * (a22 * a33 - a23 * a32) - a20 * (a12 * a33 - a13 * a32) + a30 * (a12 * a23 - a13 * a22));
	  out[5] = a00 * (a22 * a33 - a23 * a32) - a20 * (a02 * a33 - a03 * a32) + a30 * (a02 * a23 - a03 * a22);
	  out[6] = -(a00 * (a12 * a33 - a13 * a32) - a10 * (a02 * a33 - a03 * a32) + a30 * (a02 * a13 - a03 * a12));
	  out[7] = a00 * (a12 * a23 - a13 * a22) - a10 * (a02 * a23 - a03 * a22) + a20 * (a02 * a13 - a03 * a12);
	  out[8] = a10 * (a21 * a33 - a23 * a31) - a20 * (a11 * a33 - a13 * a31) + a30 * (a11 * a23 - a13 * a21);
	  out[9] = -(a00 * (a21 * a33 - a23 * a31) - a20 * (a01 * a33 - a03 * a31) + a30 * (a01 * a23 - a03 * a21));
	  out[10] = a00 * (a11 * a33 - a13 * a31) - a10 * (a01 * a33 - a03 * a31) + a30 * (a01 * a13 - a03 * a11);
	  out[11] = -(a00 * (a11 * a23 - a13 * a21) - a10 * (a01 * a23 - a03 * a21) + a20 * (a01 * a13 - a03 * a11));
	  out[12] = -(a10 * (a21 * a32 - a22 * a31) - a20 * (a11 * a32 - a12 * a31) + a30 * (a11 * a22 - a12 * a21));
	  out[13] = a00 * (a21 * a32 - a22 * a31) - a20 * (a01 * a32 - a02 * a31) + a30 * (a01 * a22 - a02 * a21);
	  out[14] = -(a00 * (a11 * a32 - a12 * a31) - a10 * (a01 * a32 - a02 * a31) + a30 * (a01 * a12 - a02 * a11));
	  out[15] = a00 * (a11 * a22 - a12 * a21) - a10 * (a01 * a22 - a02 * a21) + a20 * (a01 * a12 - a02 * a11);
	  return out;
	}
	function determinant$7(a) {
	  var a00 = a[0],
	      a01 = a[1],
	      a02 = a[2],
	      a03 = a[3];
	  var a10 = a[4],
	      a11 = a[5],
	      a12 = a[6],
	      a13 = a[7];
	  var a20 = a[8],
	      a21 = a[9],
	      a22 = a[10],
	      a23 = a[11];
	  var a30 = a[12],
	      a31 = a[13],
	      a32 = a[14],
	      a33 = a[15];
	  var b00 = a00 * a11 - a01 * a10;
	  var b01 = a00 * a12 - a02 * a10;
	  var b02 = a00 * a13 - a03 * a10;
	  var b03 = a01 * a12 - a02 * a11;
	  var b04 = a01 * a13 - a03 * a11;
	  var b05 = a02 * a13 - a03 * a12;
	  var b06 = a20 * a31 - a21 * a30;
	  var b07 = a20 * a32 - a22 * a30;
	  var b08 = a20 * a33 - a23 * a30;
	  var b09 = a21 * a32 - a22 * a31;
	  var b10 = a21 * a33 - a23 * a31;
	  var b11 = a22 * a33 - a23 * a32;
	  return b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
	}
	function multiply$d(out, a, b) {
	  var a00 = a[0],
	      a01 = a[1],
	      a02 = a[2],
	      a03 = a[3];
	  var a10 = a[4],
	      a11 = a[5],
	      a12 = a[6],
	      a13 = a[7];
	  var a20 = a[8],
	      a21 = a[9],
	      a22 = a[10],
	      a23 = a[11];
	  var a30 = a[12],
	      a31 = a[13],
	      a32 = a[14],
	      a33 = a[15];
	  var b0 = b[0],
	      b1 = b[1],
	      b2 = b[2],
	      b3 = b[3];
	  out[0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
	  out[1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
	  out[2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
	  out[3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
	  b0 = b[4];
	  b1 = b[5];
	  b2 = b[6];
	  b3 = b[7];
	  out[4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
	  out[5] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
	  out[6] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
	  out[7] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
	  b0 = b[8];
	  b1 = b[9];
	  b2 = b[10];
	  b3 = b[11];
	  out[8] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
	  out[9] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
	  out[10] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
	  out[11] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
	  b0 = b[12];
	  b1 = b[13];
	  b2 = b[14];
	  b3 = b[15];
	  out[12] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
	  out[13] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
	  out[14] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
	  out[15] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
	  return out;
	}
	function translate$6(out, a, v) {
	  var x = v[0],
	      y = v[1],
	      z = v[2];
	  var a00 = void 0,
	      a01 = void 0,
	      a02 = void 0,
	      a03 = void 0;
	  var a10 = void 0,
	      a11 = void 0,
	      a12 = void 0,
	      a13 = void 0;
	  var a20 = void 0,
	      a21 = void 0,
	      a22 = void 0,
	      a23 = void 0;

	  if (a === out) {
	    out[12] = a[0] * x + a[4] * y + a[8] * z + a[12];
	    out[13] = a[1] * x + a[5] * y + a[9] * z + a[13];
	    out[14] = a[2] * x + a[6] * y + a[10] * z + a[14];
	    out[15] = a[3] * x + a[7] * y + a[11] * z + a[15];
	  } else {
	    a00 = a[0];
	    a01 = a[1];
	    a02 = a[2];
	    a03 = a[3];
	    a10 = a[4];
	    a11 = a[5];
	    a12 = a[6];
	    a13 = a[7];
	    a20 = a[8];
	    a21 = a[9];
	    a22 = a[10];
	    a23 = a[11];
	    out[0] = a00;
	    out[1] = a01;
	    out[2] = a02;
	    out[3] = a03;
	    out[4] = a10;
	    out[5] = a11;
	    out[6] = a12;
	    out[7] = a13;
	    out[8] = a20;
	    out[9] = a21;
	    out[10] = a22;
	    out[11] = a23;
	    out[12] = a00 * x + a10 * y + a20 * z + a[12];
	    out[13] = a01 * x + a11 * y + a21 * z + a[13];
	    out[14] = a02 * x + a12 * y + a22 * z + a[14];
	    out[15] = a03 * x + a13 * y + a23 * z + a[15];
	  }

	  return out;
	}
	function scale$d(out, a, v) {
	  var x = v[0],
	      y = v[1],
	      z = v[2];
	  out[0] = a[0] * x;
	  out[1] = a[1] * x;
	  out[2] = a[2] * x;
	  out[3] = a[3] * x;
	  out[4] = a[4] * y;
	  out[5] = a[5] * y;
	  out[6] = a[6] * y;
	  out[7] = a[7] * y;
	  out[8] = a[8] * z;
	  out[9] = a[9] * z;
	  out[10] = a[10] * z;
	  out[11] = a[11] * z;
	  out[12] = a[12];
	  out[13] = a[13];
	  out[14] = a[14];
	  out[15] = a[15];
	  return out;
	}
	function rotate$8(out, a, rad, axis) {
	  var x = axis[0],
	      y = axis[1],
	      z = axis[2];
	  var len = Math.sqrt(x * x + y * y + z * z);
	  var s = void 0,
	      c = void 0,
	      t = void 0;
	  var a00 = void 0,
	      a01 = void 0,
	      a02 = void 0,
	      a03 = void 0;
	  var a10 = void 0,
	      a11 = void 0,
	      a12 = void 0,
	      a13 = void 0;
	  var a20 = void 0,
	      a21 = void 0,
	      a22 = void 0,
	      a23 = void 0;
	  var b00 = void 0,
	      b01 = void 0,
	      b02 = void 0;
	  var b10 = void 0,
	      b11 = void 0,
	      b12 = void 0;
	  var b20 = void 0,
	      b21 = void 0,
	      b22 = void 0;

	  if (len < EPSILON$1) {
	    return null;
	  }

	  len = 1 / len;
	  x *= len;
	  y *= len;
	  z *= len;
	  s = Math.sin(rad);
	  c = Math.cos(rad);
	  t = 1 - c;
	  a00 = a[0];
	  a01 = a[1];
	  a02 = a[2];
	  a03 = a[3];
	  a10 = a[4];
	  a11 = a[5];
	  a12 = a[6];
	  a13 = a[7];
	  a20 = a[8];
	  a21 = a[9];
	  a22 = a[10];
	  a23 = a[11];
	  b00 = x * x * t + c;
	  b01 = y * x * t + z * s;
	  b02 = z * x * t - y * s;
	  b10 = x * y * t - z * s;
	  b11 = y * y * t + c;
	  b12 = z * y * t + x * s;
	  b20 = x * z * t + y * s;
	  b21 = y * z * t - x * s;
	  b22 = z * z * t + c;
	  out[0] = a00 * b00 + a10 * b01 + a20 * b02;
	  out[1] = a01 * b00 + a11 * b01 + a21 * b02;
	  out[2] = a02 * b00 + a12 * b01 + a22 * b02;
	  out[3] = a03 * b00 + a13 * b01 + a23 * b02;
	  out[4] = a00 * b10 + a10 * b11 + a20 * b12;
	  out[5] = a01 * b10 + a11 * b11 + a21 * b12;
	  out[6] = a02 * b10 + a12 * b11 + a22 * b12;
	  out[7] = a03 * b10 + a13 * b11 + a23 * b12;
	  out[8] = a00 * b20 + a10 * b21 + a20 * b22;
	  out[9] = a01 * b20 + a11 * b21 + a21 * b22;
	  out[10] = a02 * b20 + a12 * b21 + a22 * b22;
	  out[11] = a03 * b20 + a13 * b21 + a23 * b22;

	  if (a !== out) {
	    out[12] = a[12];
	    out[13] = a[13];
	    out[14] = a[14];
	    out[15] = a[15];
	  }

	  return out;
	}
	function rotateX$5(out, a, rad) {
	  var s = Math.sin(rad);
	  var c = Math.cos(rad);
	  var a10 = a[4];
	  var a11 = a[5];
	  var a12 = a[6];
	  var a13 = a[7];
	  var a20 = a[8];
	  var a21 = a[9];
	  var a22 = a[10];
	  var a23 = a[11];

	  if (a !== out) {
	    out[0] = a[0];
	    out[1] = a[1];
	    out[2] = a[2];
	    out[3] = a[3];
	    out[12] = a[12];
	    out[13] = a[13];
	    out[14] = a[14];
	    out[15] = a[15];
	  }

	  out[4] = a10 * c + a20 * s;
	  out[5] = a11 * c + a21 * s;
	  out[6] = a12 * c + a22 * s;
	  out[7] = a13 * c + a23 * s;
	  out[8] = a20 * c - a10 * s;
	  out[9] = a21 * c - a11 * s;
	  out[10] = a22 * c - a12 * s;
	  out[11] = a23 * c - a13 * s;
	  return out;
	}
	function rotateY$5(out, a, rad) {
	  var s = Math.sin(rad);
	  var c = Math.cos(rad);
	  var a00 = a[0];
	  var a01 = a[1];
	  var a02 = a[2];
	  var a03 = a[3];
	  var a20 = a[8];
	  var a21 = a[9];
	  var a22 = a[10];
	  var a23 = a[11];

	  if (a !== out) {
	    out[4] = a[4];
	    out[5] = a[5];
	    out[6] = a[6];
	    out[7] = a[7];
	    out[12] = a[12];
	    out[13] = a[13];
	    out[14] = a[14];
	    out[15] = a[15];
	  }

	  out[0] = a00 * c - a20 * s;
	  out[1] = a01 * c - a21 * s;
	  out[2] = a02 * c - a22 * s;
	  out[3] = a03 * c - a23 * s;
	  out[8] = a00 * s + a20 * c;
	  out[9] = a01 * s + a21 * c;
	  out[10] = a02 * s + a22 * c;
	  out[11] = a03 * s + a23 * c;
	  return out;
	}
	function rotateZ$5(out, a, rad) {
	  var s = Math.sin(rad);
	  var c = Math.cos(rad);
	  var a00 = a[0];
	  var a01 = a[1];
	  var a02 = a[2];
	  var a03 = a[3];
	  var a10 = a[4];
	  var a11 = a[5];
	  var a12 = a[6];
	  var a13 = a[7];

	  if (a !== out) {
	    out[8] = a[8];
	    out[9] = a[9];
	    out[10] = a[10];
	    out[11] = a[11];
	    out[12] = a[12];
	    out[13] = a[13];
	    out[14] = a[14];
	    out[15] = a[15];
	  }

	  out[0] = a00 * c + a10 * s;
	  out[1] = a01 * c + a11 * s;
	  out[2] = a02 * c + a12 * s;
	  out[3] = a03 * c + a13 * s;
	  out[4] = a10 * c - a00 * s;
	  out[5] = a11 * c - a01 * s;
	  out[6] = a12 * c - a02 * s;
	  out[7] = a13 * c - a03 * s;
	  return out;
	}
	function fromTranslation$6(out, v) {
	  out[0] = 1;
	  out[1] = 0;
	  out[2] = 0;
	  out[3] = 0;
	  out[4] = 0;
	  out[5] = 1;
	  out[6] = 0;
	  out[7] = 0;
	  out[8] = 0;
	  out[9] = 0;
	  out[10] = 1;
	  out[11] = 0;
	  out[12] = v[0];
	  out[13] = v[1];
	  out[14] = v[2];
	  out[15] = 1;
	  return out;
	}
	function fromScaling$7(out, v) {
	  out[0] = v[0];
	  out[1] = 0;
	  out[2] = 0;
	  out[3] = 0;
	  out[4] = 0;
	  out[5] = v[1];
	  out[6] = 0;
	  out[7] = 0;
	  out[8] = 0;
	  out[9] = 0;
	  out[10] = v[2];
	  out[11] = 0;
	  out[12] = 0;
	  out[13] = 0;
	  out[14] = 0;
	  out[15] = 1;
	  return out;
	}
	function fromRotation$8(out, rad, axis) {
	  var x = axis[0],
	      y = axis[1],
	      z = axis[2];
	  var len = Math.sqrt(x * x + y * y + z * z);
	  var s = void 0,
	      c = void 0,
	      t = void 0;

	  if (len < EPSILON$1) {
	    return null;
	  }

	  len = 1 / len;
	  x *= len;
	  y *= len;
	  z *= len;
	  s = Math.sin(rad);
	  c = Math.cos(rad);
	  t = 1 - c;
	  out[0] = x * x * t + c;
	  out[1] = y * x * t + z * s;
	  out[2] = z * x * t - y * s;
	  out[3] = 0;
	  out[4] = x * y * t - z * s;
	  out[5] = y * y * t + c;
	  out[6] = z * y * t + x * s;
	  out[7] = 0;
	  out[8] = x * z * t + y * s;
	  out[9] = y * z * t - x * s;
	  out[10] = z * z * t + c;
	  out[11] = 0;
	  out[12] = 0;
	  out[13] = 0;
	  out[14] = 0;
	  out[15] = 1;
	  return out;
	}
	function fromXRotation$1(out, rad) {
	  var s = Math.sin(rad);
	  var c = Math.cos(rad);
	  out[0] = 1;
	  out[1] = 0;
	  out[2] = 0;
	  out[3] = 0;
	  out[4] = 0;
	  out[5] = c;
	  out[6] = s;
	  out[7] = 0;
	  out[8] = 0;
	  out[9] = -s;
	  out[10] = c;
	  out[11] = 0;
	  out[12] = 0;
	  out[13] = 0;
	  out[14] = 0;
	  out[15] = 1;
	  return out;
	}
	function fromYRotation$1(out, rad) {
	  var s = Math.sin(rad);
	  var c = Math.cos(rad);
	  out[0] = c;
	  out[1] = 0;
	  out[2] = -s;
	  out[3] = 0;
	  out[4] = 0;
	  out[5] = 1;
	  out[6] = 0;
	  out[7] = 0;
	  out[8] = s;
	  out[9] = 0;
	  out[10] = c;
	  out[11] = 0;
	  out[12] = 0;
	  out[13] = 0;
	  out[14] = 0;
	  out[15] = 1;
	  return out;
	}
	function fromZRotation$1(out, rad) {
	  var s = Math.sin(rad);
	  var c = Math.cos(rad);
	  out[0] = c;
	  out[1] = s;
	  out[2] = 0;
	  out[3] = 0;
	  out[4] = -s;
	  out[5] = c;
	  out[6] = 0;
	  out[7] = 0;
	  out[8] = 0;
	  out[9] = 0;
	  out[10] = 1;
	  out[11] = 0;
	  out[12] = 0;
	  out[13] = 0;
	  out[14] = 0;
	  out[15] = 1;
	  return out;
	}
	function fromRotationTranslation$2(out, q, v) {
	  var x = q[0],
	      y = q[1],
	      z = q[2],
	      w = q[3];
	  var x2 = x + x;
	  var y2 = y + y;
	  var z2 = z + z;
	  var xx = x * x2;
	  var xy = x * y2;
	  var xz = x * z2;
	  var yy = y * y2;
	  var yz = y * z2;
	  var zz = z * z2;
	  var wx = w * x2;
	  var wy = w * y2;
	  var wz = w * z2;
	  out[0] = 1 - (yy + zz);
	  out[1] = xy + wz;
	  out[2] = xz - wy;
	  out[3] = 0;
	  out[4] = xy - wz;
	  out[5] = 1 - (xx + zz);
	  out[6] = yz + wx;
	  out[7] = 0;
	  out[8] = xz + wy;
	  out[9] = yz - wx;
	  out[10] = 1 - (xx + yy);
	  out[11] = 0;
	  out[12] = v[0];
	  out[13] = v[1];
	  out[14] = v[2];
	  out[15] = 1;
	  return out;
	}
	function fromQuat2$1(out, a) {
	  var translation = new ARRAY_TYPE$1(3);
	  var bx = -a[0],
	      by = -a[1],
	      bz = -a[2],
	      bw = a[3],
	      ax = a[4],
	      ay = a[5],
	      az = a[6],
	      aw = a[7];
	  var magnitude = bx * bx + by * by + bz * bz + bw * bw;

	  if (magnitude > 0) {
	    translation[0] = (ax * bw + aw * bx + ay * bz - az * by) * 2 / magnitude;
	    translation[1] = (ay * bw + aw * by + az * bx - ax * bz) * 2 / magnitude;
	    translation[2] = (az * bw + aw * bz + ax * by - ay * bx) * 2 / magnitude;
	  } else {
	    translation[0] = (ax * bw + aw * bx + ay * bz - az * by) * 2;
	    translation[1] = (ay * bw + aw * by + az * bx - ax * bz) * 2;
	    translation[2] = (az * bw + aw * bz + ax * by - ay * bx) * 2;
	  }

	  fromRotationTranslation$2(out, a, translation);
	  return out;
	}
	function getTranslation$2(out, mat) {
	  out[0] = mat[12];
	  out[1] = mat[13];
	  out[2] = mat[14];
	  return out;
	}
	function getScaling$1(out, mat) {
	  var m11 = mat[0];
	  var m12 = mat[1];
	  var m13 = mat[2];
	  var m21 = mat[4];
	  var m22 = mat[5];
	  var m23 = mat[6];
	  var m31 = mat[8];
	  var m32 = mat[9];
	  var m33 = mat[10];
	  out[0] = Math.sqrt(m11 * m11 + m12 * m12 + m13 * m13);
	  out[1] = Math.sqrt(m21 * m21 + m22 * m22 + m23 * m23);
	  out[2] = Math.sqrt(m31 * m31 + m32 * m32 + m33 * m33);
	  return out;
	}
	function getRotation$1(out, mat) {
	  var trace = mat[0] + mat[5] + mat[10];
	  var S = 0;

	  if (trace > 0) {
	    S = Math.sqrt(trace + 1.0) * 2;
	    out[3] = 0.25 * S;
	    out[0] = (mat[6] - mat[9]) / S;
	    out[1] = (mat[8] - mat[2]) / S;
	    out[2] = (mat[1] - mat[4]) / S;
	  } else if (mat[0] > mat[5] && mat[0] > mat[10]) {
	    S = Math.sqrt(1.0 + mat[0] - mat[5] - mat[10]) * 2;
	    out[3] = (mat[6] - mat[9]) / S;
	    out[0] = 0.25 * S;
	    out[1] = (mat[1] + mat[4]) / S;
	    out[2] = (mat[8] + mat[2]) / S;
	  } else if (mat[5] > mat[10]) {
	    S = Math.sqrt(1.0 + mat[5] - mat[0] - mat[10]) * 2;
	    out[3] = (mat[8] - mat[2]) / S;
	    out[0] = (mat[1] + mat[4]) / S;
	    out[1] = 0.25 * S;
	    out[2] = (mat[6] + mat[9]) / S;
	  } else {
	    S = Math.sqrt(1.0 + mat[10] - mat[0] - mat[5]) * 2;
	    out[3] = (mat[1] - mat[4]) / S;
	    out[0] = (mat[8] + mat[2]) / S;
	    out[1] = (mat[6] + mat[9]) / S;
	    out[2] = 0.25 * S;
	  }

	  return out;
	}
	function fromRotationTranslationScale$1(out, q, v, s) {
	  var x = q[0],
	      y = q[1],
	      z = q[2],
	      w = q[3];
	  var x2 = x + x;
	  var y2 = y + y;
	  var z2 = z + z;
	  var xx = x * x2;
	  var xy = x * y2;
	  var xz = x * z2;
	  var yy = y * y2;
	  var yz = y * z2;
	  var zz = z * z2;
	  var wx = w * x2;
	  var wy = w * y2;
	  var wz = w * z2;
	  var sx = s[0];
	  var sy = s[1];
	  var sz = s[2];
	  out[0] = (1 - (yy + zz)) * sx;
	  out[1] = (xy + wz) * sx;
	  out[2] = (xz - wy) * sx;
	  out[3] = 0;
	  out[4] = (xy - wz) * sy;
	  out[5] = (1 - (xx + zz)) * sy;
	  out[6] = (yz + wx) * sy;
	  out[7] = 0;
	  out[8] = (xz + wy) * sz;
	  out[9] = (yz - wx) * sz;
	  out[10] = (1 - (xx + yy)) * sz;
	  out[11] = 0;
	  out[12] = v[0];
	  out[13] = v[1];
	  out[14] = v[2];
	  out[15] = 1;
	  return out;
	}
	function fromRotationTranslationScaleOrigin$1(out, q, v, s, o) {
	  var x = q[0],
	      y = q[1],
	      z = q[2],
	      w = q[3];
	  var x2 = x + x;
	  var y2 = y + y;
	  var z2 = z + z;
	  var xx = x * x2;
	  var xy = x * y2;
	  var xz = x * z2;
	  var yy = y * y2;
	  var yz = y * z2;
	  var zz = z * z2;
	  var wx = w * x2;
	  var wy = w * y2;
	  var wz = w * z2;
	  var sx = s[0];
	  var sy = s[1];
	  var sz = s[2];
	  var ox = o[0];
	  var oy = o[1];
	  var oz = o[2];
	  var out0 = (1 - (yy + zz)) * sx;
	  var out1 = (xy + wz) * sx;
	  var out2 = (xz - wy) * sx;
	  var out4 = (xy - wz) * sy;
	  var out5 = (1 - (xx + zz)) * sy;
	  var out6 = (yz + wx) * sy;
	  var out8 = (xz + wy) * sz;
	  var out9 = (yz - wx) * sz;
	  var out10 = (1 - (xx + yy)) * sz;
	  out[0] = out0;
	  out[1] = out1;
	  out[2] = out2;
	  out[3] = 0;
	  out[4] = out4;
	  out[5] = out5;
	  out[6] = out6;
	  out[7] = 0;
	  out[8] = out8;
	  out[9] = out9;
	  out[10] = out10;
	  out[11] = 0;
	  out[12] = v[0] + ox - (out0 * ox + out4 * oy + out8 * oz);
	  out[13] = v[1] + oy - (out1 * ox + out5 * oy + out9 * oz);
	  out[14] = v[2] + oz - (out2 * ox + out6 * oy + out10 * oz);
	  out[15] = 1;
	  return out;
	}
	function fromQuat$3(out, q) {
	  var x = q[0],
	      y = q[1],
	      z = q[2],
	      w = q[3];
	  var x2 = x + x;
	  var y2 = y + y;
	  var z2 = z + z;
	  var xx = x * x2;
	  var yx = y * x2;
	  var yy = y * y2;
	  var zx = z * x2;
	  var zy = z * y2;
	  var zz = z * z2;
	  var wx = w * x2;
	  var wy = w * y2;
	  var wz = w * z2;
	  out[0] = 1 - yy - zz;
	  out[1] = yx + wz;
	  out[2] = zx - wy;
	  out[3] = 0;
	  out[4] = yx - wz;
	  out[5] = 1 - xx - zz;
	  out[6] = zy + wx;
	  out[7] = 0;
	  out[8] = zx + wy;
	  out[9] = zy - wx;
	  out[10] = 1 - xx - yy;
	  out[11] = 0;
	  out[12] = 0;
	  out[13] = 0;
	  out[14] = 0;
	  out[15] = 1;
	  return out;
	}
	function frustum$1(out, left, right, bottom, top, near, far) {
	  var rl = 1 / (right - left);
	  var tb = 1 / (top - bottom);
	  var nf = 1 / (near - far);
	  out[0] = near * 2 * rl;
	  out[1] = 0;
	  out[2] = 0;
	  out[3] = 0;
	  out[4] = 0;
	  out[5] = near * 2 * tb;
	  out[6] = 0;
	  out[7] = 0;
	  out[8] = (right + left) * rl;
	  out[9] = (top + bottom) * tb;
	  out[10] = (far + near) * nf;
	  out[11] = -1;
	  out[12] = 0;
	  out[13] = 0;
	  out[14] = far * near * 2 * nf;
	  out[15] = 0;
	  return out;
	}
	function perspective$1(out, fovy, aspect, near, far) {
	  var f = 1.0 / Math.tan(fovy / 2),
	      nf = void 0;
	  out[0] = f / aspect;
	  out[1] = 0;
	  out[2] = 0;
	  out[3] = 0;
	  out[4] = 0;
	  out[5] = f;
	  out[6] = 0;
	  out[7] = 0;
	  out[8] = 0;
	  out[9] = 0;
	  out[11] = -1;
	  out[12] = 0;
	  out[13] = 0;
	  out[15] = 0;

	  if (far != null && far !== Infinity) {
	    nf = 1 / (near - far);
	    out[10] = (far + near) * nf;
	    out[14] = 2 * far * near * nf;
	  } else {
	    out[10] = -1;
	    out[14] = -2 * near;
	  }

	  return out;
	}
	function perspectiveFromFieldOfView$1(out, fov, near, far) {
	  var upTan = Math.tan(fov.upDegrees * Math.PI / 180.0);
	  var downTan = Math.tan(fov.downDegrees * Math.PI / 180.0);
	  var leftTan = Math.tan(fov.leftDegrees * Math.PI / 180.0);
	  var rightTan = Math.tan(fov.rightDegrees * Math.PI / 180.0);
	  var xScale = 2.0 / (leftTan + rightTan);
	  var yScale = 2.0 / (upTan + downTan);
	  out[0] = xScale;
	  out[1] = 0.0;
	  out[2] = 0.0;
	  out[3] = 0.0;
	  out[4] = 0.0;
	  out[5] = yScale;
	  out[6] = 0.0;
	  out[7] = 0.0;
	  out[8] = -((leftTan - rightTan) * xScale * 0.5);
	  out[9] = (upTan - downTan) * yScale * 0.5;
	  out[10] = far / (near - far);
	  out[11] = -1.0;
	  out[12] = 0.0;
	  out[13] = 0.0;
	  out[14] = far * near / (near - far);
	  out[15] = 0.0;
	  return out;
	}
	function ortho$1(out, left, right, bottom, top, near, far) {
	  var lr = 1 / (left - right);
	  var bt = 1 / (bottom - top);
	  var nf = 1 / (near - far);
	  out[0] = -2 * lr;
	  out[1] = 0;
	  out[2] = 0;
	  out[3] = 0;
	  out[4] = 0;
	  out[5] = -2 * bt;
	  out[6] = 0;
	  out[7] = 0;
	  out[8] = 0;
	  out[9] = 0;
	  out[10] = 2 * nf;
	  out[11] = 0;
	  out[12] = (left + right) * lr;
	  out[13] = (top + bottom) * bt;
	  out[14] = (far + near) * nf;
	  out[15] = 1;
	  return out;
	}
	function lookAt$1(out, eye, center, up) {
	  var x0 = void 0,
	      x1 = void 0,
	      x2 = void 0,
	      y0 = void 0,
	      y1 = void 0,
	      y2 = void 0,
	      z0 = void 0,
	      z1 = void 0,
	      z2 = void 0,
	      len = void 0;
	  var eyex = eye[0];
	  var eyey = eye[1];
	  var eyez = eye[2];
	  var upx = up[0];
	  var upy = up[1];
	  var upz = up[2];
	  var centerx = center[0];
	  var centery = center[1];
	  var centerz = center[2];

	  if (Math.abs(eyex - centerx) < EPSILON$1 && Math.abs(eyey - centery) < EPSILON$1 && Math.abs(eyez - centerz) < EPSILON$1) {
	    return identity$9(out);
	  }

	  z0 = eyex - centerx;
	  z1 = eyey - centery;
	  z2 = eyez - centerz;
	  len = 1 / Math.sqrt(z0 * z0 + z1 * z1 + z2 * z2);
	  z0 *= len;
	  z1 *= len;
	  z2 *= len;
	  x0 = upy * z2 - upz * z1;
	  x1 = upz * z0 - upx * z2;
	  x2 = upx * z1 - upy * z0;
	  len = Math.sqrt(x0 * x0 + x1 * x1 + x2 * x2);

	  if (!len) {
	    x0 = 0;
	    x1 = 0;
	    x2 = 0;
	  } else {
	    len = 1 / len;
	    x0 *= len;
	    x1 *= len;
	    x2 *= len;
	  }

	  y0 = z1 * x2 - z2 * x1;
	  y1 = z2 * x0 - z0 * x2;
	  y2 = z0 * x1 - z1 * x0;
	  len = Math.sqrt(y0 * y0 + y1 * y1 + y2 * y2);

	  if (!len) {
	    y0 = 0;
	    y1 = 0;
	    y2 = 0;
	  } else {
	    len = 1 / len;
	    y0 *= len;
	    y1 *= len;
	    y2 *= len;
	  }

	  out[0] = x0;
	  out[1] = y0;
	  out[2] = z0;
	  out[3] = 0;
	  out[4] = x1;
	  out[5] = y1;
	  out[6] = z1;
	  out[7] = 0;
	  out[8] = x2;
	  out[9] = y2;
	  out[10] = z2;
	  out[11] = 0;
	  out[12] = -(x0 * eyex + x1 * eyey + x2 * eyez);
	  out[13] = -(y0 * eyex + y1 * eyey + y2 * eyez);
	  out[14] = -(z0 * eyex + z1 * eyey + z2 * eyez);
	  out[15] = 1;
	  return out;
	}
	function targetTo$1(out, eye, target, up) {
	  var eyex = eye[0],
	      eyey = eye[1],
	      eyez = eye[2],
	      upx = up[0],
	      upy = up[1],
	      upz = up[2];
	  var z0 = eyex - target[0],
	      z1 = eyey - target[1],
	      z2 = eyez - target[2];
	  var len = z0 * z0 + z1 * z1 + z2 * z2;

	  if (len > 0) {
	    len = 1 / Math.sqrt(len);
	    z0 *= len;
	    z1 *= len;
	    z2 *= len;
	  }

	  var x0 = upy * z2 - upz * z1,
	      x1 = upz * z0 - upx * z2,
	      x2 = upx * z1 - upy * z0;
	  len = x0 * x0 + x1 * x1 + x2 * x2;

	  if (len > 0) {
	    len = 1 / Math.sqrt(len);
	    x0 *= len;
	    x1 *= len;
	    x2 *= len;
	  }

	  out[0] = x0;
	  out[1] = x1;
	  out[2] = x2;
	  out[3] = 0;
	  out[4] = z1 * x2 - z2 * x1;
	  out[5] = z2 * x0 - z0 * x2;
	  out[6] = z0 * x1 - z1 * x0;
	  out[7] = 0;
	  out[8] = z0;
	  out[9] = z1;
	  out[10] = z2;
	  out[11] = 0;
	  out[12] = eyex;
	  out[13] = eyey;
	  out[14] = eyez;
	  out[15] = 1;
	  return out;
	}
	function str$c(a) {
	  return 'mat4(' + a[0] + ', ' + a[1] + ', ' + a[2] + ', ' + a[3] + ', ' + a[4] + ', ' + a[5] + ', ' + a[6] + ', ' + a[7] + ', ' + a[8] + ', ' + a[9] + ', ' + a[10] + ', ' + a[11] + ', ' + a[12] + ', ' + a[13] + ', ' + a[14] + ', ' + a[15] + ')';
	}
	function frob$7(a) {
	  return Math.sqrt(Math.pow(a[0], 2) + Math.pow(a[1], 2) + Math.pow(a[2], 2) + Math.pow(a[3], 2) + Math.pow(a[4], 2) + Math.pow(a[5], 2) + Math.pow(a[6], 2) + Math.pow(a[7], 2) + Math.pow(a[8], 2) + Math.pow(a[9], 2) + Math.pow(a[10], 2) + Math.pow(a[11], 2) + Math.pow(a[12], 2) + Math.pow(a[13], 2) + Math.pow(a[14], 2) + Math.pow(a[15], 2));
	}
	function add$d(out, a, b) {
	  out[0] = a[0] + b[0];
	  out[1] = a[1] + b[1];
	  out[2] = a[2] + b[2];
	  out[3] = a[3] + b[3];
	  out[4] = a[4] + b[4];
	  out[5] = a[5] + b[5];
	  out[6] = a[6] + b[6];
	  out[7] = a[7] + b[7];
	  out[8] = a[8] + b[8];
	  out[9] = a[9] + b[9];
	  out[10] = a[10] + b[10];
	  out[11] = a[11] + b[11];
	  out[12] = a[12] + b[12];
	  out[13] = a[13] + b[13];
	  out[14] = a[14] + b[14];
	  out[15] = a[15] + b[15];
	  return out;
	}
	function subtract$b(out, a, b) {
	  out[0] = a[0] - b[0];
	  out[1] = a[1] - b[1];
	  out[2] = a[2] - b[2];
	  out[3] = a[3] - b[3];
	  out[4] = a[4] - b[4];
	  out[5] = a[5] - b[5];
	  out[6] = a[6] - b[6];
	  out[7] = a[7] - b[7];
	  out[8] = a[8] - b[8];
	  out[9] = a[9] - b[9];
	  out[10] = a[10] - b[10];
	  out[11] = a[11] - b[11];
	  out[12] = a[12] - b[12];
	  out[13] = a[13] - b[13];
	  out[14] = a[14] - b[14];
	  out[15] = a[15] - b[15];
	  return out;
	}
	function multiplyScalar$7(out, a, b) {
	  out[0] = a[0] * b;
	  out[1] = a[1] * b;
	  out[2] = a[2] * b;
	  out[3] = a[3] * b;
	  out[4] = a[4] * b;
	  out[5] = a[5] * b;
	  out[6] = a[6] * b;
	  out[7] = a[7] * b;
	  out[8] = a[8] * b;
	  out[9] = a[9] * b;
	  out[10] = a[10] * b;
	  out[11] = a[11] * b;
	  out[12] = a[12] * b;
	  out[13] = a[13] * b;
	  out[14] = a[14] * b;
	  out[15] = a[15] * b;
	  return out;
	}
	function multiplyScalarAndAdd$7(out, a, b, scale) {
	  out[0] = a[0] + b[0] * scale;
	  out[1] = a[1] + b[1] * scale;
	  out[2] = a[2] + b[2] * scale;
	  out[3] = a[3] + b[3] * scale;
	  out[4] = a[4] + b[4] * scale;
	  out[5] = a[5] + b[5] * scale;
	  out[6] = a[6] + b[6] * scale;
	  out[7] = a[7] + b[7] * scale;
	  out[8] = a[8] + b[8] * scale;
	  out[9] = a[9] + b[9] * scale;
	  out[10] = a[10] + b[10] * scale;
	  out[11] = a[11] + b[11] * scale;
	  out[12] = a[12] + b[12] * scale;
	  out[13] = a[13] + b[13] * scale;
	  out[14] = a[14] + b[14] * scale;
	  out[15] = a[15] + b[15] * scale;
	  return out;
	}
	function exactEquals$d(a, b) {
	  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3] && a[4] === b[4] && a[5] === b[5] && a[6] === b[6] && a[7] === b[7] && a[8] === b[8] && a[9] === b[9] && a[10] === b[10] && a[11] === b[11] && a[12] === b[12] && a[13] === b[13] && a[14] === b[14] && a[15] === b[15];
	}
	function equals$f(a, b) {
	  var a0 = a[0],
	      a1 = a[1],
	      a2 = a[2],
	      a3 = a[3];
	  var a4 = a[4],
	      a5 = a[5],
	      a6 = a[6],
	      a7 = a[7];
	  var a8 = a[8],
	      a9 = a[9],
	      a10 = a[10],
	      a11 = a[11];
	  var a12 = a[12],
	      a13 = a[13],
	      a14 = a[14],
	      a15 = a[15];
	  var b0 = b[0],
	      b1 = b[1],
	      b2 = b[2],
	      b3 = b[3];
	  var b4 = b[4],
	      b5 = b[5],
	      b6 = b[6],
	      b7 = b[7];
	  var b8 = b[8],
	      b9 = b[9],
	      b10 = b[10],
	      b11 = b[11];
	  var b12 = b[12],
	      b13 = b[13],
	      b14 = b[14],
	      b15 = b[15];
	  return Math.abs(a0 - b0) <= EPSILON$1 * Math.max(1.0, Math.abs(a0), Math.abs(b0)) && Math.abs(a1 - b1) <= EPSILON$1 * Math.max(1.0, Math.abs(a1), Math.abs(b1)) && Math.abs(a2 - b2) <= EPSILON$1 * Math.max(1.0, Math.abs(a2), Math.abs(b2)) && Math.abs(a3 - b3) <= EPSILON$1 * Math.max(1.0, Math.abs(a3), Math.abs(b3)) && Math.abs(a4 - b4) <= EPSILON$1 * Math.max(1.0, Math.abs(a4), Math.abs(b4)) && Math.abs(a5 - b5) <= EPSILON$1 * Math.max(1.0, Math.abs(a5), Math.abs(b5)) && Math.abs(a6 - b6) <= EPSILON$1 * Math.max(1.0, Math.abs(a6), Math.abs(b6)) && Math.abs(a7 - b7) <= EPSILON$1 * Math.max(1.0, Math.abs(a7), Math.abs(b7)) && Math.abs(a8 - b8) <= EPSILON$1 * Math.max(1.0, Math.abs(a8), Math.abs(b8)) && Math.abs(a9 - b9) <= EPSILON$1 * Math.max(1.0, Math.abs(a9), Math.abs(b9)) && Math.abs(a10 - b10) <= EPSILON$1 * Math.max(1.0, Math.abs(a10), Math.abs(b10)) && Math.abs(a11 - b11) <= EPSILON$1 * Math.max(1.0, Math.abs(a11), Math.abs(b11)) && Math.abs(a12 - b12) <= EPSILON$1 * Math.max(1.0, Math.abs(a12), Math.abs(b12)) && Math.abs(a13 - b13) <= EPSILON$1 * Math.max(1.0, Math.abs(a13), Math.abs(b13)) && Math.abs(a14 - b14) <= EPSILON$1 * Math.max(1.0, Math.abs(a14), Math.abs(b14)) && Math.abs(a15 - b15) <= EPSILON$1 * Math.max(1.0, Math.abs(a15), Math.abs(b15));
	}
	var mul$d = multiply$d;
	var sub$b = subtract$b;

	var mat4 = /*#__PURE__*/Object.freeze({
		create: create$d,
		clone: clone$d,
		copy: copy$d,
		fromValues: fromValues$d,
		set: set$e,
		identity: identity$9,
		transpose: transpose$5,
		invert: invert$9,
		adjoint: adjoint$5,
		determinant: determinant$7,
		multiply: multiply$d,
		translate: translate$6,
		scale: scale$d,
		rotate: rotate$8,
		rotateX: rotateX$5,
		rotateY: rotateY$5,
		rotateZ: rotateZ$5,
		fromTranslation: fromTranslation$6,
		fromScaling: fromScaling$7,
		fromRotation: fromRotation$8,
		fromXRotation: fromXRotation$1,
		fromYRotation: fromYRotation$1,
		fromZRotation: fromZRotation$1,
		fromRotationTranslation: fromRotationTranslation$2,
		fromQuat2: fromQuat2$1,
		getTranslation: getTranslation$2,
		getScaling: getScaling$1,
		getRotation: getRotation$1,
		fromRotationTranslationScale: fromRotationTranslationScale$1,
		fromRotationTranslationScaleOrigin: fromRotationTranslationScaleOrigin$1,
		fromQuat: fromQuat$3,
		frustum: frustum$1,
		perspective: perspective$1,
		perspectiveFromFieldOfView: perspectiveFromFieldOfView$1,
		ortho: ortho$1,
		lookAt: lookAt$1,
		targetTo: targetTo$1,
		str: str$c,
		frob: frob$7,
		add: add$d,
		subtract: subtract$b,
		multiplyScalar: multiplyScalar$7,
		multiplyScalarAndAdd: multiplyScalarAndAdd$7,
		exactEquals: exactEquals$d,
		equals: equals$f,
		mul: mul$d,
		sub: sub$b
	});

	function create$e() {
	  var out = new ARRAY_TYPE$1(3);

	  if (ARRAY_TYPE$1 != Float32Array) {
	    out[0] = 0;
	    out[1] = 0;
	    out[2] = 0;
	  }

	  return out;
	}
	function clone$e(a) {
	  var out = new ARRAY_TYPE$1(3);
	  out[0] = a[0];
	  out[1] = a[1];
	  out[2] = a[2];
	  return out;
	}
	function length$6(a) {
	  var x = a[0];
	  var y = a[1];
	  var z = a[2];
	  return Math.sqrt(x * x + y * y + z * z);
	}
	function fromValues$e(x, y, z) {
	  var out = new ARRAY_TYPE$1(3);
	  out[0] = x;
	  out[1] = y;
	  out[2] = z;
	  return out;
	}
	function copy$e(out, a) {
	  out[0] = a[0];
	  out[1] = a[1];
	  out[2] = a[2];
	  return out;
	}
	function set$f(out, x, y, z) {
	  out[0] = x;
	  out[1] = y;
	  out[2] = z;
	  return out;
	}
	function add$e(out, a, b) {
	  out[0] = a[0] + b[0];
	  out[1] = a[1] + b[1];
	  out[2] = a[2] + b[2];
	  return out;
	}
	function subtract$c(out, a, b) {
	  out[0] = a[0] - b[0];
	  out[1] = a[1] - b[1];
	  out[2] = a[2] - b[2];
	  return out;
	}
	function multiply$e(out, a, b) {
	  out[0] = a[0] * b[0];
	  out[1] = a[1] * b[1];
	  out[2] = a[2] * b[2];
	  return out;
	}
	function divide$4(out, a, b) {
	  out[0] = a[0] / b[0];
	  out[1] = a[1] / b[1];
	  out[2] = a[2] / b[2];
	  return out;
	}
	function ceil$4(out, a) {
	  out[0] = Math.ceil(a[0]);
	  out[1] = Math.ceil(a[1]);
	  out[2] = Math.ceil(a[2]);
	  return out;
	}
	function floor$4(out, a) {
	  out[0] = Math.floor(a[0]);
	  out[1] = Math.floor(a[1]);
	  out[2] = Math.floor(a[2]);
	  return out;
	}
	function min$4(out, a, b) {
	  out[0] = Math.min(a[0], b[0]);
	  out[1] = Math.min(a[1], b[1]);
	  out[2] = Math.min(a[2], b[2]);
	  return out;
	}
	function max$4(out, a, b) {
	  out[0] = Math.max(a[0], b[0]);
	  out[1] = Math.max(a[1], b[1]);
	  out[2] = Math.max(a[2], b[2]);
	  return out;
	}
	function round$4(out, a) {
	  out[0] = Math.round(a[0]);
	  out[1] = Math.round(a[1]);
	  out[2] = Math.round(a[2]);
	  return out;
	}
	function scale$e(out, a, b) {
	  out[0] = a[0] * b;
	  out[1] = a[1] * b;
	  out[2] = a[2] * b;
	  return out;
	}
	function scaleAndAdd$4(out, a, b, scale) {
	  out[0] = a[0] + b[0] * scale;
	  out[1] = a[1] + b[1] * scale;
	  out[2] = a[2] + b[2] * scale;
	  return out;
	}
	function distance$4(a, b) {
	  var x = b[0] - a[0];
	  var y = b[1] - a[1];
	  var z = b[2] - a[2];
	  return Math.sqrt(x * x + y * y + z * z);
	}
	function squaredDistance$4(a, b) {
	  var x = b[0] - a[0];
	  var y = b[1] - a[1];
	  var z = b[2] - a[2];
	  return x * x + y * y + z * z;
	}
	function squaredLength$6(a) {
	  var x = a[0];
	  var y = a[1];
	  var z = a[2];
	  return x * x + y * y + z * z;
	}
	function negate$4(out, a) {
	  out[0] = -a[0];
	  out[1] = -a[1];
	  out[2] = -a[2];
	  return out;
	}
	function inverse$4(out, a) {
	  out[0] = 1.0 / a[0];
	  out[1] = 1.0 / a[1];
	  out[2] = 1.0 / a[2];
	  return out;
	}
	function normalize$6(out, a) {
	  var x = a[0];
	  var y = a[1];
	  var z = a[2];
	  var len = x * x + y * y + z * z;

	  if (len > 0) {
	    len = 1 / Math.sqrt(len);
	    out[0] = a[0] * len;
	    out[1] = a[1] * len;
	    out[2] = a[2] * len;
	  }

	  return out;
	}
	function dot$6(a, b) {
	  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
	}
	function cross$3(out, a, b) {
	  var ax = a[0],
	      ay = a[1],
	      az = a[2];
	  var bx = b[0],
	      by = b[1],
	      bz = b[2];
	  out[0] = ay * bz - az * by;
	  out[1] = az * bx - ax * bz;
	  out[2] = ax * by - ay * bx;
	  return out;
	}
	function lerp$6(out, a, b, t) {
	  var ax = a[0];
	  var ay = a[1];
	  var az = a[2];
	  out[0] = ax + t * (b[0] - ax);
	  out[1] = ay + t * (b[1] - ay);
	  out[2] = az + t * (b[2] - az);
	  return out;
	}
	function hermite$1(out, a, b, c, d, t) {
	  var factorTimes2 = t * t;
	  var factor1 = factorTimes2 * (2 * t - 3) + 1;
	  var factor2 = factorTimes2 * (t - 2) + t;
	  var factor3 = factorTimes2 * (t - 1);
	  var factor4 = factorTimes2 * (3 - 2 * t);
	  out[0] = a[0] * factor1 + b[0] * factor2 + c[0] * factor3 + d[0] * factor4;
	  out[1] = a[1] * factor1 + b[1] * factor2 + c[1] * factor3 + d[1] * factor4;
	  out[2] = a[2] * factor1 + b[2] * factor2 + c[2] * factor3 + d[2] * factor4;
	  return out;
	}
	function bezier$1(out, a, b, c, d, t) {
	  var inverseFactor = 1 - t;
	  var inverseFactorTimesTwo = inverseFactor * inverseFactor;
	  var factorTimes2 = t * t;
	  var factor1 = inverseFactorTimesTwo * inverseFactor;
	  var factor2 = 3 * t * inverseFactorTimesTwo;
	  var factor3 = 3 * factorTimes2 * inverseFactor;
	  var factor4 = factorTimes2 * t;
	  out[0] = a[0] * factor1 + b[0] * factor2 + c[0] * factor3 + d[0] * factor4;
	  out[1] = a[1] * factor1 + b[1] * factor2 + c[1] * factor3 + d[1] * factor4;
	  out[2] = a[2] * factor1 + b[2] * factor2 + c[2] * factor3 + d[2] * factor4;
	  return out;
	}
	function random$5(out, scale) {
	  scale = scale || 1.0;
	  var r = RANDOM$1() * 2.0 * Math.PI;
	  var z = RANDOM$1() * 2.0 - 1.0;
	  var zScale = Math.sqrt(1.0 - z * z) * scale;
	  out[0] = Math.cos(r) * zScale;
	  out[1] = Math.sin(r) * zScale;
	  out[2] = z * scale;
	  return out;
	}
	function transformMat4$4(out, a, m) {
	  var x = a[0],
	      y = a[1],
	      z = a[2];
	  var w = m[3] * x + m[7] * y + m[11] * z + m[15];
	  w = w || 1.0;
	  out[0] = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
	  out[1] = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
	  out[2] = (m[2] * x + m[6] * y + m[10] * z + m[14]) / w;
	  return out;
	}
	function transformMat3$3(out, a, m) {
	  var x = a[0],
	      y = a[1],
	      z = a[2];
	  out[0] = x * m[0] + y * m[3] + z * m[6];
	  out[1] = x * m[1] + y * m[4] + z * m[7];
	  out[2] = x * m[2] + y * m[5] + z * m[8];
	  return out;
	}
	function transformQuat$3(out, a, q) {
	  var qx = q[0],
	      qy = q[1],
	      qz = q[2],
	      qw = q[3];
	  var x = a[0],
	      y = a[1],
	      z = a[2];
	  var uvx = qy * z - qz * y,
	      uvy = qz * x - qx * z,
	      uvz = qx * y - qy * x;
	  var uuvx = qy * uvz - qz * uvy,
	      uuvy = qz * uvx - qx * uvz,
	      uuvz = qx * uvy - qy * uvx;
	  var w2 = qw * 2;
	  uvx *= w2;
	  uvy *= w2;
	  uvz *= w2;
	  uuvx *= 2;
	  uuvy *= 2;
	  uuvz *= 2;
	  out[0] = x + uvx + uuvx;
	  out[1] = y + uvy + uuvy;
	  out[2] = z + uvz + uuvz;
	  return out;
	}
	function rotateX$6(out, a, b, c) {
	  var p = [],
	      r = [];
	  p[0] = a[0] - b[0];
	  p[1] = a[1] - b[1];
	  p[2] = a[2] - b[2];
	  r[0] = p[0];
	  r[1] = p[1] * Math.cos(c) - p[2] * Math.sin(c);
	  r[2] = p[1] * Math.sin(c) + p[2] * Math.cos(c);
	  out[0] = r[0] + b[0];
	  out[1] = r[1] + b[1];
	  out[2] = r[2] + b[2];
	  return out;
	}
	function rotateY$6(out, a, b, c) {
	  var p = [],
	      r = [];
	  p[0] = a[0] - b[0];
	  p[1] = a[1] - b[1];
	  p[2] = a[2] - b[2];
	  r[0] = p[2] * Math.sin(c) + p[0] * Math.cos(c);
	  r[1] = p[1];
	  r[2] = p[2] * Math.cos(c) - p[0] * Math.sin(c);
	  out[0] = r[0] + b[0];
	  out[1] = r[1] + b[1];
	  out[2] = r[2] + b[2];
	  return out;
	}
	function rotateZ$6(out, a, b, c) {
	  var p = [],
	      r = [];
	  p[0] = a[0] - b[0];
	  p[1] = a[1] - b[1];
	  p[2] = a[2] - b[2];
	  r[0] = p[0] * Math.cos(c) - p[1] * Math.sin(c);
	  r[1] = p[0] * Math.sin(c) + p[1] * Math.cos(c);
	  r[2] = p[2];
	  out[0] = r[0] + b[0];
	  out[1] = r[1] + b[1];
	  out[2] = r[2] + b[2];
	  return out;
	}
	function angle$3(a, b) {
	  var tempA = fromValues$e(a[0], a[1], a[2]);
	  var tempB = fromValues$e(b[0], b[1], b[2]);
	  normalize$6(tempA, tempA);
	  normalize$6(tempB, tempB);
	  var cosine = dot$6(tempA, tempB);

	  if (cosine > 1.0) {
	    return 0;
	  } else if (cosine < -1.0) {
	    return Math.PI;
	  } else {
	    return Math.acos(cosine);
	  }
	}
	function str$d(a) {
	  return 'vec3(' + a[0] + ', ' + a[1] + ', ' + a[2] + ')';
	}
	function exactEquals$e(a, b) {
	  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
	}
	function equals$g(a, b) {
	  var a0 = a[0],
	      a1 = a[1],
	      a2 = a[2];
	  var b0 = b[0],
	      b1 = b[1],
	      b2 = b[2];
	  return Math.abs(a0 - b0) <= EPSILON$1 * Math.max(1.0, Math.abs(a0), Math.abs(b0)) && Math.abs(a1 - b1) <= EPSILON$1 * Math.max(1.0, Math.abs(a1), Math.abs(b1)) && Math.abs(a2 - b2) <= EPSILON$1 * Math.max(1.0, Math.abs(a2), Math.abs(b2));
	}
	var sub$c = subtract$c;
	var mul$e = multiply$e;
	var div$4 = divide$4;
	var dist$4 = distance$4;
	var sqrDist$4 = squaredDistance$4;
	var len$6 = length$6;
	var sqrLen$6 = squaredLength$6;
	var forEach$4 = function () {
	  var vec = create$e();
	  return function (a, stride, offset, count, fn, arg) {
	    var i = void 0,
	        l = void 0;

	    if (!stride) {
	      stride = 3;
	    }

	    if (!offset) {
	      offset = 0;
	    }

	    if (count) {
	      l = Math.min(count * stride + offset, a.length);
	    } else {
	      l = a.length;
	    }

	    for (i = offset; i < l; i += stride) {
	      vec[0] = a[i];
	      vec[1] = a[i + 1];
	      vec[2] = a[i + 2];
	      fn(vec, vec, arg);
	      a[i] = vec[0];
	      a[i + 1] = vec[1];
	      a[i + 2] = vec[2];
	    }

	    return a;
	  };
	}();

	var vec3 = /*#__PURE__*/Object.freeze({
		create: create$e,
		clone: clone$e,
		length: length$6,
		fromValues: fromValues$e,
		copy: copy$e,
		set: set$f,
		add: add$e,
		subtract: subtract$c,
		multiply: multiply$e,
		divide: divide$4,
		ceil: ceil$4,
		floor: floor$4,
		min: min$4,
		max: max$4,
		round: round$4,
		scale: scale$e,
		scaleAndAdd: scaleAndAdd$4,
		distance: distance$4,
		squaredDistance: squaredDistance$4,
		squaredLength: squaredLength$6,
		negate: negate$4,
		inverse: inverse$4,
		normalize: normalize$6,
		dot: dot$6,
		cross: cross$3,
		lerp: lerp$6,
		hermite: hermite$1,
		bezier: bezier$1,
		random: random$5,
		transformMat4: transformMat4$4,
		transformMat3: transformMat3$3,
		transformQuat: transformQuat$3,
		rotateX: rotateX$6,
		rotateY: rotateY$6,
		rotateZ: rotateZ$6,
		angle: angle$3,
		str: str$d,
		exactEquals: exactEquals$e,
		equals: equals$g,
		sub: sub$c,
		mul: mul$e,
		div: div$4,
		dist: dist$4,
		sqrDist: sqrDist$4,
		len: len$6,
		sqrLen: sqrLen$6,
		forEach: forEach$4
	});

	function create$f() {
	  var out = new ARRAY_TYPE$1(4);

	  if (ARRAY_TYPE$1 != Float32Array) {
	    out[0] = 0;
	    out[1] = 0;
	    out[2] = 0;
	    out[3] = 0;
	  }

	  return out;
	}
	function clone$f(a) {
	  var out = new ARRAY_TYPE$1(4);
	  out[0] = a[0];
	  out[1] = a[1];
	  out[2] = a[2];
	  out[3] = a[3];
	  return out;
	}
	function fromValues$f(x, y, z, w) {
	  var out = new ARRAY_TYPE$1(4);
	  out[0] = x;
	  out[1] = y;
	  out[2] = z;
	  out[3] = w;
	  return out;
	}
	function copy$f(out, a) {
	  out[0] = a[0];
	  out[1] = a[1];
	  out[2] = a[2];
	  out[3] = a[3];
	  return out;
	}
	function set$g(out, x, y, z, w) {
	  out[0] = x;
	  out[1] = y;
	  out[2] = z;
	  out[3] = w;
	  return out;
	}
	function add$f(out, a, b) {
	  out[0] = a[0] + b[0];
	  out[1] = a[1] + b[1];
	  out[2] = a[2] + b[2];
	  out[3] = a[3] + b[3];
	  return out;
	}
	function subtract$d(out, a, b) {
	  out[0] = a[0] - b[0];
	  out[1] = a[1] - b[1];
	  out[2] = a[2] - b[2];
	  out[3] = a[3] - b[3];
	  return out;
	}
	function multiply$f(out, a, b) {
	  out[0] = a[0] * b[0];
	  out[1] = a[1] * b[1];
	  out[2] = a[2] * b[2];
	  out[3] = a[3] * b[3];
	  return out;
	}
	function divide$5(out, a, b) {
	  out[0] = a[0] / b[0];
	  out[1] = a[1] / b[1];
	  out[2] = a[2] / b[2];
	  out[3] = a[3] / b[3];
	  return out;
	}
	function ceil$5(out, a) {
	  out[0] = Math.ceil(a[0]);
	  out[1] = Math.ceil(a[1]);
	  out[2] = Math.ceil(a[2]);
	  out[3] = Math.ceil(a[3]);
	  return out;
	}
	function floor$5(out, a) {
	  out[0] = Math.floor(a[0]);
	  out[1] = Math.floor(a[1]);
	  out[2] = Math.floor(a[2]);
	  out[3] = Math.floor(a[3]);
	  return out;
	}
	function min$5(out, a, b) {
	  out[0] = Math.min(a[0], b[0]);
	  out[1] = Math.min(a[1], b[1]);
	  out[2] = Math.min(a[2], b[2]);
	  out[3] = Math.min(a[3], b[3]);
	  return out;
	}
	function max$5(out, a, b) {
	  out[0] = Math.max(a[0], b[0]);
	  out[1] = Math.max(a[1], b[1]);
	  out[2] = Math.max(a[2], b[2]);
	  out[3] = Math.max(a[3], b[3]);
	  return out;
	}
	function round$5(out, a) {
	  out[0] = Math.round(a[0]);
	  out[1] = Math.round(a[1]);
	  out[2] = Math.round(a[2]);
	  out[3] = Math.round(a[3]);
	  return out;
	}
	function scale$f(out, a, b) {
	  out[0] = a[0] * b;
	  out[1] = a[1] * b;
	  out[2] = a[2] * b;
	  out[3] = a[3] * b;
	  return out;
	}
	function scaleAndAdd$5(out, a, b, scale) {
	  out[0] = a[0] + b[0] * scale;
	  out[1] = a[1] + b[1] * scale;
	  out[2] = a[2] + b[2] * scale;
	  out[3] = a[3] + b[3] * scale;
	  return out;
	}
	function distance$5(a, b) {
	  var x = b[0] - a[0];
	  var y = b[1] - a[1];
	  var z = b[2] - a[2];
	  var w = b[3] - a[3];
	  return Math.sqrt(x * x + y * y + z * z + w * w);
	}
	function squaredDistance$5(a, b) {
	  var x = b[0] - a[0];
	  var y = b[1] - a[1];
	  var z = b[2] - a[2];
	  var w = b[3] - a[3];
	  return x * x + y * y + z * z + w * w;
	}
	function length$7(a) {
	  var x = a[0];
	  var y = a[1];
	  var z = a[2];
	  var w = a[3];
	  return Math.sqrt(x * x + y * y + z * z + w * w);
	}
	function squaredLength$7(a) {
	  var x = a[0];
	  var y = a[1];
	  var z = a[2];
	  var w = a[3];
	  return x * x + y * y + z * z + w * w;
	}
	function negate$5(out, a) {
	  out[0] = -a[0];
	  out[1] = -a[1];
	  out[2] = -a[2];
	  out[3] = -a[3];
	  return out;
	}
	function inverse$5(out, a) {
	  out[0] = 1.0 / a[0];
	  out[1] = 1.0 / a[1];
	  out[2] = 1.0 / a[2];
	  out[3] = 1.0 / a[3];
	  return out;
	}
	function normalize$7(out, a) {
	  var x = a[0];
	  var y = a[1];
	  var z = a[2];
	  var w = a[3];
	  var len = x * x + y * y + z * z + w * w;

	  if (len > 0) {
	    len = 1 / Math.sqrt(len);
	    out[0] = x * len;
	    out[1] = y * len;
	    out[2] = z * len;
	    out[3] = w * len;
	  }

	  return out;
	}
	function dot$7(a, b) {
	  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
	}
	function lerp$7(out, a, b, t) {
	  var ax = a[0];
	  var ay = a[1];
	  var az = a[2];
	  var aw = a[3];
	  out[0] = ax + t * (b[0] - ax);
	  out[1] = ay + t * (b[1] - ay);
	  out[2] = az + t * (b[2] - az);
	  out[3] = aw + t * (b[3] - aw);
	  return out;
	}
	function random$6(out, scale) {
	  scale = scale || 1.0;
	  var v1, v2, v3, v4;
	  var s1, s2;

	  do {
	    v1 = RANDOM$1() * 2 - 1;
	    v2 = RANDOM$1() * 2 - 1;
	    s1 = v1 * v1 + v2 * v2;
	  } while (s1 >= 1);

	  do {
	    v3 = RANDOM$1() * 2 - 1;
	    v4 = RANDOM$1() * 2 - 1;
	    s2 = v3 * v3 + v4 * v4;
	  } while (s2 >= 1);

	  var d = Math.sqrt((1 - s1) / s2);
	  out[0] = scale * v1;
	  out[1] = scale * v2;
	  out[2] = scale * v3 * d;
	  out[3] = scale * v4 * d;
	  return out;
	}
	function transformMat4$5(out, a, m) {
	  var x = a[0],
	      y = a[1],
	      z = a[2],
	      w = a[3];
	  out[0] = m[0] * x + m[4] * y + m[8] * z + m[12] * w;
	  out[1] = m[1] * x + m[5] * y + m[9] * z + m[13] * w;
	  out[2] = m[2] * x + m[6] * y + m[10] * z + m[14] * w;
	  out[3] = m[3] * x + m[7] * y + m[11] * z + m[15] * w;
	  return out;
	}
	function transformQuat$4(out, a, q) {
	  var x = a[0],
	      y = a[1],
	      z = a[2];
	  var qx = q[0],
	      qy = q[1],
	      qz = q[2],
	      qw = q[3];
	  var ix = qw * x + qy * z - qz * y;
	  var iy = qw * y + qz * x - qx * z;
	  var iz = qw * z + qx * y - qy * x;
	  var iw = -qx * x - qy * y - qz * z;
	  out[0] = ix * qw + iw * -qx + iy * -qz - iz * -qy;
	  out[1] = iy * qw + iw * -qy + iz * -qx - ix * -qz;
	  out[2] = iz * qw + iw * -qz + ix * -qy - iy * -qx;
	  out[3] = a[3];
	  return out;
	}
	function str$e(a) {
	  return 'vec4(' + a[0] + ', ' + a[1] + ', ' + a[2] + ', ' + a[3] + ')';
	}
	function exactEquals$f(a, b) {
	  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
	}
	function equals$h(a, b) {
	  var a0 = a[0],
	      a1 = a[1],
	      a2 = a[2],
	      a3 = a[3];
	  var b0 = b[0],
	      b1 = b[1],
	      b2 = b[2],
	      b3 = b[3];
	  return Math.abs(a0 - b0) <= EPSILON$1 * Math.max(1.0, Math.abs(a0), Math.abs(b0)) && Math.abs(a1 - b1) <= EPSILON$1 * Math.max(1.0, Math.abs(a1), Math.abs(b1)) && Math.abs(a2 - b2) <= EPSILON$1 * Math.max(1.0, Math.abs(a2), Math.abs(b2)) && Math.abs(a3 - b3) <= EPSILON$1 * Math.max(1.0, Math.abs(a3), Math.abs(b3));
	}
	var sub$d = subtract$d;
	var mul$f = multiply$f;
	var div$5 = divide$5;
	var dist$5 = distance$5;
	var sqrDist$5 = squaredDistance$5;
	var len$7 = length$7;
	var sqrLen$7 = squaredLength$7;
	var forEach$5 = function () {
	  var vec = create$f();
	  return function (a, stride, offset, count, fn, arg) {
	    var i = void 0,
	        l = void 0;

	    if (!stride) {
	      stride = 4;
	    }

	    if (!offset) {
	      offset = 0;
	    }

	    if (count) {
	      l = Math.min(count * stride + offset, a.length);
	    } else {
	      l = a.length;
	    }

	    for (i = offset; i < l; i += stride) {
	      vec[0] = a[i];
	      vec[1] = a[i + 1];
	      vec[2] = a[i + 2];
	      vec[3] = a[i + 3];
	      fn(vec, vec, arg);
	      a[i] = vec[0];
	      a[i + 1] = vec[1];
	      a[i + 2] = vec[2];
	      a[i + 3] = vec[3];
	    }

	    return a;
	  };
	}();

	var vec4 = /*#__PURE__*/Object.freeze({
		create: create$f,
		clone: clone$f,
		fromValues: fromValues$f,
		copy: copy$f,
		set: set$g,
		add: add$f,
		subtract: subtract$d,
		multiply: multiply$f,
		divide: divide$5,
		ceil: ceil$5,
		floor: floor$5,
		min: min$5,
		max: max$5,
		round: round$5,
		scale: scale$f,
		scaleAndAdd: scaleAndAdd$5,
		distance: distance$5,
		squaredDistance: squaredDistance$5,
		length: length$7,
		squaredLength: squaredLength$7,
		negate: negate$5,
		inverse: inverse$5,
		normalize: normalize$7,
		dot: dot$7,
		lerp: lerp$7,
		random: random$6,
		transformMat4: transformMat4$5,
		transformQuat: transformQuat$4,
		str: str$e,
		exactEquals: exactEquals$f,
		equals: equals$h,
		sub: sub$d,
		mul: mul$f,
		div: div$5,
		dist: dist$5,
		sqrDist: sqrDist$5,
		len: len$7,
		sqrLen: sqrLen$7,
		forEach: forEach$5
	});

	function create$g() {
	  var out = new ARRAY_TYPE$1(4);

	  if (ARRAY_TYPE$1 != Float32Array) {
	    out[0] = 0;
	    out[1] = 0;
	    out[2] = 0;
	  }

	  out[3] = 1;
	  return out;
	}
	function identity$a(out) {
	  out[0] = 0;
	  out[1] = 0;
	  out[2] = 0;
	  out[3] = 1;
	  return out;
	}
	function setAxisAngle$1(out, axis, rad) {
	  rad = rad * 0.5;
	  var s = Math.sin(rad);
	  out[0] = s * axis[0];
	  out[1] = s * axis[1];
	  out[2] = s * axis[2];
	  out[3] = Math.cos(rad);
	  return out;
	}
	function getAxisAngle$1(out_axis, q) {
	  var rad = Math.acos(q[3]) * 2.0;
	  var s = Math.sin(rad / 2.0);

	  if (s > EPSILON$1) {
	    out_axis[0] = q[0] / s;
	    out_axis[1] = q[1] / s;
	    out_axis[2] = q[2] / s;
	  } else {
	    out_axis[0] = 1;
	    out_axis[1] = 0;
	    out_axis[2] = 0;
	  }

	  return rad;
	}
	function multiply$g(out, a, b) {
	  var ax = a[0],
	      ay = a[1],
	      az = a[2],
	      aw = a[3];
	  var bx = b[0],
	      by = b[1],
	      bz = b[2],
	      bw = b[3];
	  out[0] = ax * bw + aw * bx + ay * bz - az * by;
	  out[1] = ay * bw + aw * by + az * bx - ax * bz;
	  out[2] = az * bw + aw * bz + ax * by - ay * bx;
	  out[3] = aw * bw - ax * bx - ay * by - az * bz;
	  return out;
	}
	function rotateX$7(out, a, rad) {
	  rad *= 0.5;
	  var ax = a[0],
	      ay = a[1],
	      az = a[2],
	      aw = a[3];
	  var bx = Math.sin(rad),
	      bw = Math.cos(rad);
	  out[0] = ax * bw + aw * bx;
	  out[1] = ay * bw + az * bx;
	  out[2] = az * bw - ay * bx;
	  out[3] = aw * bw - ax * bx;
	  return out;
	}
	function rotateY$7(out, a, rad) {
	  rad *= 0.5;
	  var ax = a[0],
	      ay = a[1],
	      az = a[2],
	      aw = a[3];
	  var by = Math.sin(rad),
	      bw = Math.cos(rad);
	  out[0] = ax * bw - az * by;
	  out[1] = ay * bw + aw * by;
	  out[2] = az * bw + ax * by;
	  out[3] = aw * bw - ay * by;
	  return out;
	}
	function rotateZ$7(out, a, rad) {
	  rad *= 0.5;
	  var ax = a[0],
	      ay = a[1],
	      az = a[2],
	      aw = a[3];
	  var bz = Math.sin(rad),
	      bw = Math.cos(rad);
	  out[0] = ax * bw + ay * bz;
	  out[1] = ay * bw - ax * bz;
	  out[2] = az * bw + aw * bz;
	  out[3] = aw * bw - az * bz;
	  return out;
	}
	function calculateW$1(out, a) {
	  var x = a[0],
	      y = a[1],
	      z = a[2];
	  out[0] = x;
	  out[1] = y;
	  out[2] = z;
	  out[3] = Math.sqrt(Math.abs(1.0 - x * x - y * y - z * z));
	  return out;
	}
	function slerp$1(out, a, b, t) {
	  var ax = a[0],
	      ay = a[1],
	      az = a[2],
	      aw = a[3];
	  var bx = b[0],
	      by = b[1],
	      bz = b[2],
	      bw = b[3];
	  var omega = void 0,
	      cosom = void 0,
	      sinom = void 0,
	      scale0 = void 0,
	      scale1 = void 0;
	  cosom = ax * bx + ay * by + az * bz + aw * bw;

	  if (cosom < 0.0) {
	    cosom = -cosom;
	    bx = -bx;
	    by = -by;
	    bz = -bz;
	    bw = -bw;
	  }

	  if (1.0 - cosom > EPSILON$1) {
	    omega = Math.acos(cosom);
	    sinom = Math.sin(omega);
	    scale0 = Math.sin((1.0 - t) * omega) / sinom;
	    scale1 = Math.sin(t * omega) / sinom;
	  } else {
	    scale0 = 1.0 - t;
	    scale1 = t;
	  }

	  out[0] = scale0 * ax + scale1 * bx;
	  out[1] = scale0 * ay + scale1 * by;
	  out[2] = scale0 * az + scale1 * bz;
	  out[3] = scale0 * aw + scale1 * bw;
	  return out;
	}
	function random$7(out) {
	  var u1 = RANDOM$1();
	  var u2 = RANDOM$1();
	  var u3 = RANDOM$1();
	  var sqrt1MinusU1 = Math.sqrt(1 - u1);
	  var sqrtU1 = Math.sqrt(u1);
	  out[0] = sqrt1MinusU1 * Math.sin(2.0 * Math.PI * u2);
	  out[1] = sqrt1MinusU1 * Math.cos(2.0 * Math.PI * u2);
	  out[2] = sqrtU1 * Math.sin(2.0 * Math.PI * u3);
	  out[3] = sqrtU1 * Math.cos(2.0 * Math.PI * u3);
	  return out;
	}
	function invert$a(out, a) {
	  var a0 = a[0],
	      a1 = a[1],
	      a2 = a[2],
	      a3 = a[3];
	  var dot = a0 * a0 + a1 * a1 + a2 * a2 + a3 * a3;
	  var invDot = dot ? 1.0 / dot : 0;
	  out[0] = -a0 * invDot;
	  out[1] = -a1 * invDot;
	  out[2] = -a2 * invDot;
	  out[3] = a3 * invDot;
	  return out;
	}
	function conjugate$2(out, a) {
	  out[0] = -a[0];
	  out[1] = -a[1];
	  out[2] = -a[2];
	  out[3] = a[3];
	  return out;
	}
	function fromMat3$1(out, m) {
	  var fTrace = m[0] + m[4] + m[8];
	  var fRoot = void 0;

	  if (fTrace > 0.0) {
	    fRoot = Math.sqrt(fTrace + 1.0);
	    out[3] = 0.5 * fRoot;
	    fRoot = 0.5 / fRoot;
	    out[0] = (m[5] - m[7]) * fRoot;
	    out[1] = (m[6] - m[2]) * fRoot;
	    out[2] = (m[1] - m[3]) * fRoot;
	  } else {
	    var i = 0;
	    if (m[4] > m[0]) i = 1;
	    if (m[8] > m[i * 3 + i]) i = 2;
	    var j = (i + 1) % 3;
	    var k = (i + 2) % 3;
	    fRoot = Math.sqrt(m[i * 3 + i] - m[j * 3 + j] - m[k * 3 + k] + 1.0);
	    out[i] = 0.5 * fRoot;
	    fRoot = 0.5 / fRoot;
	    out[3] = (m[j * 3 + k] - m[k * 3 + j]) * fRoot;
	    out[j] = (m[j * 3 + i] + m[i * 3 + j]) * fRoot;
	    out[k] = (m[k * 3 + i] + m[i * 3 + k]) * fRoot;
	  }

	  return out;
	}
	function fromEuler$1(out, x, y, z) {
	  var halfToRad = 0.5 * Math.PI / 180.0;
	  x *= halfToRad;
	  y *= halfToRad;
	  z *= halfToRad;
	  var sx = Math.sin(x);
	  var cx = Math.cos(x);
	  var sy = Math.sin(y);
	  var cy = Math.cos(y);
	  var sz = Math.sin(z);
	  var cz = Math.cos(z);
	  out[0] = sx * cy * cz - cx * sy * sz;
	  out[1] = cx * sy * cz + sx * cy * sz;
	  out[2] = cx * cy * sz - sx * sy * cz;
	  out[3] = cx * cy * cz + sx * sy * sz;
	  return out;
	}
	function str$f(a) {
	  return 'quat(' + a[0] + ', ' + a[1] + ', ' + a[2] + ', ' + a[3] + ')';
	}
	var clone$g = clone$f;
	var fromValues$g = fromValues$f;
	var copy$g = copy$f;
	var set$h = set$g;
	var add$g = add$f;
	var mul$g = multiply$g;
	var scale$g = scale$f;
	var dot$8 = dot$7;
	var lerp$8 = lerp$7;
	var length$8 = length$7;
	var len$8 = length$8;
	var squaredLength$8 = squaredLength$7;
	var sqrLen$8 = squaredLength$8;
	var normalize$8 = normalize$7;
	var exactEquals$g = exactEquals$f;
	var equals$i = equals$h;
	var rotationTo$1 = function () {
	  var tmpvec3 = create$e();
	  var xUnitVec3 = fromValues$e(1, 0, 0);
	  var yUnitVec3 = fromValues$e(0, 1, 0);
	  return function (out, a, b) {
	    var dot = dot$6(a, b);

	    if (dot < -0.999999) {
	      cross$3(tmpvec3, xUnitVec3, a);
	      if (len$6(tmpvec3) < 0.000001) cross$3(tmpvec3, yUnitVec3, a);
	      normalize$6(tmpvec3, tmpvec3);
	      setAxisAngle$1(out, tmpvec3, Math.PI);
	      return out;
	    } else if (dot > 0.999999) {
	      out[0] = 0;
	      out[1] = 0;
	      out[2] = 0;
	      out[3] = 1;
	      return out;
	    } else {
	      cross$3(tmpvec3, a, b);
	      out[0] = tmpvec3[0];
	      out[1] = tmpvec3[1];
	      out[2] = tmpvec3[2];
	      out[3] = 1 + dot;
	      return normalize$8(out, out);
	    }
	  };
	}();
	var sqlerp$1 = function () {
	  var temp1 = create$g();
	  var temp2 = create$g();
	  return function (out, a, b, c, d, t) {
	    slerp$1(temp1, a, d, t);
	    slerp$1(temp2, b, c, t);
	    slerp$1(out, temp1, temp2, 2 * t * (1 - t));
	    return out;
	  };
	}();
	var setAxes$1 = function () {
	  var matr = create$c();
	  return function (out, view, right, up) {
	    matr[0] = right[0];
	    matr[3] = right[1];
	    matr[6] = right[2];
	    matr[1] = up[0];
	    matr[4] = up[1];
	    matr[7] = up[2];
	    matr[2] = -view[0];
	    matr[5] = -view[1];
	    matr[8] = -view[2];
	    return normalize$8(out, fromMat3$1(out, matr));
	  };
	}();

	var quat = /*#__PURE__*/Object.freeze({
		create: create$g,
		identity: identity$a,
		setAxisAngle: setAxisAngle$1,
		getAxisAngle: getAxisAngle$1,
		multiply: multiply$g,
		rotateX: rotateX$7,
		rotateY: rotateY$7,
		rotateZ: rotateZ$7,
		calculateW: calculateW$1,
		slerp: slerp$1,
		random: random$7,
		invert: invert$a,
		conjugate: conjugate$2,
		fromMat3: fromMat3$1,
		fromEuler: fromEuler$1,
		str: str$f,
		clone: clone$g,
		fromValues: fromValues$g,
		copy: copy$g,
		set: set$h,
		add: add$g,
		mul: mul$g,
		scale: scale$g,
		dot: dot$8,
		lerp: lerp$8,
		length: length$8,
		len: len$8,
		squaredLength: squaredLength$8,
		sqrLen: sqrLen$8,
		normalize: normalize$8,
		exactEquals: exactEquals$g,
		equals: equals$i,
		rotationTo: rotationTo$1,
		sqlerp: sqlerp$1,
		setAxes: setAxes$1
	});

	function create$h() {
	  var dq = new ARRAY_TYPE$1(8);

	  if (ARRAY_TYPE$1 != Float32Array) {
	    dq[0] = 0;
	    dq[1] = 0;
	    dq[2] = 0;
	    dq[4] = 0;
	    dq[5] = 0;
	    dq[6] = 0;
	    dq[7] = 0;
	  }

	  dq[3] = 1;
	  return dq;
	}
	function clone$h(a) {
	  var dq = new ARRAY_TYPE$1(8);
	  dq[0] = a[0];
	  dq[1] = a[1];
	  dq[2] = a[2];
	  dq[3] = a[3];
	  dq[4] = a[4];
	  dq[5] = a[5];
	  dq[6] = a[6];
	  dq[7] = a[7];
	  return dq;
	}
	function fromValues$h(x1, y1, z1, w1, x2, y2, z2, w2) {
	  var dq = new ARRAY_TYPE$1(8);
	  dq[0] = x1;
	  dq[1] = y1;
	  dq[2] = z1;
	  dq[3] = w1;
	  dq[4] = x2;
	  dq[5] = y2;
	  dq[6] = z2;
	  dq[7] = w2;
	  return dq;
	}
	function fromRotationTranslationValues$1(x1, y1, z1, w1, x2, y2, z2) {
	  var dq = new ARRAY_TYPE$1(8);
	  dq[0] = x1;
	  dq[1] = y1;
	  dq[2] = z1;
	  dq[3] = w1;
	  var ax = x2 * 0.5,
	      ay = y2 * 0.5,
	      az = z2 * 0.5;
	  dq[4] = ax * w1 + ay * z1 - az * y1;
	  dq[5] = ay * w1 + az * x1 - ax * z1;
	  dq[6] = az * w1 + ax * y1 - ay * x1;
	  dq[7] = -ax * x1 - ay * y1 - az * z1;
	  return dq;
	}
	function fromRotationTranslation$3(out, q, t) {
	  var ax = t[0] * 0.5,
	      ay = t[1] * 0.5,
	      az = t[2] * 0.5,
	      bx = q[0],
	      by = q[1],
	      bz = q[2],
	      bw = q[3];
	  out[0] = bx;
	  out[1] = by;
	  out[2] = bz;
	  out[3] = bw;
	  out[4] = ax * bw + ay * bz - az * by;
	  out[5] = ay * bw + az * bx - ax * bz;
	  out[6] = az * bw + ax * by - ay * bx;
	  out[7] = -ax * bx - ay * by - az * bz;
	  return out;
	}
	function fromTranslation$7(out, t) {
	  out[0] = 0;
	  out[1] = 0;
	  out[2] = 0;
	  out[3] = 1;
	  out[4] = t[0] * 0.5;
	  out[5] = t[1] * 0.5;
	  out[6] = t[2] * 0.5;
	  out[7] = 0;
	  return out;
	}
	function fromRotation$9(out, q) {
	  out[0] = q[0];
	  out[1] = q[1];
	  out[2] = q[2];
	  out[3] = q[3];
	  out[4] = 0;
	  out[5] = 0;
	  out[6] = 0;
	  out[7] = 0;
	  return out;
	}
	function fromMat4$3(out, a) {
	  var outer = create$g();
	  getRotation$1(outer, a);
	  var t = new ARRAY_TYPE$1(3);
	  getTranslation$2(t, a);
	  fromRotationTranslation$3(out, outer, t);
	  return out;
	}
	function copy$h(out, a) {
	  out[0] = a[0];
	  out[1] = a[1];
	  out[2] = a[2];
	  out[3] = a[3];
	  out[4] = a[4];
	  out[5] = a[5];
	  out[6] = a[6];
	  out[7] = a[7];
	  return out;
	}
	function identity$b(out) {
	  out[0] = 0;
	  out[1] = 0;
	  out[2] = 0;
	  out[3] = 1;
	  out[4] = 0;
	  out[5] = 0;
	  out[6] = 0;
	  out[7] = 0;
	  return out;
	}
	function set$i(out, x1, y1, z1, w1, x2, y2, z2, w2) {
	  out[0] = x1;
	  out[1] = y1;
	  out[2] = z1;
	  out[3] = w1;
	  out[4] = x2;
	  out[5] = y2;
	  out[6] = z2;
	  out[7] = w2;
	  return out;
	}
	var getReal$1 = copy$g;
	function getDual$1(out, a) {
	  out[0] = a[4];
	  out[1] = a[5];
	  out[2] = a[6];
	  out[3] = a[7];
	  return out;
	}
	var setReal$1 = copy$g;
	function setDual$1(out, q) {
	  out[4] = q[0];
	  out[5] = q[1];
	  out[6] = q[2];
	  out[7] = q[3];
	  return out;
	}
	function getTranslation$3(out, a) {
	  var ax = a[4],
	      ay = a[5],
	      az = a[6],
	      aw = a[7],
	      bx = -a[0],
	      by = -a[1],
	      bz = -a[2],
	      bw = a[3];
	  out[0] = (ax * bw + aw * bx + ay * bz - az * by) * 2;
	  out[1] = (ay * bw + aw * by + az * bx - ax * bz) * 2;
	  out[2] = (az * bw + aw * bz + ax * by - ay * bx) * 2;
	  return out;
	}
	function translate$7(out, a, v) {
	  var ax1 = a[0],
	      ay1 = a[1],
	      az1 = a[2],
	      aw1 = a[3],
	      bx1 = v[0] * 0.5,
	      by1 = v[1] * 0.5,
	      bz1 = v[2] * 0.5,
	      ax2 = a[4],
	      ay2 = a[5],
	      az2 = a[6],
	      aw2 = a[7];
	  out[0] = ax1;
	  out[1] = ay1;
	  out[2] = az1;
	  out[3] = aw1;
	  out[4] = aw1 * bx1 + ay1 * bz1 - az1 * by1 + ax2;
	  out[5] = aw1 * by1 + az1 * bx1 - ax1 * bz1 + ay2;
	  out[6] = aw1 * bz1 + ax1 * by1 - ay1 * bx1 + az2;
	  out[7] = -ax1 * bx1 - ay1 * by1 - az1 * bz1 + aw2;
	  return out;
	}
	function rotateX$8(out, a, rad) {
	  var bx = -a[0],
	      by = -a[1],
	      bz = -a[2],
	      bw = a[3],
	      ax = a[4],
	      ay = a[5],
	      az = a[6],
	      aw = a[7],
	      ax1 = ax * bw + aw * bx + ay * bz - az * by,
	      ay1 = ay * bw + aw * by + az * bx - ax * bz,
	      az1 = az * bw + aw * bz + ax * by - ay * bx,
	      aw1 = aw * bw - ax * bx - ay * by - az * bz;
	  rotateX$7(out, a, rad);
	  bx = out[0];
	  by = out[1];
	  bz = out[2];
	  bw = out[3];
	  out[4] = ax1 * bw + aw1 * bx + ay1 * bz - az1 * by;
	  out[5] = ay1 * bw + aw1 * by + az1 * bx - ax1 * bz;
	  out[6] = az1 * bw + aw1 * bz + ax1 * by - ay1 * bx;
	  out[7] = aw1 * bw - ax1 * bx - ay1 * by - az1 * bz;
	  return out;
	}
	function rotateY$8(out, a, rad) {
	  var bx = -a[0],
	      by = -a[1],
	      bz = -a[2],
	      bw = a[3],
	      ax = a[4],
	      ay = a[5],
	      az = a[6],
	      aw = a[7],
	      ax1 = ax * bw + aw * bx + ay * bz - az * by,
	      ay1 = ay * bw + aw * by + az * bx - ax * bz,
	      az1 = az * bw + aw * bz + ax * by - ay * bx,
	      aw1 = aw * bw - ax * bx - ay * by - az * bz;
	  rotateY$7(out, a, rad);
	  bx = out[0];
	  by = out[1];
	  bz = out[2];
	  bw = out[3];
	  out[4] = ax1 * bw + aw1 * bx + ay1 * bz - az1 * by;
	  out[5] = ay1 * bw + aw1 * by + az1 * bx - ax1 * bz;
	  out[6] = az1 * bw + aw1 * bz + ax1 * by - ay1 * bx;
	  out[7] = aw1 * bw - ax1 * bx - ay1 * by - az1 * bz;
	  return out;
	}
	function rotateZ$8(out, a, rad) {
	  var bx = -a[0],
	      by = -a[1],
	      bz = -a[2],
	      bw = a[3],
	      ax = a[4],
	      ay = a[5],
	      az = a[6],
	      aw = a[7],
	      ax1 = ax * bw + aw * bx + ay * bz - az * by,
	      ay1 = ay * bw + aw * by + az * bx - ax * bz,
	      az1 = az * bw + aw * bz + ax * by - ay * bx,
	      aw1 = aw * bw - ax * bx - ay * by - az * bz;
	  rotateZ$7(out, a, rad);
	  bx = out[0];
	  by = out[1];
	  bz = out[2];
	  bw = out[3];
	  out[4] = ax1 * bw + aw1 * bx + ay1 * bz - az1 * by;
	  out[5] = ay1 * bw + aw1 * by + az1 * bx - ax1 * bz;
	  out[6] = az1 * bw + aw1 * bz + ax1 * by - ay1 * bx;
	  out[7] = aw1 * bw - ax1 * bx - ay1 * by - az1 * bz;
	  return out;
	}
	function rotateByQuatAppend$1(out, a, q) {
	  var qx = q[0],
	      qy = q[1],
	      qz = q[2],
	      qw = q[3],
	      ax = a[0],
	      ay = a[1],
	      az = a[2],
	      aw = a[3];
	  out[0] = ax * qw + aw * qx + ay * qz - az * qy;
	  out[1] = ay * qw + aw * qy + az * qx - ax * qz;
	  out[2] = az * qw + aw * qz + ax * qy - ay * qx;
	  out[3] = aw * qw - ax * qx - ay * qy - az * qz;
	  ax = a[4];
	  ay = a[5];
	  az = a[6];
	  aw = a[7];
	  out[4] = ax * qw + aw * qx + ay * qz - az * qy;
	  out[5] = ay * qw + aw * qy + az * qx - ax * qz;
	  out[6] = az * qw + aw * qz + ax * qy - ay * qx;
	  out[7] = aw * qw - ax * qx - ay * qy - az * qz;
	  return out;
	}
	function rotateByQuatPrepend$1(out, q, a) {
	  var qx = q[0],
	      qy = q[1],
	      qz = q[2],
	      qw = q[3],
	      bx = a[0],
	      by = a[1],
	      bz = a[2],
	      bw = a[3];
	  out[0] = qx * bw + qw * bx + qy * bz - qz * by;
	  out[1] = qy * bw + qw * by + qz * bx - qx * bz;
	  out[2] = qz * bw + qw * bz + qx * by - qy * bx;
	  out[3] = qw * bw - qx * bx - qy * by - qz * bz;
	  bx = a[4];
	  by = a[5];
	  bz = a[6];
	  bw = a[7];
	  out[4] = qx * bw + qw * bx + qy * bz - qz * by;
	  out[5] = qy * bw + qw * by + qz * bx - qx * bz;
	  out[6] = qz * bw + qw * bz + qx * by - qy * bx;
	  out[7] = qw * bw - qx * bx - qy * by - qz * bz;
	  return out;
	}
	function rotateAroundAxis$1(out, a, axis, rad) {
	  if (Math.abs(rad) < EPSILON$1) {
	    return copy$h(out, a);
	  }

	  var axisLength = Math.sqrt(axis[0] * axis[0] + axis[1] * axis[1] + axis[2] * axis[2]);
	  rad = rad * 0.5;
	  var s = Math.sin(rad);
	  var bx = s * axis[0] / axisLength;
	  var by = s * axis[1] / axisLength;
	  var bz = s * axis[2] / axisLength;
	  var bw = Math.cos(rad);
	  var ax1 = a[0],
	      ay1 = a[1],
	      az1 = a[2],
	      aw1 = a[3];
	  out[0] = ax1 * bw + aw1 * bx + ay1 * bz - az1 * by;
	  out[1] = ay1 * bw + aw1 * by + az1 * bx - ax1 * bz;
	  out[2] = az1 * bw + aw1 * bz + ax1 * by - ay1 * bx;
	  out[3] = aw1 * bw - ax1 * bx - ay1 * by - az1 * bz;
	  var ax = a[4],
	      ay = a[5],
	      az = a[6],
	      aw = a[7];
	  out[4] = ax * bw + aw * bx + ay * bz - az * by;
	  out[5] = ay * bw + aw * by + az * bx - ax * bz;
	  out[6] = az * bw + aw * bz + ax * by - ay * bx;
	  out[7] = aw * bw - ax * bx - ay * by - az * bz;
	  return out;
	}
	function add$h(out, a, b) {
	  out[0] = a[0] + b[0];
	  out[1] = a[1] + b[1];
	  out[2] = a[2] + b[2];
	  out[3] = a[3] + b[3];
	  out[4] = a[4] + b[4];
	  out[5] = a[5] + b[5];
	  out[6] = a[6] + b[6];
	  out[7] = a[7] + b[7];
	  return out;
	}
	function multiply$h(out, a, b) {
	  var ax0 = a[0],
	      ay0 = a[1],
	      az0 = a[2],
	      aw0 = a[3],
	      bx1 = b[4],
	      by1 = b[5],
	      bz1 = b[6],
	      bw1 = b[7],
	      ax1 = a[4],
	      ay1 = a[5],
	      az1 = a[6],
	      aw1 = a[7],
	      bx0 = b[0],
	      by0 = b[1],
	      bz0 = b[2],
	      bw0 = b[3];
	  out[0] = ax0 * bw0 + aw0 * bx0 + ay0 * bz0 - az0 * by0;
	  out[1] = ay0 * bw0 + aw0 * by0 + az0 * bx0 - ax0 * bz0;
	  out[2] = az0 * bw0 + aw0 * bz0 + ax0 * by0 - ay0 * bx0;
	  out[3] = aw0 * bw0 - ax0 * bx0 - ay0 * by0 - az0 * bz0;
	  out[4] = ax0 * bw1 + aw0 * bx1 + ay0 * bz1 - az0 * by1 + ax1 * bw0 + aw1 * bx0 + ay1 * bz0 - az1 * by0;
	  out[5] = ay0 * bw1 + aw0 * by1 + az0 * bx1 - ax0 * bz1 + ay1 * bw0 + aw1 * by0 + az1 * bx0 - ax1 * bz0;
	  out[6] = az0 * bw1 + aw0 * bz1 + ax0 * by1 - ay0 * bx1 + az1 * bw0 + aw1 * bz0 + ax1 * by0 - ay1 * bx0;
	  out[7] = aw0 * bw1 - ax0 * bx1 - ay0 * by1 - az0 * bz1 + aw1 * bw0 - ax1 * bx0 - ay1 * by0 - az1 * bz0;
	  return out;
	}
	var mul$h = multiply$h;
	function scale$h(out, a, b) {
	  out[0] = a[0] * b;
	  out[1] = a[1] * b;
	  out[2] = a[2] * b;
	  out[3] = a[3] * b;
	  out[4] = a[4] * b;
	  out[5] = a[5] * b;
	  out[6] = a[6] * b;
	  out[7] = a[7] * b;
	  return out;
	}
	var dot$9 = dot$8;
	function lerp$9(out, a, b, t) {
	  var mt = 1 - t;
	  if (dot$9(a, b) < 0) t = -t;
	  out[0] = a[0] * mt + b[0] * t;
	  out[1] = a[1] * mt + b[1] * t;
	  out[2] = a[2] * mt + b[2] * t;
	  out[3] = a[3] * mt + b[3] * t;
	  out[4] = a[4] * mt + b[4] * t;
	  out[5] = a[5] * mt + b[5] * t;
	  out[6] = a[6] * mt + b[6] * t;
	  out[7] = a[7] * mt + b[7] * t;
	  return out;
	}
	function invert$b(out, a) {
	  var sqlen = squaredLength$9(a);
	  out[0] = -a[0] / sqlen;
	  out[1] = -a[1] / sqlen;
	  out[2] = -a[2] / sqlen;
	  out[3] = a[3] / sqlen;
	  out[4] = -a[4] / sqlen;
	  out[5] = -a[5] / sqlen;
	  out[6] = -a[6] / sqlen;
	  out[7] = a[7] / sqlen;
	  return out;
	}
	function conjugate$3(out, a) {
	  out[0] = -a[0];
	  out[1] = -a[1];
	  out[2] = -a[2];
	  out[3] = a[3];
	  out[4] = -a[4];
	  out[5] = -a[5];
	  out[6] = -a[6];
	  out[7] = a[7];
	  return out;
	}
	var length$9 = length$8;
	var len$9 = length$9;
	var squaredLength$9 = squaredLength$8;
	var sqrLen$9 = squaredLength$9;
	function normalize$9(out, a) {
	  var magnitude = squaredLength$9(a);

	  if (magnitude > 0) {
	    magnitude = Math.sqrt(magnitude);
	    var a0 = a[0] / magnitude;
	    var a1 = a[1] / magnitude;
	    var a2 = a[2] / magnitude;
	    var a3 = a[3] / magnitude;
	    var b0 = a[4];
	    var b1 = a[5];
	    var b2 = a[6];
	    var b3 = a[7];
	    var a_dot_b = a0 * b0 + a1 * b1 + a2 * b2 + a3 * b3;
	    out[0] = a0;
	    out[1] = a1;
	    out[2] = a2;
	    out[3] = a3;
	    out[4] = (b0 - a0 * a_dot_b) / magnitude;
	    out[5] = (b1 - a1 * a_dot_b) / magnitude;
	    out[6] = (b2 - a2 * a_dot_b) / magnitude;
	    out[7] = (b3 - a3 * a_dot_b) / magnitude;
	  }

	  return out;
	}
	function str$g(a) {
	  return 'quat2(' + a[0] + ', ' + a[1] + ', ' + a[2] + ', ' + a[3] + ', ' + a[4] + ', ' + a[5] + ', ' + a[6] + ', ' + a[7] + ')';
	}
	function exactEquals$h(a, b) {
	  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3] && a[4] === b[4] && a[5] === b[5] && a[6] === b[6] && a[7] === b[7];
	}
	function equals$j(a, b) {
	  var a0 = a[0],
	      a1 = a[1],
	      a2 = a[2],
	      a3 = a[3],
	      a4 = a[4],
	      a5 = a[5],
	      a6 = a[6],
	      a7 = a[7];
	  var b0 = b[0],
	      b1 = b[1],
	      b2 = b[2],
	      b3 = b[3],
	      b4 = b[4],
	      b5 = b[5],
	      b6 = b[6],
	      b7 = b[7];
	  return Math.abs(a0 - b0) <= EPSILON$1 * Math.max(1.0, Math.abs(a0), Math.abs(b0)) && Math.abs(a1 - b1) <= EPSILON$1 * Math.max(1.0, Math.abs(a1), Math.abs(b1)) && Math.abs(a2 - b2) <= EPSILON$1 * Math.max(1.0, Math.abs(a2), Math.abs(b2)) && Math.abs(a3 - b3) <= EPSILON$1 * Math.max(1.0, Math.abs(a3), Math.abs(b3)) && Math.abs(a4 - b4) <= EPSILON$1 * Math.max(1.0, Math.abs(a4), Math.abs(b4)) && Math.abs(a5 - b5) <= EPSILON$1 * Math.max(1.0, Math.abs(a5), Math.abs(b5)) && Math.abs(a6 - b6) <= EPSILON$1 * Math.max(1.0, Math.abs(a6), Math.abs(b6)) && Math.abs(a7 - b7) <= EPSILON$1 * Math.max(1.0, Math.abs(a7), Math.abs(b7));
	}

	var quat2 = /*#__PURE__*/Object.freeze({
		create: create$h,
		clone: clone$h,
		fromValues: fromValues$h,
		fromRotationTranslationValues: fromRotationTranslationValues$1,
		fromRotationTranslation: fromRotationTranslation$3,
		fromTranslation: fromTranslation$7,
		fromRotation: fromRotation$9,
		fromMat4: fromMat4$3,
		copy: copy$h,
		identity: identity$b,
		set: set$i,
		getReal: getReal$1,
		getDual: getDual$1,
		setReal: setReal$1,
		setDual: setDual$1,
		getTranslation: getTranslation$3,
		translate: translate$7,
		rotateX: rotateX$8,
		rotateY: rotateY$8,
		rotateZ: rotateZ$8,
		rotateByQuatAppend: rotateByQuatAppend$1,
		rotateByQuatPrepend: rotateByQuatPrepend$1,
		rotateAroundAxis: rotateAroundAxis$1,
		add: add$h,
		multiply: multiply$h,
		mul: mul$h,
		scale: scale$h,
		dot: dot$9,
		lerp: lerp$9,
		invert: invert$b,
		conjugate: conjugate$3,
		length: length$9,
		len: len$9,
		squaredLength: squaredLength$9,
		sqrLen: sqrLen$9,
		normalize: normalize$9,
		str: str$g,
		exactEquals: exactEquals$h,
		equals: equals$j
	});

	function create$i() {
	  var out = new ARRAY_TYPE$1(2);

	  if (ARRAY_TYPE$1 != Float32Array) {
	    out[0] = 0;
	    out[1] = 0;
	  }

	  return out;
	}
	function clone$i(a) {
	  var out = new ARRAY_TYPE$1(2);
	  out[0] = a[0];
	  out[1] = a[1];
	  return out;
	}
	function fromValues$i(x, y) {
	  var out = new ARRAY_TYPE$1(2);
	  out[0] = x;
	  out[1] = y;
	  return out;
	}
	function copy$i(out, a) {
	  out[0] = a[0];
	  out[1] = a[1];
	  return out;
	}
	function set$j(out, x, y) {
	  out[0] = x;
	  out[1] = y;
	  return out;
	}
	function add$i(out, a, b) {
	  out[0] = a[0] + b[0];
	  out[1] = a[1] + b[1];
	  return out;
	}
	function subtract$e(out, a, b) {
	  out[0] = a[0] - b[0];
	  out[1] = a[1] - b[1];
	  return out;
	}
	function multiply$i(out, a, b) {
	  out[0] = a[0] * b[0];
	  out[1] = a[1] * b[1];
	  return out;
	}
	function divide$6(out, a, b) {
	  out[0] = a[0] / b[0];
	  out[1] = a[1] / b[1];
	  return out;
	}
	function ceil$6(out, a) {
	  out[0] = Math.ceil(a[0]);
	  out[1] = Math.ceil(a[1]);
	  return out;
	}
	function floor$6(out, a) {
	  out[0] = Math.floor(a[0]);
	  out[1] = Math.floor(a[1]);
	  return out;
	}
	function min$6(out, a, b) {
	  out[0] = Math.min(a[0], b[0]);
	  out[1] = Math.min(a[1], b[1]);
	  return out;
	}
	function max$6(out, a, b) {
	  out[0] = Math.max(a[0], b[0]);
	  out[1] = Math.max(a[1], b[1]);
	  return out;
	}
	function round$6(out, a) {
	  out[0] = Math.round(a[0]);
	  out[1] = Math.round(a[1]);
	  return out;
	}
	function scale$i(out, a, b) {
	  out[0] = a[0] * b;
	  out[1] = a[1] * b;
	  return out;
	}
	function scaleAndAdd$6(out, a, b, scale) {
	  out[0] = a[0] + b[0] * scale;
	  out[1] = a[1] + b[1] * scale;
	  return out;
	}
	function distance$6(a, b) {
	  var x = b[0] - a[0],
	      y = b[1] - a[1];
	  return Math.sqrt(x * x + y * y);
	}
	function squaredDistance$6(a, b) {
	  var x = b[0] - a[0],
	      y = b[1] - a[1];
	  return x * x + y * y;
	}
	function length$a(a) {
	  var x = a[0],
	      y = a[1];
	  return Math.sqrt(x * x + y * y);
	}
	function squaredLength$a(a) {
	  var x = a[0],
	      y = a[1];
	  return x * x + y * y;
	}
	function negate$6(out, a) {
	  out[0] = -a[0];
	  out[1] = -a[1];
	  return out;
	}
	function inverse$6(out, a) {
	  out[0] = 1.0 / a[0];
	  out[1] = 1.0 / a[1];
	  return out;
	}
	function normalize$a(out, a) {
	  var x = a[0],
	      y = a[1];
	  var len = x * x + y * y;

	  if (len > 0) {
	    len = 1 / Math.sqrt(len);
	    out[0] = a[0] * len;
	    out[1] = a[1] * len;
	  }

	  return out;
	}
	function dot$a(a, b) {
	  return a[0] * b[0] + a[1] * b[1];
	}
	function cross$4(out, a, b) {
	  var z = a[0] * b[1] - a[1] * b[0];
	  out[0] = out[1] = 0;
	  out[2] = z;
	  return out;
	}
	function lerp$a(out, a, b, t) {
	  var ax = a[0],
	      ay = a[1];
	  out[0] = ax + t * (b[0] - ax);
	  out[1] = ay + t * (b[1] - ay);
	  return out;
	}
	function random$8(out, scale) {
	  scale = scale || 1.0;
	  var r = RANDOM$1() * 2.0 * Math.PI;
	  out[0] = Math.cos(r) * scale;
	  out[1] = Math.sin(r) * scale;
	  return out;
	}
	function transformMat2$1(out, a, m) {
	  var x = a[0],
	      y = a[1];
	  out[0] = m[0] * x + m[2] * y;
	  out[1] = m[1] * x + m[3] * y;
	  return out;
	}
	function transformMat2d$1(out, a, m) {
	  var x = a[0],
	      y = a[1];
	  out[0] = m[0] * x + m[2] * y + m[4];
	  out[1] = m[1] * x + m[3] * y + m[5];
	  return out;
	}
	function transformMat3$4(out, a, m) {
	  var x = a[0],
	      y = a[1];
	  out[0] = m[0] * x + m[3] * y + m[6];
	  out[1] = m[1] * x + m[4] * y + m[7];
	  return out;
	}
	function transformMat4$6(out, a, m) {
	  var x = a[0];
	  var y = a[1];
	  out[0] = m[0] * x + m[4] * y + m[12];
	  out[1] = m[1] * x + m[5] * y + m[13];
	  return out;
	}
	function rotate$9(out, a, b, c) {
	  var p0 = a[0] - b[0],
	      p1 = a[1] - b[1],
	      sinC = Math.sin(c),
	      cosC = Math.cos(c);
	  out[0] = p0 * cosC - p1 * sinC + b[0];
	  out[1] = p0 * sinC + p1 * cosC + b[1];
	  return out;
	}
	function angle$4(a, b) {
	  var x1 = a[0],
	      y1 = a[1],
	      x2 = b[0],
	      y2 = b[1];
	  var len1 = x1 * x1 + y1 * y1;

	  if (len1 > 0) {
	    len1 = 1 / Math.sqrt(len1);
	  }

	  var len2 = x2 * x2 + y2 * y2;

	  if (len2 > 0) {
	    len2 = 1 / Math.sqrt(len2);
	  }

	  var cosine = (x1 * x2 + y1 * y2) * len1 * len2;

	  if (cosine > 1.0) {
	    return 0;
	  } else if (cosine < -1.0) {
	    return Math.PI;
	  } else {
	    return Math.acos(cosine);
	  }
	}
	function str$h(a) {
	  return 'vec2(' + a[0] + ', ' + a[1] + ')';
	}
	function exactEquals$i(a, b) {
	  return a[0] === b[0] && a[1] === b[1];
	}
	function equals$k(a, b) {
	  var a0 = a[0],
	      a1 = a[1];
	  var b0 = b[0],
	      b1 = b[1];
	  return Math.abs(a0 - b0) <= EPSILON$1 * Math.max(1.0, Math.abs(a0), Math.abs(b0)) && Math.abs(a1 - b1) <= EPSILON$1 * Math.max(1.0, Math.abs(a1), Math.abs(b1));
	}
	var len$a = length$a;
	var sub$e = subtract$e;
	var mul$i = multiply$i;
	var div$6 = divide$6;
	var dist$6 = distance$6;
	var sqrDist$6 = squaredDistance$6;
	var sqrLen$a = squaredLength$a;
	var forEach$6 = function () {
	  var vec = create$i();
	  return function (a, stride, offset, count, fn, arg) {
	    var i = void 0,
	        l = void 0;

	    if (!stride) {
	      stride = 2;
	    }

	    if (!offset) {
	      offset = 0;
	    }

	    if (count) {
	      l = Math.min(count * stride + offset, a.length);
	    } else {
	      l = a.length;
	    }

	    for (i = offset; i < l; i += stride) {
	      vec[0] = a[i];
	      vec[1] = a[i + 1];
	      fn(vec, vec, arg);
	      a[i] = vec[0];
	      a[i + 1] = vec[1];
	    }

	    return a;
	  };
	}();

	var vec2 = /*#__PURE__*/Object.freeze({
		create: create$i,
		clone: clone$i,
		fromValues: fromValues$i,
		copy: copy$i,
		set: set$j,
		add: add$i,
		subtract: subtract$e,
		multiply: multiply$i,
		divide: divide$6,
		ceil: ceil$6,
		floor: floor$6,
		min: min$6,
		max: max$6,
		round: round$6,
		scale: scale$i,
		scaleAndAdd: scaleAndAdd$6,
		distance: distance$6,
		squaredDistance: squaredDistance$6,
		length: length$a,
		squaredLength: squaredLength$a,
		negate: negate$6,
		inverse: inverse$6,
		normalize: normalize$a,
		dot: dot$a,
		cross: cross$4,
		lerp: lerp$a,
		random: random$8,
		transformMat2: transformMat2$1,
		transformMat2d: transformMat2d$1,
		transformMat3: transformMat3$4,
		transformMat4: transformMat4$6,
		rotate: rotate$9,
		angle: angle$4,
		str: str$h,
		exactEquals: exactEquals$i,
		equals: equals$k,
		len: len$a,
		sub: sub$e,
		mul: mul$i,
		div: div$6,
		dist: dist$6,
		sqrDist: sqrDist$6,
		sqrLen: sqrLen$a,
		forEach: forEach$6
	});

	function E(E) {
	  for (var _2 = 1; _2 < arguments.length; _2++) {
	    var _R = arguments[_2];

	    for (var _3 in _R) {
	      E[_3] = _R[_3];
	    }
	  }

	  return E;
	}

	function _(_) {
	  for (var _T = 0; _T < (arguments.length <= 1 ? 0 : arguments.length - 1); _T++) {
	    E(_, _T + 1 < 1 || arguments.length <= _T + 1 ? undefined : arguments[_T + 1]);
	  }
	}

	var R = 1;

	var T = function () {
	  function T(E) {
	    this.uid = R++, this.states = function (E) {
	      return {
	        scissor: [0, 0, E.canvas.width, E.canvas.height],
	        viewport: [0, 0, E.canvas.width, E.canvas.height],
	        blendColor: [0, 0, 0, 0],
	        blendEquationSeparate: [E.FUNC_ADD, E.FUNC_ADD],
	        blendFuncSeparate: [E.ONE, E.ZERO, E.ONE, E.ZERO],
	        clearColor: [0, 0, 0, 0],
	        clearDepth: [1],
	        clearStencil: [0],
	        colorMask: [!0, !0, !0, !0],
	        cullFace: [E.BACK],
	        depthFunc: [E.LESS],
	        depthMask: [!0],
	        depthRange: [0, 1],
	        capabilities: {
	          3042: !1,
	          2884: !1,
	          2929: !1,
	          3024: !1,
	          32823: !1,
	          32926: !1,
	          32928: !1,
	          3089: !1,
	          2960: !1
	        },
	        frontFace: [E.CCW],
	        hint: {
	          33170: [E.DONT_CARE],
	          35723: [E.DONT_CARE]
	        },
	        lineWidth: [1],
	        pixelStorei: {
	          3333: [4],
	          3317: [4],
	          37440: [!1],
	          37441: [!1],
	          37443: [E.BROWSER_DEFAULT_WEBGL]
	        },
	        polygonOffset: [0, 0],
	        sampleCoverage: [1, !1],
	        stencilFuncSeparate: {
	          1028: [E.ALWAYS, 0, 4294967295],
	          1029: [E.ALWAYS, 0, 4294967295]
	        },
	        stencilMaskSeparate: {
	          1028: [4294967295],
	          1029: [4294967295]
	        },
	        stencilOpSeparate: {
	          1028: [E.KEEP, E.KEEP, E.KEEP],
	          1029: [E.KEEP, E.KEEP, E.KEEP]
	        },
	        program: null,
	        framebuffer: {
	          36160: null,
	          36008: null,
	          36009: null
	        },
	        renderbuffer: {
	          36161: null
	        },
	        textures: {
	          active: -1,
	          units: function () {
	            var _ = [],
	                R = E.getParameter(E.MAX_COMBINED_TEXTURE_IMAGE_UNITS);

	            for (var _E = 0; _E < R; _E++) {
	              _.push({
	                3553: null,
	                34067: null
	              });
	            }

	            return _[-1] = {
	              3553: null,
	              34067: null
	            }, _;
	          }()
	        },
	        attributes: {},
	        arrayBuffer: null,
	        elementArrayBuffer: null
	      };
	    }(E), this._ = E;
	  }

	  var _proto = T.prototype;

	  _proto.attachShader = function attachShader(E, _) {
	    return this._.attachShader(E, _);
	  };

	  _proto.shaderSource = function shaderSource(E, _) {
	    return this._.shaderSource(E, _);
	  };

	  _proto.compileShader = function compileShader(E) {
	    return this._.compileShader(E);
	  };

	  _proto.createShader = function createShader(E) {
	    return this._.createShader(E);
	  };

	  _proto.createProgram = function createProgram() {
	    return this._.createProgram();
	  };

	  _proto.createVertexArray = function createVertexArray() {
	    return this.R || (this.R = this._.getExtension("OES_vertex_array_object")), this.R.createVertexArrayOES();
	  };

	  _proto.deleteVertexArray = function deleteVertexArray(E) {
	    return this.R || (this.R = this._.getExtension("OES_vertex_array_object")), this.R.deleteVertexArrayOES(E);
	  };

	  _proto.bindVertexArray = function bindVertexArray(E) {
	    return this.R || (this.R = this._.getExtension("OES_vertex_array_object")), this.R.bindVertexArrayOES(E);
	  };

	  _proto.deleteProgram = function deleteProgram(E) {
	    return this.states.program === E && (this.states.program = null), this._.deleteProgram(E);
	  };

	  _proto.deleteShader = function deleteShader(E) {
	    return this._.deleteShader(E);
	  };

	  _proto.detachShader = function detachShader(E, _) {
	    return this._.detachShader(E, _);
	  };

	  _proto.getAttachedShaders = function getAttachedShaders(E) {
	    return this._.getAttachedShaders(E);
	  };

	  _proto.linkProgram = function linkProgram(E) {
	    return this.T(), this._.linkProgram(E);
	  };

	  _proto.getShaderParameter = function getShaderParameter(E, _) {
	    return this._.getShaderParameter(E, _);
	  };

	  _proto.getShaderPrecisionFormat = function getShaderPrecisionFormat(E, _) {
	    return this._.getShaderPrecisionFormat(E, _);
	  };

	  _proto.getShaderInfoLog = function getShaderInfoLog(E) {
	    return this._.getShaderInfoLog(E);
	  };

	  _proto.getShaderSource = function getShaderSource(E) {
	    return this._.getShaderSource(E);
	  };

	  _proto.getProgramInfoLog = function getProgramInfoLog(E) {
	    return this._.getProgramInfoLog(E);
	  };

	  _proto.getProgramParameter = function getProgramParameter(E, _) {
	    return this._.getProgramParameter(E, _);
	  };

	  _proto.getError = function getError() {
	    return this._.getError();
	  };

	  _proto.getContextAttributes = function getContextAttributes() {
	    return this._.getContextAttributes();
	  };

	  _proto.getExtension = function getExtension(E) {
	    return this._.getExtension(E);
	  };

	  _proto.getSupportedExtensions = function getSupportedExtensions() {
	    return this._.getSupportedExtensions();
	  };

	  _proto.getParameter = function getParameter(E) {
	    return this.T(), this._.getParameter(E);
	  };

	  _proto.isEnabled = function isEnabled(E) {
	    return this._.isEnabled(E);
	  };

	  _proto.isProgram = function isProgram(E) {
	    return this._.isProgram(E);
	  };

	  _proto.isShader = function isShader(E) {
	    return this._.isShader(E);
	  };

	  _proto.validateProgram = function validateProgram(E) {
	    return this._.validateProgram(E);
	  };

	  _proto.clear = function clear(E) {
	    return this.T(), this._.clear(E);
	  };

	  _proto.drawArrays = function drawArrays(E, _, R) {
	    return this.T(), this._.drawArrays(E, _, R);
	  };

	  _proto.drawElements = function drawElements(E, _, R, T) {
	    return this.T(), this._.drawElements(E, _, R, T);
	  };

	  _proto.A = function A() {
	    var E = this._,
	        _ = E.getParameter(E.CURRENT_PROGRAM),
	        R = E.getProgramParameter(_, E.ACTIVE_ATTRIBUTES),
	        T = [];

	    for (var _4 = 0; _4 < R; _4++) {
	      T.push(E.getVertexAttrib(_4, E.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING));
	    }

	    this.t = {
	      buffers: T,
	      elements: E.getParameter(E.ELEMENT_ARRAY_BUFFER_BINDING),
	      framebuffer: E.getParameter(E.FRAMEBUFFER_BINDING)
	    }, window.DEBUGGING && (console.log(this.uid, this.t), console.log(this.uid, this.states.attributes), console.log(this.states.attributes[0].buffer === this.t.buffers[0]), console.log(this.states.attributes[1].buffer === this.t.buffers[1]), console.log(this.states.attributes[2].buffer === this.t.buffers[2]));
	  };

	  _proto.finish = function finish() {};

	  _proto.flush = function flush() {
	    return this.T(), this._.flush();
	  };

	  _proto.commit = function commit() {
	    return this.T(), this._.commit();
	  };

	  _proto.isContextLost = function isContextLost() {
	    return this._.isContextLost();
	  };

	  _createClass(T, [{
	    key: "canvas",
	    get: function get() {
	      return this._.canvas;
	    }
	  }, {
	    key: "drawingBufferWidth",
	    get: function get() {
	      return this._.drawingBufferWidth;
	    }
	  }, {
	    key: "drawingBufferHeight",
	    get: function get() {
	      return this._.drawingBufferHeight;
	    }
	  }, {
	    key: "gl",
	    get: function get() {
	      return this._;
	    }
	  }]);

	  return T;
	}();

	_(T.prototype, {
	  DEPTH_BUFFER_BIT: 256,
	  STENCIL_BUFFER_BIT: 1024,
	  COLOR_BUFFER_BIT: 16384,
	  POINTS: 0,
	  LINES: 1,
	  LINE_LOOP: 2,
	  LINE_STRIP: 3,
	  TRIANGLES: 4,
	  TRIANGLE_STRIP: 5,
	  TRIANGLE_FAN: 6,
	  ZERO: 0,
	  ONE: 1,
	  SRC_COLOR: 768,
	  ONE_MINUS_SRC_COLOR: 769,
	  SRC_ALPHA: 770,
	  ONE_MINUS_SRC_ALPHA: 771,
	  DST_ALPHA: 772,
	  ONE_MINUS_DST_ALPHA: 773,
	  DST_COLOR: 774,
	  ONE_MINUS_DST_COLOR: 775,
	  SRC_ALPHA_SATURATE: 776,
	  CONSTANT_COLOR: 32769,
	  ONE_MINUS_CONSTANT_COLOR: 32770,
	  CONSTANT_ALPHA: 32771,
	  ONE_MINUS_CONSTANT_ALPHA: 32772,
	  FUNC_ADD: 32774,
	  FUNC_SUBSTRACT: 32778,
	  FUNC_REVERSE_SUBTRACT: 32779,
	  BLEND_EQUATION: 32777,
	  BLEND_EQUATION_RGB: 32777,
	  BLEND_EQUATION_ALPHA: 34877,
	  BLEND_DST_RGB: 32968,
	  BLEND_SRC_RGB: 32969,
	  BLEND_DST_ALPHA: 32970,
	  BLEND_SRC_ALPHA: 32971,
	  BLEND_COLOR: 32773,
	  ARRAY_BUFFER_BINDING: 34964,
	  ELEMENT_ARRAY_BUFFER_BINDING: 34965,
	  LINE_WIDTH: 2849,
	  ALIASED_POINT_SIZE_RANGE: 33901,
	  ALIASED_LINE_WIDTH_RANGE: 33902,
	  CULL_FACE_MODE: 2885,
	  FRONT_FACE: 2886,
	  DEPTH_RANGE: 2928,
	  DEPTH_WRITEMASK: 2930,
	  DEPTH_CLEAR_VALUE: 2931,
	  DEPTH_FUNC: 2932,
	  STENCIL_CLEAR_VALUE: 2961,
	  STENCIL_FUNC: 2962,
	  STENCIL_FAIL: 2964,
	  STENCIL_PASS_DEPTH_FAIL: 2965,
	  STENCIL_PASS_DEPTH_PASS: 2966,
	  STENCIL_REF: 2967,
	  STENCIL_VALUE_MASK: 2963,
	  STENCIL_WRITEMASK: 2968,
	  STENCIL_BACK_FUNC: 34816,
	  STENCIL_BACK_FAIL: 34817,
	  STENCIL_BACK_PASS_DEPTH_FAIL: 34818,
	  STENCIL_BACK_PASS_DEPTH_PASS: 34819,
	  STENCIL_BACK_REF: 36003,
	  STENCIL_BACK_VALUE_MASK: 36004,
	  STENCIL_BACK_WRITEMASK: 36005,
	  VIEWPORT: 2978,
	  SCISSOR_BOX: 3088,
	  COLOR_CLEAR_VALUE: 3106,
	  COLOR_WRITEMASK: 3107,
	  UNPACK_ALIGNMENT: 3317,
	  PACK_ALIGNMENT: 3333,
	  MAX_TEXTURE_SIZE: 3379,
	  MAX_VIEWPORT_DIMS: 3386,
	  SUBPIXEL_BITS: 3408,
	  RED_BITS: 3410,
	  GREEN_BITS: 3411,
	  BLUE_BITS: 3412,
	  ALPHA_BITS: 3413,
	  DEPTH_BITS: 3414,
	  STENCIL_BITS: 3415,
	  POLYGON_OFFSET_UNITS: 10752,
	  POLYGON_OFFSET_FACTOR: 32824,
	  TEXTURE_BINDING_2D: 32873,
	  SAMPLE_BUFFERS: 32936,
	  SAMPLES: 32937,
	  SAMPLE_COVERAGE_VALUE: 32938,
	  SAMPLE_COVERAGE_INVERT: 32939,
	  COMPRESSED_TEXTURE_FORMATS: 34467,
	  VENDOR: 7936,
	  RENDERER: 7937,
	  VERSION: 7938,
	  IMPLEMENTATION_COLOR_READ_TYPE: 35738,
	  IMPLEMENTATION_COLOR_READ_FORMAT: 35739,
	  BROWSER_DEFAULT_WEBGL: 37444,
	  STATIC_DRAW: 35044,
	  STREAM_DRAW: 35040,
	  DYNAMIC_DRAW: 35048,
	  ARRAY_BUFFER: 34962,
	  ELEMENT_ARRAY_BUFFER: 34963,
	  BUFFER_SIZE: 34660,
	  BUFFER_USAGE: 34661,
	  CURRENT_VERTEX_ATTRIB: 34342,
	  VERTEX_ATTRIB_ARRAY_ENABLED: 34338,
	  VERTEX_ATTRIB_ARRAY_SIZE: 34339,
	  VERTEX_ATTRIB_ARRAY_STRIDE: 34340,
	  VERTEX_ATTRIB_ARRAY_TYPE: 34341,
	  VERTEX_ATTRIB_ARRAY_NORMALIZED: 34922,
	  VERTEX_ATTRIB_ARRAY_POINTER: 34373,
	  VERTEX_ATTRIB_ARRAY_BUFFER_BINDING: 34975,
	  CULL_FACE: 2884,
	  FRONT: 1028,
	  BACK: 1029,
	  FRONT_AND_BACK: 1032,
	  BLEND: 3042,
	  DEPTH_TEST: 2929,
	  DITHER: 3024,
	  POLYGON_OFFSET_FILL: 32823,
	  SAMPLE_ALPHA_TO_COVERAGE: 32926,
	  SAMPLE_COVERAGE: 32928,
	  SCISSOR_TEST: 3089,
	  STENCIL_TEST: 2960,
	  NO_ERROR: 0,
	  INVALID_ENUM: 1280,
	  INVALID_VALUE: 1281,
	  INVALID_OPERATION: 1282,
	  OUT_OF_MEMORY: 1285,
	  CONTEXT_LOST_WEBGL: 37442,
	  CW: 2304,
	  CCW: 2305,
	  DONT_CARE: 4352,
	  FASTEST: 4353,
	  NICEST: 4354,
	  GENERATE_MIPMAP_HINT: 33170,
	  BYTE: 5120,
	  UNSIGNED_BYTE: 5121,
	  SHORT: 5122,
	  UNSIGNED_SHORT: 5123,
	  INT: 5124,
	  UNSIGNED_INT: 5125,
	  FLOAT: 5126,
	  DEPTH_COMPONENT: 6402,
	  ALPHA: 6406,
	  RGB: 6407,
	  RGBA: 6408,
	  LUMINANCE: 6409,
	  LUMINANCE_ALPHA: 6410,
	  UNSIGNED_SHORT_4_4_4_4: 32819,
	  UNSIGNED_SHORT_5_5_5_1: 32820,
	  UNSIGNED_SHORT_5_6_5: 33635,
	  FRAGMENT_SHADER: 35632,
	  VERTEX_SHADER: 35633,
	  COMPILE_STATUS: 35713,
	  DELETE_STATUS: 35712,
	  LINK_STATUS: 35714,
	  VALIDATE_STATUS: 35715,
	  ATTACHED_SHADERS: 35717,
	  ACTIVE_ATTRIBUTES: 35721,
	  ACTIVE_UNIFORMS: 35718,
	  MAX_VERTEX_ATTRIBS: 34921,
	  MAX_VERTEX_UNIFORM_VECTORS: 36347,
	  MAX_VARYING_VECTORS: 36348,
	  MAX_COMBINED_TEXTURE_IMAGE_UNITS: 35661,
	  MAX_VERTEX_TEXTURE_IMAGE_UNITS: 35660,
	  MAX_TEXTURE_IMAGE_UNITS: 34930,
	  MAX_FRAGMENT_UNIFORM_VECTORS: 36349,
	  SHADER_TYPE: 35663,
	  SHADING_LANGUAGE_VERSION: 35724,
	  CURRENT_PROGRAM: 35725,
	  NEVER: 512,
	  ALWAYS: 519,
	  LESS: 513,
	  EQUAL: 514,
	  LEQUAL: 515,
	  GREATER: 516,
	  GEQUAL: 518,
	  NOTEQUAL: 517,
	  KEEP: 7680,
	  REPLACE: 7681,
	  INCR: 7682,
	  DECR: 7683,
	  INVERT: 5386,
	  INCR_WRAP: 34055,
	  DECR_WRAP: 34056,
	  NEAREST: 9728,
	  LINEAR: 9729,
	  NEAREST_MIPMAP_NEAREST: 9984,
	  LINEAR_MIPMAP_NEAREST: 9985,
	  NEAREST_MIPMAP_LINEAR: 9986,
	  LINEAR_MIPMAP_LINEAR: 9987,
	  TEXTURE_MAG_FILTER: 10240,
	  TEXTURE_MIN_FILTER: 10241,
	  TEXTURE_WRAP_S: 10242,
	  TEXTURE_WRAP_T: 10243,
	  TEXTURE_2D: 3553,
	  TEXTURE: 5890,
	  TEXTURE_CUBE_MAP: 34067,
	  TEXTURE_BINDING_CUBE_MAP: 34068,
	  TEXTURE_CUBE_MAP_POSITIVE_X: 34069,
	  TEXTURE_CUBE_MAP_NEGATIVE_X: 34070,
	  TEXTURE_CUBE_MAP_POSITIVE_Y: 34071,
	  TEXTURE_CUBE_MAP_NEGATIVE_Y: 34072,
	  TEXTURE_CUBE_MAP_POSITIVE_Z: 34073,
	  TEXTURE_CUBE_MAP_NEGATIVE_Z: 34074,
	  MAX_CUBE_MAP_TEXTURE_SIZE: 34076,
	  TEXTURE0: 33984,
	  TEXTURE1: 33985,
	  TEXTURE2: 33986,
	  TEXTURE3: 33987,
	  TEXTURE4: 33988,
	  TEXTURE5: 33989,
	  TEXTURE6: 33990,
	  TEXTURE7: 33991,
	  TEXTURE8: 33992,
	  TEXTURE9: 33993,
	  TEXTURE10: 33994,
	  TEXTURE11: 33995,
	  TEXTURE12: 33996,
	  TEXTURE13: 33997,
	  TEXTURE14: 33998,
	  TEXTURE15: 33999,
	  TEXTURE16: 34e3,
	  ACTIVE_TEXTURE: 34016,
	  REPEAT: 10497,
	  CLAMP_TO_EDGE: 33071,
	  MIRRORED_REPEAT: 33648,
	  TEXTURE_WIDTH: 4096,
	  TEXTURE_HEIGHT: 4097,
	  FLOAT_VEC2: 35664,
	  FLOAT_VEC3: 35665,
	  FLOAT_VEC4: 35666,
	  INT_VEC2: 35667,
	  INT_VEC3: 35668,
	  INT_VEC4: 35669,
	  BOOL: 35670,
	  BOOL_VEC2: 35671,
	  BOOL_VEC3: 35672,
	  BOOL_VEC4: 35673,
	  FLOAT_MAT2: 35674,
	  FLOAT_MAT3: 35675,
	  FLOAT_MAT4: 35676,
	  SAMPLER_2D: 35678,
	  SAMPLER_CUBE: 35680,
	  LOW_FLOAT: 36336,
	  MEDIUM_FLOAT: 36337,
	  HIGH_FLOAT: 36338,
	  LOW_INT: 36339,
	  MEDIUM_INT: 36340,
	  HIGH_INT: 36341,
	  FRAMEBUFFER: 36160,
	  RENDERBUFFER: 36161,
	  RGBA4: 32854,
	  RGB5_A1: 32855,
	  RGB565: 36194,
	  DEPTH_COMPONENT16: 33189,
	  STENCIL_INDEX: 6401,
	  STENCIL_INDEX8: 36168,
	  DEPTH_STENCIL: 34041,
	  RENDERBUFFER_WIDTH: 36162,
	  RENDERBUFFER_HEIGHT: 36163,
	  RENDERBUFFER_INTERNAL_FORMAT: 36164,
	  RENDERBUFFER_RED_SIZE: 36176,
	  RENDERBUFFER_GREEN_SIZE: 36177,
	  RENDERBUFFER_BLUE_SIZE: 36178,
	  RENDERBUFFER_ALPHA_SIZE: 36179,
	  RENDERBUFFER_DEPTH_SIZE: 36180,
	  RENDERBUFFER_STENCIL_SIZE: 36181,
	  FRAMEBUFFER_ATTACHMENT_OBJECT_TYPE: 36048,
	  FRAMEBUFFER_ATTACHMENT_OBJECT_NAME: 36049,
	  FRAMEBUFFER_ATTACHMENT_TEXTURE_LEVEL: 36050,
	  FRAMEBUFFER_ATTACHMENT_TEXTURE_CUBE_MAP_FACE: 36051,
	  COLOR_ATTACHMENT0: 36064,
	  DEPTH_ATTACHMENT: 36096,
	  STENCIL_ATTACHMENT: 36128,
	  DEPTH_STENCIL_ATTACHMENT: 33306,
	  NONE: 0,
	  FRAMEBUFFER_COMPLETE: 36053,
	  FRAMEBUFFER_INCOMPLETE_ATTACHMENT: 36054,
	  FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT: 36055,
	  FRAMEBUFFER_INCOMPLETE_DIMENSIONS: 36057,
	  FRAMEBUFFER_UNSUPPORTED: 36061,
	  FRAMEBUFFER_BINDING: 36006,
	  RENDERBUFFER_BINDING: 36007,
	  MAX_RENDERBUFFER_SIZE: 34024,
	  INVALID_FRAMEBUFFER_OPERATION: 1286,
	  UNPACK_FLIP_Y_WEBGL: 37440,
	  UNPACK_PREMULTIPLY_ALPHA_WEBGL: 37441,
	  UNPACK_COLORSPACE_CONVERSION_WEBGL: 37443,
	  READ_BUFFER: 3074,
	  UNPACK_ROW_LENGTH: 3314,
	  UNPACK_SKIP_ROWS: 3315,
	  UNPACK_SKIP_PIXELS: 3316,
	  PACK_ROW_LENGTH: 3330,
	  PACK_SKIP_ROWS: 3331,
	  PACK_SKIP_PIXELS: 3332,
	  UNPACK_SKIP_IMAGES: 32877,
	  UNPACK_IMAGE_HEIGHT: 32878,
	  MAX_3D_TEXTURE_SIZE: 32883,
	  MAX_ELEMENTS_VERTICES: 33e3,
	  MAX_ELEMENTS_INDICES: 33001,
	  MAX_TEXTURE_LOD_BIAS: 34045,
	  MAX_FRAGMENT_UNIFORM_COMPONENTS: 35657,
	  MAX_VERTEX_UNIFORM_COMPONENTS: 35658,
	  MAX_ARRAY_TEXTURE_LAYERS: 35071,
	  MIN_PROGRAM_TEXEL_OFFSET: 35076,
	  MAX_PROGRAM_TEXEL_OFFSET: 35077,
	  MAX_VARYING_COMPONENTS: 35659,
	  FRAGMENT_SHADER_DERIVATIVE_HINT: 35723,
	  RASTERIZER_DISCARD: 35977,
	  VERTEX_ARRAY_BINDING: 34229,
	  MAX_VERTEX_OUTPUT_COMPONENTS: 37154,
	  MAX_FRAGMENT_INPUT_COMPONENTS: 37157,
	  MAX_SERVER_WAIT_TIMEOUT: 37137,
	  MAX_ELEMENT_INDEX: 36203,
	  RED: 6403,
	  RGB8: 32849,
	  RGBA8: 32856,
	  RGB10_A2: 32857,
	  TEXTURE_3D: 32879,
	  TEXTURE_WRAP_R: 32882,
	  TEXTURE_MIN_LOD: 33082,
	  TEXTURE_MAX_LOD: 33083,
	  TEXTURE_BASE_LEVEL: 33084,
	  TEXTURE_MAX_LEVEL: 33085,
	  TEXTURE_COMPARE_MODE: 34892,
	  TEXTURE_COMPARE_FUNC: 34893,
	  SRGB: 35904,
	  SRGB8: 35905,
	  SRGB8_ALPHA8: 35907,
	  COMPARE_REF_TO_TEXTURE: 34894,
	  RGBA32F: 34836,
	  RGB32F: 34837,
	  RGBA16F: 34842,
	  RGB16F: 34843,
	  TEXTURE_2D_ARRAY: 35866,
	  TEXTURE_BINDING_2D_ARRAY: 35869,
	  R11F_G11F_B10F: 35898,
	  RGB9_E5: 35901,
	  RGBA32UI: 36208,
	  RGB32UI: 36209,
	  RGBA16UI: 36214,
	  RGB16UI: 36215,
	  RGBA8UI: 36220,
	  RGB8UI: 36221,
	  RGBA32I: 36226,
	  RGB32I: 36227,
	  RGBA16I: 36232,
	  RGB16I: 36233,
	  RGBA8I: 36238,
	  RGB8I: 36239,
	  RED_INTEGER: 36244,
	  RGB_INTEGER: 36248,
	  RGBA_INTEGER: 36249,
	  R8: 33321,
	  RG8: 33323,
	  R16F: 33325,
	  R32F: 33326,
	  RG16F: 33327,
	  RG32F: 33328,
	  R8I: 33329,
	  R8UI: 33330,
	  R16I: 33331,
	  R16UI: 33332,
	  R32I: 33333,
	  R32UI: 33334,
	  RG8I: 33335,
	  RG8UI: 33336,
	  RG16I: 33337,
	  RG16UI: 33338,
	  RG32I: 33339,
	  RG32UI: 33340,
	  R8_SNORM: 36756,
	  RG8_SNORM: 36757,
	  RGB8_SNORM: 36758,
	  RGBA8_SNORM: 36759,
	  RGB10_A2UI: 36975,
	  TEXTURE_IMMUTABLE_FORMAT: 37167,
	  TEXTURE_IMMUTABLE_LEVELS: 33503,
	  UNSIGNED_INT_2_10_10_10_REV: 33640,
	  UNSIGNED_INT_10F_11F_11F_REV: 35899,
	  UNSIGNED_INT_5_9_9_9_REV: 35902,
	  FLOAT_32_UNSIGNED_INT_24_8_REV: 36269,
	  UNSIGNED_INT_24_8: 34042,
	  HALF_FLOAT: 5131,
	  RG: 33319,
	  RG_INTEGER: 33320,
	  INT_2_10_10_10_REV: 36255,
	  CURRENT_QUERY: 34917,
	  QUERY_RESULT: 34918,
	  QUERY_RESULT_AVAILABLE: 34919,
	  ANY_SAMPLES_PASSED: 35887,
	  ANY_SAMPLES_PASSED_CONSERVATIVE: 36202,
	  MAX_DRAW_BUFFERS: 34852,
	  DRAW_BUFFER0: 34853,
	  DRAW_BUFFER1: 34854,
	  DRAW_BUFFER2: 34855,
	  DRAW_BUFFER3: 34856,
	  DRAW_BUFFER4: 34857,
	  DRAW_BUFFER5: 34858,
	  DRAW_BUFFER6: 34859,
	  DRAW_BUFFER7: 34860,
	  DRAW_BUFFER8: 34861,
	  DRAW_BUFFER9: 34862,
	  DRAW_BUFFER10: 34863,
	  DRAW_BUFFER11: 34864,
	  DRAW_BUFFER12: 34865,
	  DRAW_BUFFER13: 34866,
	  DRAW_BUFFER14: 34867,
	  DRAW_BUFFER15: 34868,
	  MAX_COLOR_ATTACHMENTS: 36063,
	  COLOR_ATTACHMENT1: 36065,
	  COLOR_ATTACHMENT2: 36066,
	  COLOR_ATTACHMENT3: 36067,
	  COLOR_ATTACHMENT4: 36068,
	  COLOR_ATTACHMENT5: 36069,
	  COLOR_ATTACHMENT6: 36070,
	  COLOR_ATTACHMENT7: 36071,
	  COLOR_ATTACHMENT8: 36072,
	  COLOR_ATTACHMENT9: 36073,
	  COLOR_ATTACHMENT10: 36074,
	  COLOR_ATTACHMENT11: 36075,
	  COLOR_ATTACHMENT12: 36076,
	  COLOR_ATTACHMENT13: 36077,
	  COLOR_ATTACHMENT14: 36078,
	  COLOR_ATTACHMENT15: 36079,
	  SAMPLER_3D: 35679,
	  SAMPLER_2D_SHADOW: 35682,
	  SAMPLER_2D_ARRAY: 36289,
	  SAMPLER_2D_ARRAY_SHADOW: 36292,
	  SAMPLER_CUBE_SHADOW: 36293,
	  INT_SAMPLER_2D: 36298,
	  INT_SAMPLER_3D: 36299,
	  INT_SAMPLER_CUBE: 36300,
	  INT_SAMPLER_2D_ARRAY: 36303,
	  UNSIGNED_INT_SAMPLER_2D: 36306,
	  UNSIGNED_INT_SAMPLER_3D: 36307,
	  UNSIGNED_INT_SAMPLER_CUBE: 36308,
	  UNSIGNED_INT_SAMPLER_2D_ARRAY: 36311,
	  MAX_SAMPLES: 36183,
	  SAMPLER_BINDING: 35097,
	  PIXEL_PACK_BUFFER: 35051,
	  PIXEL_UNPACK_BUFFER: 35052,
	  PIXEL_PACK_BUFFER_BINDING: 35053,
	  PIXEL_UNPACK_BUFFER_BINDING: 35055,
	  COPY_READ_BUFFER: 36662,
	  COPY_WRITE_BUFFER: 36663,
	  COPY_READ_BUFFER_BINDING: 36662,
	  COPY_WRITE_BUFFER_BINDING: 36663,
	  FLOAT_MAT2x3: 35685,
	  FLOAT_MAT2x4: 35686,
	  FLOAT_MAT3x2: 35687,
	  FLOAT_MAT3x4: 35688,
	  FLOAT_MAT4x2: 35689,
	  FLOAT_MAT4x3: 35690,
	  UNSIGNED_INT_VEC2: 36294,
	  UNSIGNED_INT_VEC3: 36295,
	  UNSIGNED_INT_VEC4: 36296,
	  UNSIGNED_NORMALIZED: 35863,
	  SIGNED_NORMALIZED: 36764,
	  VERTEX_ATTRIB_ARRAY_INTEGER: 35069,
	  VERTEX_ATTRIB_ARRAY_DIVISOR: 35070,
	  TRANSFORM_FEEDBACK_BUFFER_MODE: 35967,
	  MAX_TRANSFORM_FEEDBACK_SEPARATE_COMPONENTS: 35968,
	  TRANSFORM_FEEDBACK_VARYINGS: 35971,
	  TRANSFORM_FEEDBACK_BUFFER_START: 35972,
	  TRANSFORM_FEEDBACK_BUFFER_SIZE: 35973,
	  TRANSFORM_FEEDBACK_PRIMITIVES_WRITTEN: 35976,
	  MAX_TRANSFORM_FEEDBACK_INTERLEAVED_COMPONENTS: 35978,
	  MAX_TRANSFORM_FEEDBACK_SEPARATE_ATTRIBS: 35979,
	  INTERLEAVED_ATTRIBS: 35980,
	  SEPARATE_ATTRIBS: 35981,
	  TRANSFORM_FEEDBACK_BUFFER: 35982,
	  TRANSFORM_FEEDBACK_BUFFER_BINDING: 35983,
	  TRANSFORM_FEEDBACK: 36386,
	  TRANSFORM_FEEDBACK_PAUSED: 36387,
	  TRANSFORM_FEEDBACK_ACTIVE: 36388,
	  TRANSFORM_FEEDBACK_BINDING: 36389,
	  FRAMEBUFFER_ATTACHMENT_COLOR_ENCODING: 33296,
	  FRAMEBUFFER_ATTACHMENT_COMPONENT_TYPE: 33297,
	  FRAMEBUFFER_ATTACHMENT_RED_SIZE: 33298,
	  FRAMEBUFFER_ATTACHMENT_GREEN_SIZE: 33299,
	  FRAMEBUFFER_ATTACHMENT_BLUE_SIZE: 33300,
	  FRAMEBUFFER_ATTACHMENT_ALPHA_SIZE: 33301,
	  FRAMEBUFFER_ATTACHMENT_DEPTH_SIZE: 33302,
	  FRAMEBUFFER_ATTACHMENT_STENCIL_SIZE: 33303,
	  FRAMEBUFFER_DEFAULT: 33304,
	  DEPTH24_STENCIL8: 35056,
	  DRAW_FRAMEBUFFER_BINDING: 36006,
	  READ_FRAMEBUFFER_BINDING: 36010,
	  RENDERBUFFER_SAMPLES: 36011,
	  FRAMEBUFFER_ATTACHMENT_TEXTURE_LAYER: 36052,
	  FRAMEBUFFER_INCOMPLETE_MULTISAMPLE: 36182,
	  UNIFORM_BUFFER: 35345,
	  UNIFORM_BUFFER_BINDING: 35368,
	  UNIFORM_BUFFER_START: 35369,
	  UNIFORM_BUFFER_SIZE: 35370,
	  MAX_VERTEX_UNIFORM_BLOCKS: 35371,
	  MAX_FRAGMENT_UNIFORM_BLOCKS: 35373,
	  MAX_COMBINED_UNIFORM_BLOCKS: 35374,
	  MAX_UNIFORM_BUFFER_BINDINGS: 35375,
	  MAX_UNIFORM_BLOCK_SIZE: 35376,
	  MAX_COMBINED_VERTEX_UNIFORM_COMPONENTS: 35377,
	  MAX_COMBINED_FRAGMENT_UNIFORM_COMPONENTS: 35379,
	  UNIFORM_BUFFER_OFFSET_ALIGNMENT: 35380,
	  ACTIVE_UNIFORM_BLOCKS: 35382,
	  UNIFORM_TYPE: 35383,
	  UNIFORM_SIZE: 35384,
	  UNIFORM_BLOCK_INDEX: 35386,
	  UNIFORM_OFFSET: 35387,
	  UNIFORM_ARRAY_STRIDE: 35388,
	  UNIFORM_MATRIX_STRIDE: 35389,
	  UNIFORM_IS_ROW_MAJOR: 35390,
	  UNIFORM_BLOCK_BINDING: 35391,
	  UNIFORM_BLOCK_DATA_SIZE: 35392,
	  UNIFORM_BLOCK_ACTIVE_UNIFORMS: 35394,
	  UNIFORM_BLOCK_ACTIVE_UNIFORM_INDICES: 35395,
	  UNIFORM_BLOCK_REFERENCED_BY_VERTEX_SHADER: 35396,
	  UNIFORM_BLOCK_REFERENCED_BY_FRAGMENT_SHADER: 35398,
	  OBJECT_TYPE: 37138,
	  SYNC_CONDITION: 37139,
	  SYNC_STATUS: 37140,
	  SYNC_FLAGS: 37141,
	  SYNC_FENCE: 37142,
	  SYNC_GPU_COMMANDS_COMPLETE: 37143,
	  UNSIGNALED: 37144,
	  SIGNALED: 37145,
	  ALREADY_SIGNALED: 37146,
	  TIMEOUT_EXPIRED: 37147,
	  CONDITION_SATISFIED: 37148,
	  WAIT_FAILED: 37149,
	  SYNC_FLUSH_COMMANDS_BIT: 1,
	  COLOR: 6144,
	  DEPTH: 6145,
	  STENCIL: 6146,
	  MIN: 32775,
	  MAX: 32776,
	  DEPTH_COMPONENT24: 33190,
	  STREAM_READ: 35041,
	  STREAM_COPY: 35042,
	  STATIC_READ: 35045,
	  STATIC_COPY: 35046,
	  DYNAMIC_READ: 35049,
	  DYNAMIC_COPY: 35050,
	  DEPTH_COMPONENT32F: 36012,
	  DEPTH32F_STENCIL8: 36013,
	  INVALID_INDEX: 4294967295,
	  TIMEOUT_IGNORED: -1,
	  MAX_CLIENT_WAIT_TIMEOUT_WEBGL: 37447,
	  VERTEX_ATTRIB_ARRAY_DIVISOR_ANGLE: 35070,
	  UNMASKED_VENDOR_WEBGL: 37445,
	  UNMASKED_RENDERER_WEBGL: 37446,
	  MAX_TEXTURE_MAX_ANISOTROPY_EXT: 34047,
	  TEXTURE_MAX_ANISOTROPY_EXT: 34046,
	  COMPRESSED_RGB_S3TC_DXT1_EXT: 33776,
	  COMPRESSED_RGBA_S3TC_DXT1_EXT: 33777,
	  COMPRESSED_RGBA_S3TC_DXT3_EXT: 33778,
	  COMPRESSED_RGBA_S3TC_DXT5_EXT: 33779,
	  COMPRESSED_R11_EAC: 37488,
	  COMPRESSED_SIGNED_R11_EAC: 37489,
	  COMPRESSED_RG11_EAC: 37490,
	  COMPRESSED_SIGNED_RG11_EAC: 37491,
	  COMPRESSED_RGB8_ETC2: 37492,
	  COMPRESSED_RGBA8_ETC2_EAC: 37493,
	  COMPRESSED_SRGB8_ETC2: 37494,
	  COMPRESSED_SRGB8_ALPHA8_ETC2_EAC: 37495,
	  COMPRESSED_RGB8_PUNCHTHROUGH_ALPHA1_ETC2: 37496,
	  COMPRESSED_SRGB8_PUNCHTHROUGH_ALPHA1_ETC2: 37497,
	  COMPRESSED_RGB_PVRTC_4BPPV1_IMG: 35840,
	  COMPRESSED_RGBA_PVRTC_4BPPV1_IMG: 35842,
	  COMPRESSED_RGB_PVRTC_2BPPV1_IMG: 35841,
	  COMPRESSED_RGBA_PVRTC_2BPPV1_IMG: 35843,
	  COMPRESSED_RGB_ETC1_WEBGL: 36196,
	  COMPRESSED_RGB_ATC_WEBGL: 35986,
	  COMPRESSED_RGBA_ATC_EXPLICIT_ALPHA_WEBGL: 35986,
	  COMPRESSED_RGBA_ATC_INTERPOLATED_ALPHA_WEBGL: 34798,
	  UNSIGNED_INT_24_8_WEBGL: 34042,
	  HALF_FLOAT_OES: 36193,
	  RGBA32F_EXT: 34836,
	  RGB32F_EXT: 34837,
	  FRAMEBUFFER_ATTACHMENT_COMPONENT_TYPE_EXT: 33297,
	  UNSIGNED_NORMALIZED_EXT: 35863,
	  MIN_EXT: 32775,
	  MAX_EXT: 32776,
	  SRGB_EXT: 35904,
	  SRGB_ALPHA_EXT: 35906,
	  SRGB8_ALPHA8_EXT: 35907,
	  FRAMEBUFFER_ATTACHMENT_COLOR_ENCODING_EXT: 33296,
	  FRAGMENT_SHADER_DERIVATIVE_HINT_OES: 35723,
	  COLOR_ATTACHMENT0_WEBGL: 36064,
	  COLOR_ATTACHMENT1_WEBGL: 36065,
	  COLOR_ATTACHMENT2_WEBGL: 36066,
	  COLOR_ATTACHMENT3_WEBGL: 36067,
	  COLOR_ATTACHMENT4_WEBGL: 36068,
	  COLOR_ATTACHMENT5_WEBGL: 36069,
	  COLOR_ATTACHMENT6_WEBGL: 36070,
	  COLOR_ATTACHMENT7_WEBGL: 36071,
	  COLOR_ATTACHMENT8_WEBGL: 36072,
	  COLOR_ATTACHMENT9_WEBGL: 36073,
	  COLOR_ATTACHMENT10_WEBGL: 36074,
	  COLOR_ATTACHMENT11_WEBGL: 36075,
	  COLOR_ATTACHMENT12_WEBGL: 36076,
	  COLOR_ATTACHMENT13_WEBGL: 36077,
	  COLOR_ATTACHMENT14_WEBGL: 36078,
	  COLOR_ATTACHMENT15_WEBGL: 36079,
	  DRAW_BUFFER0_WEBGL: 34853,
	  DRAW_BUFFER1_WEBGL: 34854,
	  DRAW_BUFFER2_WEBGL: 34855,
	  DRAW_BUFFER3_WEBGL: 34856,
	  DRAW_BUFFER4_WEBGL: 34857,
	  DRAW_BUFFER5_WEBGL: 34858,
	  DRAW_BUFFER6_WEBGL: 34859,
	  DRAW_BUFFER7_WEBGL: 34860,
	  DRAW_BUFFER8_WEBGL: 34861,
	  DRAW_BUFFER9_WEBGL: 34862,
	  DRAW_BUFFER10_WEBGL: 34863,
	  DRAW_BUFFER11_WEBGL: 34864,
	  DRAW_BUFFER12_WEBGL: 34865,
	  DRAW_BUFFER13_WEBGL: 34866,
	  DRAW_BUFFER14_WEBGL: 34867,
	  DRAW_BUFFER15_WEBGL: 34868,
	  MAX_COLOR_ATTACHMENTS_WEBGL: 36063,
	  MAX_DRAW_BUFFERS_WEBGL: 34852,
	  VERTEX_ARRAY_BINDING_OES: 34229,
	  QUERY_COUNTER_BITS_EXT: 34916,
	  CURRENT_QUERY_EXT: 34917,
	  QUERY_RESULT_EXT: 34918,
	  QUERY_RESULT_AVAILABLE_EXT: 34919,
	  TIME_ELAPSED_EXT: 35007,
	  TIMESTAMP_EXT: 36392,
	  GPU_DISJOINT_EXT: 36795
	}), _(T.prototype, {
	  bufferData: function bufferData() {
	    var _this$_;

	    return this.T(), (_this$_ = this._).bufferData.apply(_this$_, arguments);
	  },
	  bufferSubData: function bufferSubData() {
	    var _this$_2;

	    return this.T(), (_this$_2 = this._).bufferSubData.apply(_this$_2, arguments);
	  },
	  createBuffer: function createBuffer() {
	    return this._.createBuffer();
	  },
	  deleteBuffer: function deleteBuffer(E) {
	    var _ = this.states;
	    _.arrayBuffer === E ? _.arrayBuffer = null : _.elementArrayBuffer === E && (_.elementArrayBuffer = null);
	    var R = _.attributes;

	    for (var _5 in R) {
	      R[_5].buffer === E && (R[_5].buffer = null);
	    }

	    return this._.deleteBuffer(E);
	  },
	  getBufferParameter: function getBufferParameter(E, _) {
	    return this.T(), this._.getBufferParameter(E, _);
	  },
	  isBuffer: function isBuffer(E) {
	    return this._.isBuffer(E);
	  }
	}), _(T.prototype, {
	  checkFramebufferStatus: function checkFramebufferStatus(E) {
	    return this._.checkFramebufferStatus(E);
	  },
	  createFramebuffer: function createFramebuffer() {
	    return this._.createFramebuffer();
	  },
	  deleteFramebuffer: function deleteFramebuffer(E) {
	    var _ = this.states.framebuffer;

	    for (var _R2 in _) {
	      _[_R2] === E && (_[_R2] = null);
	    }

	    return this._.deleteFramebuffer(E);
	  },
	  framebufferRenderbuffer: function framebufferRenderbuffer(E, _, R, T) {
	    return this.T(), this._.framebufferRenderbuffer(E, _, R, T);
	  },
	  framebufferTexture2D: function framebufferTexture2D(E, _, R, T, A) {
	    return this.T(), this._.framebufferTexture2D(E, _, R, T, A);
	  },
	  getFramebufferAttachmentParameter: function getFramebufferAttachmentParameter(E, _, R) {
	    return this.T(), this._.getFramebufferAttachmentParameter(E, _, R);
	  },
	  isFramebuffer: function isFramebuffer(E) {
	    return this._.isFramebuffer(E);
	  },
	  readPixels: function readPixels(E, _, R, T, A, t, r) {
	    return this.T(), this._.readPixels(E, _, R, T, A, t, r);
	  }
	}), _(T.prototype, {
	  createRenderbuffer: function createRenderbuffer() {
	    return this._.createRenderbuffer();
	  },
	  deleteRenderbuffer: function deleteRenderbuffer(E) {
	    var _ = this.states.renderbuffer;

	    for (var _R3 in _) {
	      _[_R3] === E && (_[_R3] = null);
	    }

	    return this._.deleteRenderbuffer(E);
	  },
	  getRenderbufferParameter: function getRenderbufferParameter(E, _) {
	    return this.T(), this._.getRenderbufferParameter(E, _);
	  },
	  isRenderbuffer: function isRenderbuffer(E) {
	    return this._.isRenderbuffer(E);
	  },
	  renderbufferStorage: function renderbufferStorage(E, _, R, T) {
	    return this.T(), this._.renderbufferStorage(E, _, R, T);
	  }
	});

	var A = Array.isArray,
	    t = Object.keys,
	    r = Object.prototype.hasOwnProperty,
	    N = function E(_, R) {
	  if (_ === R) return !0;

	  if (_ && R && "object" == typeof _ && "object" == typeof R) {
	    var T,
	        N,
	        e,
	        i = A(_),
	        I = A(R);

	    if (i && I) {
	      if ((N = _.length) != R.length) return !1;

	      for (T = N; 0 != T--;) {
	        if (!E(_[T], R[T])) return !1;
	      }

	      return !0;
	    }

	    if (i != I) return !1;
	    var s = _ instanceof Date,
	        S = R instanceof Date;
	    if (s != S) return !1;
	    if (s && S) return _.getTime() == R.getTime();
	    var F = _ instanceof RegExp,
	        O = R instanceof RegExp;
	    if (F != O) return !1;
	    if (F && O) return _.toString() == R.toString();
	    var M = t(_);
	    if ((N = M.length) !== t(R).length) return !1;

	    for (T = N; 0 != T--;) {
	      if (!r.call(R, M[T])) return !1;
	    }

	    for (T = N; 0 != T--;) {
	      if (!E(_[e = M[T]], R[e])) return !1;
	    }

	    return !0;
	  }

	  return _ != _ && R != R;
	};

	_(T.prototype, {
	  scissor: function scissor(E, _, R, T) {
	    this.T();
	    var A = this.states.scissor;
	    A[0] === E && A[1] === _ && A[2] === R && A[3] === T || (A[0] = E, A[1] = _, A[2] = R, A[3] = T, this._.scissor(E, _, R, T));
	  },
	  viewport: function viewport(E, _, R, T) {
	    this.T();
	    var A = this.states.viewport;
	    A[0] === E && A[1] === _ && A[2] === R && A[3] === T || (A[0] = E, A[1] = _, A[2] = R, A[3] = T, this._.viewport(E, _, R, T));
	  },
	  blendColor: function blendColor(E, _, R, T) {
	    this.T();
	    var A = this.states.blendColor;
	    A[0] === E && A[1] === _ && A[2] === R && A[3] === T || (A[0] = E, A[1] = _, A[2] = R, A[3] = T, this._.blendColor(E, _, R, T));
	  },
	  blendEquation: function blendEquation(E) {
	    this.T();
	    var _ = this.states.blendEquationSeparate;
	    _[0] === E && _[1] === E || (_[0] = E, _[1] = E, this._.blendEquation(E));
	  },
	  blendEquationSeparate: function blendEquationSeparate(E, _) {
	    this.T();
	    var R = this.states.blendEquationSeparate;
	    R[0] === E && R[1] === _ || (R[0] = E, R[1] = _, this._.blendEquationSeparate(E, _));
	  },
	  blendFunc: function blendFunc(E, _) {
	    this.T();
	    var R = this.states.blendFuncSeparate;
	    R[0] === E && R[2] === E && R[1] === _ && R[3] === _ || (R[0] = E, R[1] = _, R[2] = E, R[3] = _, this._.blendFunc(E, _));
	  },
	  blendFuncSeparate: function blendFuncSeparate(E, _, R, T) {
	    this.T();
	    var A = this.states.blendFuncSeparate;
	    A[0] === E && A[1] === _ && A[2] === R && A[3] === T || (A[0] = E, A[1] = _, A[2] = R, A[3] = T, this._.blendFuncSeparate(E, _, R, T));
	  },
	  clearColor: function clearColor(E, _, R, T) {
	    this.T();
	    var A = this.states.clearColor;
	    A[0] === E && A[1] === _ && A[2] === R && A[3] === T || (A[0] = E, A[1] = _, A[2] = R, A[3] = T, this._.clearColor(E, _, R, T));
	  },
	  clearDepth: function clearDepth(E) {
	    this.T();
	    var _ = this.states.clearDepth;
	    _[0] !== E && (_[0] = E, this._.clearDepth(E));
	  },
	  clearStencil: function clearStencil(E) {
	    this.T();
	    var _ = this.states.clearStencil;
	    _[0] !== E && (_[0] = E, this._.clearStencil(E));
	  },
	  colorMask: function colorMask(E, _, R, T) {
	    this.T();
	    var A = this.states.colorMask;
	    A[0] === E && A[1] === _ && A[2] === R && A[3] === T || (A[0] = E, A[1] = _, A[2] = R, A[3] = T, this._.colorMask(E, _, R, T));
	  },
	  cullFace: function cullFace(E) {
	    this.T();
	    var _ = this.states.cullFace;
	    _[0] !== E && (_[0] = E, this._.cullFace(E));
	  },
	  depthFunc: function depthFunc(E) {
	    this.T();
	    var _ = this.states.depthFunc;
	    _[0] !== E && (_[0] = E, this._.depthFunc(E));
	  },
	  depthMask: function depthMask(E) {
	    this.T();
	    var _ = this.states.depthMask;
	    _[0] !== E && (_[0] = E, this._.depthMask(E));
	  },
	  depthRange: function depthRange(E, _) {
	    this.T();
	    var R = this.states.depthRange;
	    R[0] === E && R[1] === _ || (R[0] = E, R[1] = _, this._.depthRange(E, _));
	  },
	  disable: function disable(E) {
	    this.T();
	    var _ = this.states.capabilities;
	    _[E] && (_[E] = !1, this._.disable(E));
	  },
	  enable: function enable(E) {
	    this.T();
	    var _ = this.states.capabilities;
	    _[E] || (_[E] = !0, this._.enable(E));
	  },
	  frontFace: function frontFace(E) {
	    this.T();
	    var _ = this.states.frontFace;
	    _[0] !== E && (_[0] = E, this._.frontFace(E));
	  },
	  hint: function hint(E, _) {
	    this.T();
	    var R = this.states.hint;
	    R[E][0] !== _ && (R[E][0] = _, this._.hint(E, _));
	  },
	  lineWidth: function lineWidth(E) {
	    this.T();
	    var _ = this.states.lineWidth;
	    _[0] !== E && (_[0] = E, this._.lineWidth(E));
	  },
	  pixelStorei: function pixelStorei(E, _) {
	    this.T();
	    var R = this.states.pixelStorei;
	    R[E] !== _ && (R[E] && (R[E][0] = _), this._.pixelStorei(E, _));
	  },
	  polygonOffset: function polygonOffset(E, _) {
	    this.T();
	    var R = this.states.polygonOffset;
	    R[0] === E && R[1] === _ || (R[0] = E, R[1] = _, this._.polygonOffset(E, _));
	  },
	  sampleCoverage: function sampleCoverage(E, _) {
	    this.T();
	    var R = this.states.sampleCoverage;
	    R[0] === E && R[1] === _ || (R[0] = E, R[1] = _, this._.sampleCoverage(E, _));
	  },
	  stencilFunc: function stencilFunc(E, _, R) {
	    this.T();
	    var T = this.states.stencilFuncSeparate,
	        A = this._;
	    T[A.FRONT][0] === E && T[A.FRONT][1] === _ && T[A.FRONT][2] === R && T[A.BACK][0] === E && T[A.BACK][1] === _ && T[A.BACK][2] === R || (T[A.FRONT][0] = T[A.BACK][0] = E, T[A.FRONT][1] = T[A.BACK][1] = _, T[A.FRONT][2] = T[A.BACK][2] = R, this._.stencilFunc(E, _, R));
	  },
	  stencilFuncSeparate: function stencilFuncSeparate(E, _, R, T) {
	    if (this.T(), E === this._.FRONT_AND_BACK) return void this.stencilFunc(_, R, T);
	    var A = this.states.stencilFuncSeparate;
	    A[E][0] === _ && A[E][1] === R && A[E][2] === T || (A[E][0] = _, A[E][1] = R, A[E][2] = T, this._.stencilFuncSeparate(E, _, R, T));
	  },
	  stencilMask: function stencilMask(E) {
	    this.T();
	    var _ = this._,
	        R = this.states.stencilMaskSeparate;
	    R[_.FRONT][0] === E && R[_.BACK][0] === E || (R[_.FRONT][0] = E, R[_.BACK][0] = E, this._.stencilMask(E));
	  },
	  stencilMaskSeparate: function stencilMaskSeparate(E, _) {
	    if (this.T(), E === this._.FRONT_AND_BACK) return void this.stencilMask(_);
	    var R = this.states.stencilMaskSeparate;
	    R[E][0] !== _ && (R[E][0] = _, this._.stencilMaskSeparate(E, _));
	  },
	  stencilOp: function stencilOp(E, _, R) {
	    this.T();
	    var T = this.states.stencilOpSeparate,
	        A = this._;
	    T[A.FRONT][0] === E && T[A.FRONT][1] === _ && T[A.FRONT][2] === R && T[A.BACK][0] === E && T[A.BACK][1] === _ && T[A.BACK][2] === R || (T[A.FRONT][0] = T[A.BACK][0] = E, T[A.FRONT][1] = T[A.BACK][1] = _, T[A.FRONT][2] = T[A.BACK][2] = R, this._.stencilOp(E, _, R));
	  },
	  stencilOpSeparate: function stencilOpSeparate(E, _, R, T) {
	    if (this.T(), E === this._.FRONT_AND_BACK) return void this.stencilOp(_, R, T);
	    var A = this.states.stencilOpSeparate;
	    A[E][0] === _ && A[E][1] === R && A[E][2] === T || (A[E][0] = _, A[E][1] = R, A[E][2] = T, this._.stencilOpSeparate(E, _, R, T));
	  },
	  bindFramebuffer: function bindFramebuffer(E, _) {
	    this.T();
	    var R = this.states.framebuffer;
	    R[E] !== _ && (R[E] = _, this._.bindFramebuffer(E, _));
	  },
	  bindRenderbuffer: function bindRenderbuffer(E, _) {
	    this.T();
	    var R = this.states.renderbuffer;
	    R[E] !== _ && (R[E] = _, this._.bindRenderbuffer(E, _));
	  },
	  bindTexture: function bindTexture(E, _) {
	    this.T();
	    var R = this.states.textures,
	        T = -1 !== R.active ? R.active - 33984 : -1;
	    R.units[T][E] = _, this._.bindTexture(E, _);
	  },
	  activeTexture: function activeTexture(E) {
	    this.T();
	    var _ = this._,
	        R = this.states.textures,
	        T = R.active;
	    R.active = E, _.activeTexture(E), -1 === T && (R.units[E - 33984][_.TEXTURE_2D] = R.units[-1][_.TEXTURE_2D], R.units[E - 33984][_.TEXTURE_CUBE_MAP] = R.units[-1][_.TEXTURE_CUBE_MAP], R.units[-1][_.TEXTURE_2D] = null, R.units[-1][_.TEXTURE_CUBE_MAP] = null);
	  },
	  useProgram: function useProgram(E) {
	    this.T();
	    var _ = this.states;
	    _.program !== E && (_.program = E, this._.useProgram(E));
	  },
	  bindBuffer: function bindBuffer(E, _) {
	    this.T();
	    var R = this._,
	        T = this.states;

	    if (E === R.ELEMENT_ARRAY_BUFFER) {
	      if (T.elementArrayBuffer === _) return;
	      T.elementArrayBuffer = _;
	    } else {
	      if (T.arrayBuffer === _) return;
	      T.arrayBuffer = _;
	    }

	    R.bindBuffer(E, _);
	  },
	  vertexAttribPointer: function vertexAttribPointer(E, _, R, T, A, t) {
	    this.T();
	    var r = [E, _, R, T, A, t];
	    this.states.attributes[E] || (this.states.attributes[E] = {
	      enable: !0
	    });
	    var N = this.states.attributes[E];
	    return N.buffer = this.states.arrayBuffer, N.args = r, this._.vertexAttribPointer(E, _, R, T, A, t);
	  }
	}, {
	  T: function T() {
	    var E = this._;

	    if (E.N && E.N !== this) {
	      var _6 = E.N;
	      this.i(_6.states), E.N = this;
	    }

	    E.N = this;
	  },
	  i: function i(E) {
	    var _ = this.states,
	        R = this._;

	    for (var _T2 in _) {
	      if ("capabilities" !== _T2 && "textures" !== _T2 && "attributes" !== _T2 && "arrayBuffer" !== _T2 && "elementArrayBuffer" !== _T2) if ("program" === _T2) _.program !== E.program && R.useProgram(_.program);else if ("framebuffer" === _T2) for (var _A in _[_T2]) {
	        _[_T2][_A] !== E[_T2][_A] && R.bindFramebuffer(+_A, _[_T2][_A]);
	      } else if ("renderbuffer" === _T2) for (var _A2 in _[_T2]) {
	        _[_T2][_A2] !== E[_T2][_A2] && R.bindRenderbuffer(+_A2, _[_T2][_A2]);
	      } else if (!N(_[_T2], E[_T2])) if (Array.isArray(E[_T2])) R[_T2].apply(R, _[_T2]);else for (var _A3 in _[_T2]) {
	        N(_[_T2][_A3], E[_T2][_A3]) || R[_T2].apply(R, [+_A3].concat(_[_T2][_A3]));
	      }
	    }

	    for (var _T3 in _.capabilities) {
	      _.capabilities[_T3] !== E.capabilities[_T3] && R[_.capabilities[_T3] ? "enable" : "disable"](+_T3);
	    }

	    var T = _.textures,
	        A = E.textures,
	        t = T.units,
	        r = A.units,
	        e = T.active - R.TEXTURE0;

	    for (var _E2 = 0; _E2 < t.length; _E2++) {
	      _E2 === e || t[_E2][R.TEXTURE_2D] === r[_E2][R.TEXTURE_2D] && t[_E2][R.TEXTURE_CUBE_MAP] === r[_E2][R.TEXTURE_CUBE_MAP] || (R.activeTexture(R.TEXTURE0 + _E2), R.bindTexture(R.TEXTURE_2D, t[_E2][R.TEXTURE_2D]), R.bindTexture(R.TEXTURE_CUBE_MAP, t[_E2][R.TEXTURE_CUBE_MAP]));
	    }

	    if (T.active > -1) {
	      var _E3 = t[e];
	      _E3[R.TEXTURE_2D] === r[e][R.TEXTURE_2D] && _E3[R.TEXTURE_CUBE_MAP] === r[e][R.TEXTURE_CUBE_MAP] || (R.activeTexture(T.active), R.bindTexture(R.TEXTURE_2D, _E3[R.TEXTURE_2D]), R.bindTexture(R.TEXTURE_CUBE_MAP, _E3[R.TEXTURE_CUBE_MAP]));
	    }

	    var i = _.attributes,
	        I = E.attributes;

	    for (var _E4 in i) {
	      I[_E4] && i[_E4].buffer === I[_E4].buffer && N(i[_E4].args, I[_E4].args) || i[_E4].buffer && (R.bindBuffer(R.ARRAY_BUFFER, i[_E4].buffer), R.vertexAttribPointer.apply(R, i[_E4].args), i[_E4].enable ? R.enableVertexAttribArray(i[_E4].args[0]) : R.disableVertexAttribArray(i[_E4].args[0]));
	    }

	    R.bindBuffer(R.ARRAY_BUFFER, _.arrayBuffer), R.bindBuffer(R.ELEMENT_ARRAY_BUFFER, _.elementArrayBuffer);
	  }
	}), _(T.prototype, {
	  compressedTexImage2D: function compressedTexImage2D(E, _, R, T, A, t, r) {
	    return this.T(), this._.compressedTexImage2D(E, _, R, T, A, t, r);
	  },
	  copyTexImage2D: function copyTexImage2D(E, _, R, T, A, t, r, N) {
	    return this.T(), this._.copyTexImage2D(E, _, R, T, A, t, r, N);
	  },
	  copyTexSubImage2D: function copyTexSubImage2D(E, _, R, T, A, t, r, N) {
	    return this.T(), this._.copyTexSubImage2D(E, _, R, T, A, t, r, N);
	  },
	  createTexture: function createTexture() {
	    return this._.createTexture();
	  },
	  deleteTexture: function deleteTexture(E) {
	    return this._.deleteTexture(E);
	  },
	  generateMipmap: function generateMipmap(E) {
	    return this.T(), this._.generateMipmap(E);
	  },
	  getTexParameter: function getTexParameter(E, _) {
	    return this.T(), this._.getTexParameter(E, _);
	  },
	  isTexture: function isTexture(E) {
	    return this._.isTexture(E);
	  },
	  texImage2D: function texImage2D() {
	    var _this$_3;

	    return this.T(), (_this$_3 = this._).texImage2D.apply(_this$_3, arguments);
	  },
	  texSubImage2D: function texSubImage2D(E) {
	    var _this$_4;

	    return this.T(), (_this$_4 = this._).texSubImage2D.apply(_this$_4, E);
	  },
	  texParameterf: function texParameterf(E, _, R) {
	    return this.T(), this._.texParameterf(E, _, R);
	  },
	  texParameteri: function texParameteri(E, _, R) {
	    return this.T(), this._.texParameteri(E, _, R);
	  }
	}), _(T.prototype, {
	  bindAttribLocation: function bindAttribLocation(E, _, R) {
	    return this._.bindAttribLocation(E, _, R);
	  },
	  enableVertexAttribArray: function enableVertexAttribArray(E) {
	    return this.T(), this.states.attributes[E] || (this.states.attributes[E] = {}), this.states.attributes[E].enable = !0, this._.enableVertexAttribArray(E);
	  },
	  disableVertexAttribArray: function disableVertexAttribArray(E) {
	    return this.T(), this.states.attributes[E] || (this.states.attributes[E] = {}), this.states.attributes[E].enable = !1, this._.disableVertexAttribArray(E);
	  },
	  getActiveAttrib: function getActiveAttrib(E, _) {
	    return this._.getActiveAttrib(E, _);
	  },
	  getActiveUniform: function getActiveUniform(E, _) {
	    return this._.getActiveUniform(E, _);
	  },
	  getAttribLocation: function getAttribLocation(E, _) {
	    return this._.getAttribLocation(E, _);
	  },
	  getUniformLocation: function getUniformLocation(E, _) {
	    return this._.getUniformLocation(E, _);
	  },
	  getVertexAttrib: function getVertexAttrib(E, _) {
	    return this.T(), this._.getVertexAttrib(E, _);
	  },
	  getVertexAttribOffset: function getVertexAttribOffset(E, _) {
	    return this.T(), this._.getVertexAttribOffset(E, _);
	  },
	  uniformMatrix2fv: function uniformMatrix2fv(E, _, R) {
	    return this.T(), this._.uniformMatrix2fv(E, _, R);
	  },
	  uniformMatrix3fv: function uniformMatrix3fv(E, _, R) {
	    return this.T(), this._.uniformMatrix3fv(E, _, R);
	  },
	  uniformMatrix4fv: function uniformMatrix4fv(E, _, R) {
	    return this.T(), this._.uniformMatrix4fv(E, _, R);
	  },
	  uniform1f: function uniform1f(E, _) {
	    return this.T(), this._.uniform1f(E, _);
	  },
	  uniform1fv: function uniform1fv(E, _) {
	    return this.T(), this._.uniform1fv(E, _);
	  },
	  uniform1i: function uniform1i(E, _) {
	    return this.T(), this._.uniform1i(E, _);
	  },
	  uniform1iv: function uniform1iv(E, _) {
	    return this.T(), this._.uniform1iv(E, _);
	  },
	  uniform2f: function uniform2f(E, _, R) {
	    return this.T(), this._.uniform2f(E, _, R);
	  },
	  uniform2fv: function uniform2fv(E, _) {
	    return this.T(), this._.uniform2fv(E, _);
	  },
	  uniform2i: function uniform2i(E, _, R) {
	    return this.T(), this._.uniform2i(E, _, R);
	  },
	  uniform2iv: function uniform2iv(E, _) {
	    return this.T(), this._.uniform2iv(E, _);
	  },
	  uniform3f: function uniform3f(E, _, R, T) {
	    return this.T(), this._.uniform3f(E, _, R, T);
	  },
	  uniform3fv: function uniform3fv(E, _) {
	    return this.T(), this._.uniform3fv(E, _);
	  },
	  uniform3i: function uniform3i(E, _, R, T) {
	    return this.T(), this._.uniform3i(E, _, R, T);
	  },
	  uniform3iv: function uniform3iv(E, _) {
	    return this.T(), this._.uniform3iv(E, _);
	  },
	  uniform4f: function uniform4f(E, _, R, T, A) {
	    return this.T(), this._.uniform4f(E, _, R, T, A);
	  },
	  uniform4fv: function uniform4fv(E, _) {
	    return this.T(), this._.uniform4fv(E, _);
	  },
	  uniform4i: function uniform4i(E, _, R, T, A) {
	    return this.T(), this._.uniform4i(E, _, R, T, A);
	  },
	  uniform4iv: function uniform4iv(E, _) {
	    return this.T(), this._.uniform4iv(E, _);
	  },
	  vertexAttrib1f: function vertexAttrib1f(E, _) {
	    return this.T(), this._.vertexAttrib1f(E, _);
	  },
	  vertexAttrib2f: function vertexAttrib2f(E, _, R) {
	    return this.T(), this._.vertexAttrib2f(E, _, R);
	  },
	  vertexAttrib3f: function vertexAttrib3f(E, _, R, T) {
	    return this.T(), this._.vertexAttrib3f(E, _, R, T);
	  },
	  vertexAttrib4f: function vertexAttrib4f(E, _, R, T, A) {
	    return this.T(), this._.vertexAttrib4f(E, _, R, T, A);
	  },
	  vertexAttrib1fv: function vertexAttrib1fv(E, _) {
	    return this.T(), this._.vertexAttrib1fv(E, _);
	  },
	  vertexAttrib2fv: function vertexAttrib2fv(E, _) {
	    return this.T(), this._.vertexAttrib2fv(E, _);
	  },
	  vertexAttrib3fv: function vertexAttrib3fv(E, _) {
	    return this.T(), this._.vertexAttrib3fv(E, _);
	  },
	  vertexAttrib4fv: function vertexAttrib4fv(E, _) {
	    return this.T(), this._.vertexAttrib4fv(E, _);
	  }
	});

	var options = {
	  renderer: 'gl',
	  antialias: true,
	  extensions: ['ANGLE_instanced_arrays', 'OES_texture_float', 'OES_element_index_uint', 'OES_standard_derivatives'],
	  optionalExtensions: ['WEBGL_draw_buffers', 'EXT_shader_texture_lod', 'OES_texture_float_linear'],
	  forceRenderOnZooming: true,
	  forceRenderOnMoving: true,
	  forceRenderOnRotating: true
	};

	var GroupGLLayer = function (_maptalks$Layer) {
	  _inheritsLoose(GroupGLLayer, _maptalks$Layer);

	  GroupGLLayer.fromJSON = function fromJSON(layerJSON) {
	    if (!layerJSON || layerJSON['type'] !== 'GroupGLLayer') {
	      return null;
	    }

	    var layers = layerJSON['layers'].map(function (json) {
	      return maptalks.Layer.fromJSON(json);
	    });
	    return new GroupGLLayer(layerJSON['id'], layers, layerJSON['options']);
	  };

	  function GroupGLLayer(id, layers, options) {
	    var _this;

	    _this = _maptalks$Layer.call(this, id, options) || this;
	    _this.layers = layers || [];

	    _this._checkChildren();

	    _this._layerMap = {};
	    return _this;
	  }

	  var _proto = GroupGLLayer.prototype;

	  _proto.addLayer = function addLayer(layer, idx) {
	    if (layer.getMap()) {
	      throw new Error("layer(" + layer.getId() + " is already added on map");
	    }

	    if (idx === undefined) {
	      this.layers.push(layer);
	    } else {
	      this.layers.splice(idx, 0, layer);
	    }

	    this._checkChildren();

	    var renderer = this.getRenderer();

	    if (!renderer) {
	      return this;
	    }

	    this._prepareLayer(layer);

	    renderer.setToRedraw();
	    return this;
	  };

	  _proto.removeLayer = function removeLayer(layer) {
	    if (maptalks.Util.isString(layer)) {
	      layer = this.getChildLayer(layer);
	    }

	    var idx = this.layers.indexOf(layer);

	    if (idx < 0) {
	      return this;
	    }

	    layer._doRemove();

	    layer.off('show hide', this._onLayerShowHide, this);
	    delete this._layerMap[layer.getId()];
	    this.layers.splice(idx, 1);
	    this.getRenderer().setToRedraw();
	    return this;
	  };

	  _proto.getLayers = function getLayers() {
	    return this.layers;
	  };

	  _proto.toJSON = function toJSON() {
	    var layers = [];

	    if (this.layers) {
	      for (var i = 0; i < this.layers.length; i++) {
	        var layer = this.layers[i];

	        if (!layer) {
	          continue;
	        }

	        if (layer && layer.toJSON) {
	          layers.push(layer.toJSON());
	        }
	      }
	    }

	    var profile = {
	      'type': this.getJSONType(),
	      'id': this.getId(),
	      'layers': layers,
	      'options': this.config()
	    };
	    return profile;
	  };

	  _proto.onLoadEnd = function onLoadEnd() {
	    var _this2 = this;

	    this.layers.forEach(function (layer) {
	      _this2._prepareLayer(layer);
	    });

	    _maptalks$Layer.prototype.onLoadEnd.call(this);
	  };

	  _proto._prepareLayer = function _prepareLayer(layer) {
	    var map = this.getMap();
	    this._layerMap[layer.getId()] = layer;
	    layer['_canvas'] = this.getRenderer().canvas;
	    layer['_bindMap'](map);
	    layer.once('renderercreate', this._onChildRendererCreate, this);
	    layer.load();

	    this._bindChildListeners(layer);
	  };

	  _proto.onRemove = function onRemove() {
	    var _this3 = this;

	    this.layers.forEach(function (layer) {
	      layer._doRemove();

	      layer.off('show hide', _this3._onLayerShowHide, _this3);
	    });
	    delete this._layerMap;

	    _maptalks$Layer.prototype.onRemove.call(this);
	  };

	  _proto.getChildLayer = function getChildLayer(id) {
	    var layer = this._layerMap[id];
	    return layer || null;
	  };

	  _proto._bindChildListeners = function _bindChildListeners(layer) {
	    layer.on('show hide', this._onLayerShowHide, this);
	  };

	  _proto._onLayerShowHide = function _onLayerShowHide() {
	    var renderer = this.getRenderer();

	    if (renderer) {
	      renderer.setToRedraw();
	    }
	  };

	  _proto._onChildRendererCreate = function _onChildRendererCreate(e) {
	    e.renderer.clearCanvas = empty;
	  };

	  _proto.isVisible = function isVisible() {
	    if (!_maptalks$Layer.prototype.isVisible.call(this)) {
	      return false;
	    }

	    var children = this.layers;

	    for (var i = 0, l = children.length; i < l; i++) {
	      if (children[i].isVisible()) {
	        return true;
	      }
	    }

	    return false;
	  };

	  _proto._checkChildren = function _checkChildren() {
	    var _this4 = this;

	    var ids = {};
	    this.layers.forEach(function (layer) {
	      var layerId = layer.getId();

	      if (ids[layerId]) {
	        throw new Error("Duplicate child layer id (" + layerId + ") in the GroupGLLayer (" + _this4.getId() + ")");
	      } else {
	        ids[layerId] = 1;
	      }
	    });
	  };

	  return GroupGLLayer;
	}(maptalks.Layer);
	GroupGLLayer.mergeOptions(options);
	GroupGLLayer.registerJSONType('GroupGLLayer');

	var Renderer$1 = function (_maptalks$renderer$Ca) {
	  _inheritsLoose(Renderer, _maptalks$renderer$Ca);

	  function Renderer() {
	    return _maptalks$renderer$Ca.apply(this, arguments) || this;
	  }

	  var _proto2 = Renderer.prototype;

	  _proto2.onAdd = function onAdd() {
	    _maptalks$renderer$Ca.prototype.onAdd.call(this);

	    this.prepareCanvas();
	  };

	  _proto2.render = function render() {
	    for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
	      args[_key] = arguments[_key];
	    }

	    if (!this.getMap() || !this.layer.isVisible()) {
	      return;
	    }

	    this.prepareRender();
	    this.prepareCanvas();
	    this.forEachRenderer(function (renderer, layer) {
	      if (!layer.isVisible()) {
	        return;
	      }

	      var gl = renderer.gl;

	      if (gl && gl instanceof T) {
	        gl.clear(gl.STENCIL_BUFFER_BIT);
	      }

	      renderer.render.apply(renderer, args);
	    });
	    this['_toRedraw'] = false;
	  };

	  _proto2.drawOnInteracting = function drawOnInteracting() {
	    for (var _len2 = arguments.length, args = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
	      args[_key2] = arguments[_key2];
	    }

	    if (!this.getMap() || !this.layer.isVisible()) {
	      return;
	    }

	    this.forEachRenderer(function (renderer, layer) {
	      if (!layer.isVisible()) {
	        return;
	      }

	      var gl = renderer.gl;

	      if (gl && gl instanceof T) {
	        gl.clear(gl.STENCIL_BUFFER_BIT);
	      }

	      renderer.drawOnInteracting.apply(renderer, args);
	    });
	    this['_toRedraw'] = false;
	  };

	  _proto2.testIfNeedRedraw = function testIfNeedRedraw() {
	    if (this['_toRedraw']) {
	      this['_toRedraw'] = false;
	      return true;
	    }

	    var layers = this.layer.getLayers();

	    for (var _iterator = layers, _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
	      var _ref;

	      if (_isArray) {
	        if (_i >= _iterator.length) break;
	        _ref = _iterator[_i++];
	      } else {
	        _i = _iterator.next();
	        if (_i.done) break;
	        _ref = _i.value;
	      }

	      var layer = _ref;
	      var renderer = layer.getRenderer();

	      if (renderer && renderer.testIfNeedRedraw()) {
	        return true;
	      }
	    }

	    return false;
	  };

	  _proto2.isRenderComplete = function isRenderComplete() {
	    var layers = this.layer.getLayers();

	    for (var _iterator2 = layers, _isArray2 = Array.isArray(_iterator2), _i2 = 0, _iterator2 = _isArray2 ? _iterator2 : _iterator2[Symbol.iterator]();;) {
	      var _ref2;

	      if (_isArray2) {
	        if (_i2 >= _iterator2.length) break;
	        _ref2 = _iterator2[_i2++];
	      } else {
	        _i2 = _iterator2.next();
	        if (_i2.done) break;
	        _ref2 = _i2.value;
	      }

	      var layer = _ref2;
	      var renderer = layer.getRenderer();

	      if (renderer && !renderer.isRenderComplete()) {
	        return false;
	      }
	    }

	    return true;
	  };

	  _proto2.mustRenderOnInteracting = function mustRenderOnInteracting() {
	    var layers = this.layer.getLayers();

	    for (var _iterator3 = layers, _isArray3 = Array.isArray(_iterator3), _i3 = 0, _iterator3 = _isArray3 ? _iterator3 : _iterator3[Symbol.iterator]();;) {
	      var _ref3;

	      if (_isArray3) {
	        if (_i3 >= _iterator3.length) break;
	        _ref3 = _iterator3[_i3++];
	      } else {
	        _i3 = _iterator3.next();
	        if (_i3.done) break;
	        _ref3 = _i3.value;
	      }

	      var layer = _ref3;
	      var renderer = layer.getRenderer();

	      if (renderer && renderer.mustRenderOnInteracting()) {
	        return true;
	      }
	    }

	    return false;
	  };

	  _proto2.isCanvasUpdated = function isCanvasUpdated() {
	    var layers = this.layer.getLayers();

	    for (var _iterator4 = layers, _isArray4 = Array.isArray(_iterator4), _i4 = 0, _iterator4 = _isArray4 ? _iterator4 : _iterator4[Symbol.iterator]();;) {
	      var _ref4;

	      if (_isArray4) {
	        if (_i4 >= _iterator4.length) break;
	        _ref4 = _iterator4[_i4++];
	      } else {
	        _i4 = _iterator4.next();
	        if (_i4.done) break;
	        _ref4 = _i4.value;
	      }

	      var layer = _ref4;
	      var renderer = layer.getRenderer();

	      if (renderer && renderer.isCanvasUpdated()) {
	        return true;
	      }
	    }

	    return false;
	  };

	  _proto2.isBlank = function isBlank() {
	    var layers = this.layer.getLayers();

	    for (var _iterator5 = layers, _isArray5 = Array.isArray(_iterator5), _i5 = 0, _iterator5 = _isArray5 ? _iterator5 : _iterator5[Symbol.iterator]();;) {
	      var _ref5;

	      if (_isArray5) {
	        if (_i5 >= _iterator5.length) break;
	        _ref5 = _iterator5[_i5++];
	      } else {
	        _i5 = _iterator5.next();
	        if (_i5.done) break;
	        _ref5 = _i5.value;
	      }

	      var layer = _ref5;
	      var renderer = layer.getRenderer();

	      if (renderer && !renderer.isBlank()) {
	        return false;
	      }
	    }

	    return true;
	  };

	  _proto2.createContext = function createContext() {
	    var _this5 = this;

	    var layer = this.layer;
	    var attributes = layer.options['glOptions'] || {
	      alpha: true,
	      depth: true,
	      stencil: true
	    };
	    attributes.preserveDrawingBuffer = true;
	    attributes.antialias = layer.options['antialias'];
	    this.glOptions = attributes;

	    var gl = this.gl = this._createGLContext(this.canvas, attributes);

	    this._initGL(gl);

	    gl.wrap = function () {
	      return new T(_this5.gl);
	    };

	    this.glCtx = gl.wrap();
	    this.canvas.gl = this.gl;
	  };

	  _proto2._initGL = function _initGL() {
	    var layer = this.layer;
	    var gl = this.gl;
	    var extensions = layer.options['extensions'];

	    if (extensions) {
	      extensions.forEach(function (ext) {
	        gl.getExtension(ext);
	      });
	    }

	    var optionalExtensions = layer.options['optionalExtensions'];

	    if (optionalExtensions) {
	      optionalExtensions.forEach(function (ext) {
	        gl.getExtension(ext);
	      });
	    }

	    this.gl.clearColor(0.0, 0.0, 0.0, 0.0);
	  };

	  _proto2.clearCanvas = function clearCanvas() {
	    _maptalks$renderer$Ca.prototype.clearCanvas.call(this);

	    var gl = this.glCtx;
	    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
	    gl.clear(gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	  };

	  _proto2.resizeCanvas = function resizeCanvas() {
	    _maptalks$renderer$Ca.prototype.resizeCanvas.call(this);

	    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
	    this.forEachRenderer(function (renderer) {
	      if (renderer.canvas) {
	        renderer.resizeCanvas();
	      }
	    });
	  };

	  _proto2.getCanvasImage = function getCanvasImage() {
	    this.forEachRenderer(function (renderer) {
	      renderer.getCanvasImage();
	    });
	    return _maptalks$renderer$Ca.prototype.getCanvasImage.call(this);
	  };

	  _proto2.forEachRenderer = function forEachRenderer(fn) {
	    var layers = this.layer.getLayers();

	    for (var _iterator6 = layers, _isArray6 = Array.isArray(_iterator6), _i6 = 0, _iterator6 = _isArray6 ? _iterator6 : _iterator6[Symbol.iterator]();;) {
	      var _ref6;

	      if (_isArray6) {
	        if (_i6 >= _iterator6.length) break;
	        _ref6 = _iterator6[_i6++];
	      } else {
	        _i6 = _iterator6.next();
	        if (_i6.done) break;
	        _ref6 = _i6.value;
	      }

	      var layer = _ref6;
	      var renderer = layer.getRenderer();

	      if (renderer) {
	        fn(renderer, layer);
	      }
	    }
	  };

	  _proto2._createGLContext = function _createGLContext(canvas, options) {
	    var names = ['webgl', 'experimental-webgl'];
	    var gl = null;

	    for (var i = 0; i < names.length; ++i) {
	      try {
	        gl = canvas.getContext(names[i], options);
	      } catch (e) {}

	      if (gl) {
	        break;
	      }
	    }

	    return gl;
	  };

	  _proto2.onRemove = function onRemove() {
	    if (this.canvas.pickingFBO && this.canvas.pickingFBO.destroy) {
	      this.canvas.pickingFBO.destroy();
	    }

	    _maptalks$renderer$Ca.prototype.onRemove.call(this);
	  };

	  return Renderer;
	}(maptalks.renderer.CanvasRenderer);

	GroupGLLayer.registerRenderer('gl', Renderer$1);
	GroupGLLayer.registerRenderer('canvas', null);

	function empty() {}

	if (typeof window !== 'undefined') {
	  if (window.maptalks) window.maptalks.GroupGLLayer = GroupGLLayer;
	}

	exports.createREGL = regl;
	exports.reshader = reshadergl_es;
	exports.glMatrix = common;
	exports.mat2 = mat2;
	exports.mat2d = mat2d;
	exports.mat3 = mat3;
	exports.mat4 = mat4;
	exports.quat = quat;
	exports.quat2 = quat2;
	exports.vec2 = vec2;
	exports.vec3 = vec3;
	exports.vec4 = vec4;
	exports.GroupGLLayer = GroupGLLayer;
	exports.GLContext = T;

	Object.defineProperty(exports, '__esModule', { value: true });

	typeof console !== 'undefined' && console.log('@maptalks/gl v0.2.4');

}));