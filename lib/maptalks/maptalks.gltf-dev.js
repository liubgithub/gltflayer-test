/*!
 * @maptalks/gltf-layer v0.1.7
 * LICENSE : UNLICENSED
 * (c) 2016-2019 maptalks.org
 */
(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('maptalks'), require('@maptalks/gl')) :
  typeof define === 'function' && define.amd ? define(['exports', 'maptalks', '@maptalks/gl'], factory) :
  (global = global || self, factory(global.maptalks = global.maptalks || {}, global.maptalks, global.maptalksgl));
}(this, function (exports, maptalks, gl) { 'use strict';

  function _inheritsLoose(subClass, superClass) {
    subClass.prototype = Object.create(superClass.prototype);
    subClass.prototype.constructor = subClass;
    subClass.__proto__ = superClass;
  }

  var types = ['Unknown', 'Point', 'LineString', 'Polygon', 'MultiPoint', 'MultiLineString', 'MultiPolygon', 'GeometryCollection'];
  function createFilter(filter) {
    return new Function('f', "var p = (f && f.properties || {}); return " + compile(filter));
  }

  function compile(filter) {
    if (!filter) return 'true';
    var op = filter[0];
    if (filter.length <= 1) return op === 'any' ? 'false' : 'true';
    var str = op === '==' ? compileComparisonOp(filter[1], filter[2], '===', false) : op === '!=' ? compileComparisonOp(filter[1], filter[2], '!==', false) : op === '<' || op === '>' || op === '<=' || op === '>=' ? compileComparisonOp(filter[1], filter[2], op, true) : op === 'any' ? compileLogicalOp(filter.slice(1), '||') : op === 'all' ? compileLogicalOp(filter.slice(1), '&&') : op === 'none' ? compileNegation(compileLogicalOp(filter.slice(1), '||')) : op === 'in' ? compileInOp(filter[1], filter.slice(2)) : op === '!in' ? compileNegation(compileInOp(filter[1], filter.slice(2))) : op === 'has' ? compileHasOp(filter[1]) : op === '!has' ? compileNegation(compileHasOp(filter[1])) : 'true';
    return "(" + str + ")";
  }

  function compilePropertyReference(property) {
    return property[0] === '$' ? 'f.' + property.substring(1) : 'p[' + JSON.stringify(property) + ']';
  }

  function compileComparisonOp(property, value, op, checkType) {
    var left = compilePropertyReference(property);
    var right = property === '$type' ? types.indexOf(value) : JSON.stringify(value);
    return (checkType ? "typeof " + left + "=== typeof " + right + "&&" : '') + left + op + right;
  }

  function compileLogicalOp(expressions, op) {
    return expressions.map(compile).join(op);
  }

  function compileInOp(property, values) {
    if (property === '$type') values = values.map(function (value) {
      return types.indexOf(value);
    });
    var left = JSON.stringify(values.sort(compare));
    var right = compilePropertyReference(property);
    if (values.length <= 200) return left + ".indexOf(" + right + ") !== -1";
    return "function(v, a, i, j) {\n        while (i <= j) { var m = (i + j) >> 1;\n            if (a[m] === v) return true; if (a[m] > v) j = m - 1; else i = m + 1;\n        }\n    return false; }(" + right + ", " + left + ",0," + (values.length - 1) + ")";
  }

  function compileHasOp(property) {
    return property === '$id' ? '"id" in f' : JSON.stringify(property) + " in p";
  }

  function compileNegation(expression) {
    return "!(" + expression + ")";
  }

  function compare(a, b) {
    return a < b ? -1 : a > b ? 1 : 0;
  }
  function compileStyle(styles) {
    if (!Array.isArray(styles)) {
      return compileStyle([styles]);
    }

    var compiled = [];

    for (var i = 0; i < styles.length; i++) {
      var filter = void 0;

      if (styles[i]['filter'] === true) {
        filter = function filter() {
          return true;
        };
      } else {
        filter = createFilter(styles[i]['filter']);
      }

      compiled.push(extend({}, styles[i], {
        filter: filter
      }));
    }

    return compiled;
  }

  function extend(dest) {
    for (var i = 1; i < arguments.length; i++) {
      var src = arguments[i];

      for (var k in src) {
        dest[k] = src[k];
      }
    }

    return dest;
  }

  function isNil(obj) {
    return obj == null;
  }
  function defined(obj) {
    return !isNil(obj);
  }
  function isEmptyObject(e) {
    var t;

    for (t in e) {
      return !1;
    }

    return !0;
  }
  function intersectArray(a, b) {
    var bSet = new Set(b);
    return Array.from(new Set(a.filter(function (v) {
      return bSet.has(v);
    })));
  }
  function decompose(mat, translation, quaternion, scale) {
    var sx = length(mat.slice(0, 3));
    var sy = length(mat.slice(4, 7));
    var sz = length(mat.slice(8, 11));
    var det = determinate(mat);

    if (det < 0) {
      sx = -sx;
    }

    translation[0] = mat[12];
    translation[1] = mat[13];
    translation[2] = mat[14];
    var matrix = copy(mat);
    var invSX = 1 / sx;
    var invSY = 1 / sy;
    var invSZ = 1 / sz;
    matrix[0] *= invSX;
    matrix[1] *= invSX;
    matrix[2] *= invSX;
    matrix[4] *= invSY;
    matrix[5] *= invSY;
    matrix[6] *= invSY;
    matrix[8] *= invSZ;
    matrix[9] *= invSZ;
    matrix[10] *= invSZ;
    quatFromRotationMatrix(matrix, quaternion);
    scale[0] = sx;
    scale[1] = sy;
    scale[2] = sz;
  }

  function length(v) {
    return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  }

  function quatFromRotationMatrix(m, dst) {
    var m11 = m[0];
    var m12 = m[4];
    var m13 = m[8];
    var m21 = m[1];
    var m22 = m[5];
    var m23 = m[9];
    var m31 = m[2];
    var m32 = m[6];
    var m33 = m[10];
    var trace = m11 + m22 + m33;

    if (trace > 0) {
      var s = 0.5 / Math.sqrt(trace + 1);
      dst[3] = 0.25 / s;
      dst[0] = (m32 - m23) * s;
      dst[1] = (m13 - m31) * s;
      dst[2] = (m21 - m12) * s;
    } else if (m11 > m22 && m11 > m33) {
      var _s = 2 * Math.sqrt(1 + m11 - m22 - m33);

      dst[3] = (m32 - m23) / _s;
      dst[0] = 0.25 * _s;
      dst[1] = (m12 + m21) / _s;
      dst[2] = (m13 + m31) / _s;
    } else if (m22 > m33) {
      var _s2 = 2 * Math.sqrt(1 + m22 - m11 - m33);

      dst[3] = (m13 - m31) / _s2;
      dst[0] = (m12 + m21) / _s2;
      dst[1] = 0.25 * _s2;
      dst[2] = (m23 + m32) / _s2;
    } else {
      var _s3 = 2 * Math.sqrt(1 + m33 - m11 - m22);

      dst[3] = (m21 - m12) / _s3;
      dst[0] = (m13 + m31) / _s3;
      dst[1] = (m23 + m32) / _s3;
      dst[2] = 0.25 * _s3;
    }
  }

  function copy(src, dst) {
    dst = dst || new Float32Array(16);
    dst[0] = src[0];
    dst[1] = src[1];
    dst[2] = src[2];
    dst[3] = src[3];
    dst[4] = src[4];
    dst[5] = src[5];
    dst[6] = src[6];
    dst[7] = src[7];
    dst[8] = src[8];
    dst[9] = src[9];
    dst[10] = src[10];
    dst[11] = src[11];
    dst[12] = src[12];
    dst[13] = src[13];
    dst[14] = src[14];
    dst[15] = src[15];
    return dst;
  }

  function determinate(m) {
    var m00 = m[0 * 4 + 0];
    var m01 = m[0 * 4 + 1];
    var m02 = m[0 * 4 + 2];
    var m03 = m[0 * 4 + 3];
    var m10 = m[1 * 4 + 0];
    var m11 = m[1 * 4 + 1];
    var m12 = m[1 * 4 + 2];
    var m13 = m[1 * 4 + 3];
    var m20 = m[2 * 4 + 0];
    var m21 = m[2 * 4 + 1];
    var m22 = m[2 * 4 + 2];
    var m23 = m[2 * 4 + 3];
    var m30 = m[3 * 4 + 0];
    var m31 = m[3 * 4 + 1];
    var m32 = m[3 * 4 + 2];
    var m33 = m[3 * 4 + 3];
    var tmp0 = m22 * m33;
    var tmp1 = m32 * m23;
    var tmp2 = m12 * m33;
    var tmp3 = m32 * m13;
    var tmp4 = m12 * m23;
    var tmp5 = m22 * m13;
    var tmp6 = m02 * m33;
    var tmp7 = m32 * m03;
    var tmp8 = m02 * m23;
    var tmp9 = m22 * m03;
    var tmp10 = m02 * m13;
    var tmp11 = m12 * m03;
    var t0 = tmp0 * m11 + tmp3 * m21 + tmp4 * m31 - (tmp1 * m11 + tmp2 * m21 + tmp5 * m31);
    var t1 = tmp1 * m01 + tmp6 * m21 + tmp9 * m31 - (tmp0 * m01 + tmp7 * m21 + tmp8 * m31);
    var t2 = tmp2 * m01 + tmp7 * m11 + tmp10 * m31 - (tmp3 * m01 + tmp6 * m11 + tmp11 * m31);
    var t3 = tmp5 * m01 + tmp8 * m11 + tmp11 * m21 - (tmp4 * m01 + tmp9 * m11 + tmp10 * m21);
    return 1.0 / (m00 * t0 + m10 * t1 + m20 * t2 + m30 * t3);
  }

  var commonjsGlobal = typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

  function createCommonjsModule(fn, module) {
  	return module = { exports: {} }, fn(module, module.exports), module.exports;
  }

  var zousanMin = createCommonjsModule(function (module) {
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
    }("undefined" != typeof commonjsGlobal ? commonjsGlobal : commonjsGlobal);
  });

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

  function fromRotationTranslationScale(out, q, v, s) {
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

  function create$4() {
    var out = new ARRAY_TYPE(3);

    if (ARRAY_TYPE != Float32Array) {
      out[0] = 0;
      out[1] = 0;
      out[2] = 0;
    }

    return out;
  }
  function length$1(a) {
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
  var len = length$1;
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

  var s;
  var n = s = "undefined" != typeof Promise ? Promise : zousanMin;
  var i = {
    get: function get(e, t) {
      var r = i._getClient(),
          s = new n(function (s, n) {
        if (r.open("GET", e, !0), t) {
          for (var _e in t.headers) {
            r.setRequestHeader(_e, t.headers[_e]);
          }

          r.withCredentials = "include" === t.credentials, t.responseType && (r.responseType = t.responseType);
        }

        r.onreadystatechange = i._wrapCallback(r, function (e, t) {
          e ? n(e) : s(t);
        }), r.send(null);
      });

      return s.xhr = r, s;
    },
    _wrapCallback: function _wrapCallback(e, t) {
      return function () {
        if (4 === e.readyState) if (200 === e.status) {
          if ("arraybuffer" === e.responseType) {
            0 === e.response.byteLength ? t(new Error("http status 200 returned without content.")) : t(null, {
              data: e.response,
              cacheControl: e.getResponseHeader("Cache-Control"),
              expires: e.getResponseHeader("Expires"),
              contentType: e.getResponseHeader("Content-Type")
            });
          } else t(null, e.responseText);
        } else {
          if (0 === e.status) return;
          t(new Error(e.statusText + "," + e.status));
        }
      };
    },
    _getClient: function _getClient() {
      var e;

      try {
        e = new XMLHttpRequest();
      } catch (t) {
        try {
          e = new ActiveXObject("Msxml2.XMLHTTP");
        } catch (t) {
          try {
            e = new ActiveXObject("Microsoft.XMLHTTP");
          } catch (e) {}
        }
      }

      return e;
    },
    getArrayBuffer: function getArrayBuffer(e, t) {
      return t || (t = {}), t.responseType = "arraybuffer", i.get(e, t);
    }
  };

  function a(e) {
    return null == e;
  }

  function o(e) {
    return !a(e);
  }

  function u(e) {
    return "number" == typeof e && isFinite(e);
  }

  function h(e) {
    for (var _t = 1; _t < arguments.length; _t++) {
      var _r = arguments[_t];

      for (var _t2 in _r) {
        e[_t2] = _r[_t2];
      }
    }

    return e;
  }

  i.getJSON = function (e, t) {
    var r = i.get(e, t),
        s = r.then(function (e) {
      return e ? JSON.parse(e) : null;
    });
    return s.xhr = r.xhr, s;
  };

  var l = function () {
    function l(e, t) {
      this.rootPath = e, this.gltf = t;
    }

    var _proto = l.prototype;

    _proto.iterate = function iterate(e, t) {
      var r = this.gltf[t];
      if (!r) return;
      var s = 0;

      for (var _t3 in r) {
        e(_t3, r[_t3], s++);
      }
    };

    _proto.createNode = function createNode(e, t) {
      var r = {};
      return o(e.name) && (r.name = e.name), o(e.children) && (r.children = e.children), o(e.jointName) && (r.jointName = e.jointName), o(e.matrix) && (r.matrix = e.matrix), o(e.rotation) && (r.rotation = e.rotation), o(e.scale) && (r.scale = e.scale), o(e.translation) && (r.translation = e.translation), o(e.extras) && (r.extras = e.extras), o(e.meshes) && (r.meshes = e.meshes.map(function (e) {
        return t[e];
      })), r;
    };

    _proto.getBaseColorTexture = function getBaseColorTexture(e) {
      var t = this.gltf.materials[e];
      var r, s;
      if (void 0 === (s = t.instanceTechnique && t.instanceTechnique.values ? (r = t.instanceTechnique).values.diffuse : (r = t).values.tex || r.values.diffuse) || void 0 === this.gltf.textures) return null;
      var n = this.gltf.textures[s];
      if (!n) return null;
      var i = this.gltf.samplers[n.sampler];
      return {
        format: n.format || 6408,
        internalFormat: n.internalFormat || 6408,
        type: n.type || 5121,
        sampler: i,
        source: this.gltf.images[n.source]
      };
    };

    _proto.getMaterial = function getMaterial() {
      return null;
    };

    _proto.getAnimations = function getAnimations() {
      return null;
    };

    return l;
  }();

  var f = ["SCALAR", 1, "VEC2", 2, "VEC3", 3, "VEC4", 4, "MAT2", 4, "MAT3", 9, "MAT4", 16];

  var c = function () {
    function c(e, t, r) {
      this.rootPath = e, this.gltf = t, this.glbBuffer = r, this.buffers = {}, this.requests = {};
    }

    var _proto2 = c.prototype;

    _proto2._requestData = function _requestData(e, t) {
      var _this = this;

      var r = this.gltf,
          s = r.accessors[t],
          a = r.bufferViews[s.bufferView],
          o = r.buffers[a.buffer];

      if ("binary_glTF" !== a.buffer && "KHR_binary_glTF" !== a.buffer && o.uri) {
        var _r2 = o.uri,
            _s = 0 === o.uri.indexOf("data:application/") ? o.uri : this.rootPath + "/" + _r2;

        return this.requests[_s] ? this.requests[_s].then(function () {
          var _this$_toTypedArray = _this._toTypedArray(t, _this.buffers[_s]),
              r = _this$_toTypedArray.array,
              n = _this$_toTypedArray.itemSize;

          return {
            name: e,
            accessorName: t,
            array: r,
            itemSize: n
          };
        }) : this.requests[_s] = i.getArrayBuffer(_s, null).then(function (r) {
          var n = r.data;
          _this.buffers[_s] = n;

          var _this$_toTypedArray2 = _this._toTypedArray(t, n),
              i = _this$_toTypedArray2.array,
              a = _this$_toTypedArray2.itemSize;

          return {
            name: e,
            accessorName: t,
            array: i,
            itemSize: a
          };
        });
      }

      {
        var _this$_toTypedArray3 = this._toTypedArray(t, this.glbBuffer.buffer, this.glbBuffer.byteOffset),
            _r3 = _this$_toTypedArray3.array,
            _s2 = _this$_toTypedArray3.itemSize;

        return n.resolve({
          name: e,
          accessorName: t,
          array: _r3,
          itemSize: _s2
        });
      }
    };

    _proto2._toTypedArray = function _toTypedArray(e, t, r) {
      if (r === void 0) {
        r = 0;
      }

      var s = this.gltf,
          n = s.accessors[e];
      var i = (s.bufferViews[n.bufferView].byteOffset || 0) + (n.byteOffset || 0) + r;

      var a = this._getTypeItemSize(n.type),
          o = this._getArrayCtor(n.componentType),
          u = n.byteStride;

      return u && u !== a * o.BYTES_PER_ELEMENT ? (console.warn("GLTF interleaved accessors not supported"), new o([])) : (i % o.BYTES_PER_ELEMENT != 0 && (t = t.slice(i, i + n.count * a * o.BYTES_PER_ELEMENT), i = 0), {
        array: new o(t, i, n.count * a),
        itemSize: a
      });
    };

    _proto2._getArrayCtor = function _getArrayCtor(e) {
      switch (e) {
        case 5120:
          return Int8Array;

        case 5121:
          return Uint8Array;

        case 5122:
          return Int16Array;

        case 5123:
          return Uint16Array;

        case 5124:
          return Int32Array;

        case 5125:
          return Uint32Array;

        case 5126:
          return Float32Array;
      }

      throw new Error("unsupported bufferView's componeng type: " + e);
    };

    _proto2._getTypeItemSize = function _getTypeItemSize(e) {
      var t = f.indexOf(e);
      return f[t + 1];
    };

    return c;
  }();

  var g = function () {
    function g(e, t, r, s) {
      this.rootPath = e, this.gltf = t, this.glbBuffer = r, this.buffers = {}, this.requests = {}, this._requestImage = s, this.accessor = new c(e, t, r);
    }

    var _proto3 = g.prototype;

    _proto3.iterate = function iterate(e, t) {
      var r = this.gltf[t];
      if (r) for (var _t4 = 0; _t4 < r.length; _t4++) {
        e(_t4, r[_t4], _t4);
      }
    };

    _proto3.createNode = function createNode(e, t, r) {
      var s = {};
      return h(s, e), o(e.mesh) && (s.meshes = [t[e.mesh]]), o(e.skin) && (s.skin = r[e.skin], s.skinIndex = e.skin), s;
    };

    _proto3.getMaterial = function getMaterial(e) {
      var t = this.gltf.materials[e],
          r = t.pbrMetallicRoughness,
          s = t.normalTexture,
          i = t.occlusionTexture,
          a = t.emissiveTexture,
          o = [];
      return r && o.push(this._getPbrMetallicRoughness(r)), s && o.push(this._getTextureInfo(s, "normalTexture")), i && o.push(this._getTextureInfo(i, "occlusionTexture")), a && o.push(this._getTextureInfo(a, "emissiveTexture")), n.all(o).then(function (e) {
        var r = {};
        h(r, t);

        for (var _t5 = 0; _t5 < e.length; _t5++) {
          r[e[_t5].name] = e[_t5];
        }

        return {
          material: r
        };
      });
    };

    _proto3._getPbrMetallicRoughness = function _getPbrMetallicRoughness(e) {
      var t = e.baseColorTexture,
          r = e.metallicRoughnessTexture;
      e.name = "pbrMetallicRoughness";
      var s = [];
      return t && s.push(this._getTextureInfo(t, "baseColorTexture")), r && s.push(this._getTextureInfo(r, "metallicRoughnessTexture")), n.all(s).then(function (t) {
        var r = {};
        h(r, e);

        for (var _e2 = 0; _e2 < t.length; _e2++) {
          delete t[_e2].index, r[t[_e2].name] = t[_e2];
        }

        return r;
      });
    };

    _proto3._getTextureInfo = function _getTextureInfo(e, t) {
      var r = e.index;
      return o(r) ? (e.name = t, this._getTexture(r).then(function (t) {
        var r = {
          texture: t
        };
        return h(r, e), delete r.index, r;
      })) : null;
    };

    _proto3._getTexture = function _getTexture(e) {
      var _this2 = this;

      var t = this.gltf.textures[e];
      if (!t) return null;
      var r = this.gltf.images[t.source];
      return this._loadImage(r).then(function (e) {
        var s = {
          image: {
            array: e.data,
            width: e.width,
            height: e.height,
            index: t.source,
            mimeType: r.mimeType,
            name: r.name,
            extensions: r.extensions,
            extras: r.extras
          }
        };
        h(s, t), delete s.sampler;
        var n = o(t.sampler) ? _this2.gltf.samplers[t.sampler] : void 0;
        return n && (s.sampler = n), s;
      });
    };

    _proto3._loadImage = function _loadImage(e) {
      if (!o(e.bufferView)) {
        var _t6 = e.uri,
            _r4 = 0 === _t6.indexOf("data:image/") ? _t6 : this.rootPath + "/" + _t6;

        return this._requestFromUrl(_r4);
      }

      {
        var _t7 = this.gltf.bufferViews[e.bufferView];
        if (this.buffers[e.bufferView]) return n.resolve(this.buffers[e.bufferView]);
        var _r5 = this.gltf.buffers[_t7.buffer];
        if (_r5.uri) return this._requestFromArrayBuffer(_r5.uri, _t7, e);
        if (this.glbBuffer) return this._requestFromGlbBuffer(_t7, e);
      }
      return null;
    };

    _proto3._requestFromUrl = function _requestFromUrl(e) {
      var _this3 = this;

      if (this.requests[e]) return this.requests[e].then(function () {
        return _this3.buffers[e];
      });
      return this.requests[e] = this._getImageInfo(e, e);
    };

    _proto3._requestFromArrayBuffer = function _requestFromArrayBuffer(e, t, r) {
      var _this4 = this;

      var s = r.bufferView;
      return this.requests[e] ? this.requests[e].then(function () {
        return _this4.buffers[s];
      }) : i.getArrayBuffer(e, null).then(function (e) {
        var n = e.data,
            i = _this4._createDataView(t, n),
            a = new Blob([i], {
          type: r.mimeType
        }),
            o = URL.createObjectURL(a);

        return _this4._getImageInfo(s, o);
      });
    };

    _proto3._requestFromGlbBuffer = function _requestFromGlbBuffer(e, t) {
      var r = this._createDataView(e, this.glbBuffer.buffer, this.glbBuffer.byteOffset),
          s = new Blob([r], {
        type: t.mimeType
      }),
          n = URL.createObjectURL(s);

      return this._getImageInfo(t.bufferView, n);
    };

    _proto3._getImageInfo = function _getImageInfo(e, t) {
      var _this5 = this;

      return new n(function (r, s) {
        _this5._requestImage(t, function (t, n) {
          t ? s(t) : (_this5.buffers[e] = n, r(_this5.buffers[e]));
        });
      });
    };

    _proto3._createDataView = function _createDataView(e, t, r) {
      r = r || 0;
      var s = e.byteOffset + r,
          n = e.byteLength;
      return t.slice(s, s + n);
    };

    _proto3._transformArrayBufferToBase64 = function _transformArrayBufferToBase64(e, t) {
      var r = new Array(e.byteLength);

      for (var _t8 = 0; _t8 < e.byteLength; _t8++) {
        r[_t8] = String.fromCharCode(e[_t8]);
      }

      return r.join(""), "data:" + (t = t || "image/png") + ";base64," + window.btoa(unescape(encodeURIComponent(r)));
    };

    _proto3.getAnimations = function getAnimations(e) {
      var _this6 = this;

      var t = [];
      return e.forEach(function (e) {
        t.push(_this6.getSamplers(e.samplers));
      }), n.all(t).then(function (t) {
        for (var _r6 = 0; _r6 < t.length; _r6++) {
          e[_r6].samplers = t[_r6];
        }

        return e;
      });
    };

    _proto3.getSamplers = function getSamplers(e) {
      var t = [];

      for (var _r7 = 0; _r7 < e.length; _r7++) {
        (o(e[_r7].input) || o(e[_r7].output)) && (t.push(this.accessor._requestData("input", e[_r7].input)), t.push(this.accessor._requestData("output", e[_r7].output)));
      }

      return n.all(t).then(function (t) {
        for (var _r8 = 0; _r8 < t.length / 2; _r8++) {
          e[_r8].input = t[2 * _r8], e[_r8].output = t[2 * _r8 + 1], e[_r8].interpolation || (e[_r8].interpolation = "LINEAR");
        }

        return e;
      });
    };

    return g;
  }();

  var m = "undefined" != typeof TextDecoder ? new TextDecoder("utf-8") : null,
      p = 12,
      d = {
    JSON: 1313821514,
    BIN: 5130562
  };

  var b = function () {
    function b() {}

    b.read = function read(e, t) {
      if (t === void 0) {
        t = 0;
      }

      var r = new DataView(e, t),
          s = r.getUint32(4, !0);
      if (1 === s) return b.readV1(r, t);
      if (2 === s) return b.readV2(e, t);
      throw new Error("Unsupported glb version : " + s);
    };

    b.readV1 = function readV1(e, t) {
      var r = e.getUint32(8, !0),
          s = e.getUint32(12, !0);
      if (r !== e.buffer.byteLength - t) throw new Error("Length in GLB header is inconsistent with glb's byte length.");
      var n = x(e.buffer, 20 + t, s);
      return {
        json: JSON.parse(n),
        glbBuffer: {
          byteOffset: 20 + t + s,
          buffer: e.buffer
        }
      };
    };

    b.readV2 = function readV2(e, t) {
      var r, s;
      var n = new DataView(e, p);
      var i = 0;

      for (; i < n.byteLength;) {
        var _t9 = n.getUint32(i, !0);

        i += 4;

        var _a = n.getUint32(i, !0);

        if (i += 4, _a === d.JSON) r = x(e, p + i, _t9);else if (_a === d.BIN) {
          var _r9 = p + i;

          s = e.slice(_r9, _r9 + _t9);
        }
        i += _t9;
      }

      return {
        json: JSON.parse(r),
        glbBuffer: {
          byteOffset: t,
          buffer: s
        }
      };
    };

    return b;
  }();

  function x(e, t, r) {
    if (m) {
      var _s3 = new Uint8Array(e, t, r);

      return m.decode(_s3);
    }

    return function (e) {
      var t = e.length;
      var r = "";

      for (var _s4 = 0; _s4 < t;) {
        var _n = e[_s4++];

        if (128 & _n) {
          var _r10 = _[_n >> 3 & 7];
          if (!(64 & _n) || !_r10 || _s4 + _r10 > t) return null;

          for (_n &= 63 >> _r10; _r10 > 0; _r10 -= 1) {
            var _t10 = e[_s4++];
            if (128 != (192 & _t10)) return null;
            _n = _n << 6 | 63 & _t10;
          }
        }

        r += String.fromCharCode(_n);
      }

      return r;
    }(new Uint8Array(e, t, r));
  }

  var _ = [1, 1, 1, 1, 2, 2, 3, 0];
  var y = {
    _getTRSW: function _getTRSW(e, t, r, s) {
      var _this7 = this;

      return e.animations.forEach(function (e) {
        var n = e.channels;

        for (var _i = 0; _i < n.length; _i++) {
          var _a2 = n[_i];
          _a2.target.node === r && ("translation" === _a2.target.path ? t.T = _this7._getAnimateData(t.T, e.samplers[_a2.sampler], s, 1) : "rotation" === _a2.target.path ? t.R = _this7._getQuaternion(t.R, e.samplers[_a2.sampler], s, 1) : "scale" === _a2.target.path ? t.S = _this7._getAnimateData(t.S, e.samplers[_a2.sampler], s, 1) : "weights" === _a2.target.path && (t.W = _this7._getAnimateData(t.W, e.samplers[_a2.sampler], s, t.W.length)));
        }
      }), t;
    },
    _getAnimateData: function _getAnimateData(e, t, r, s) {
      switch (t.interpolation) {
        case "LINEAR":
          {
            var _n2 = this._getPreNext(t, r, 1 * s);

            _n2 && (e = function (e, t, r, s) {
              return e = e.map(function (e, n) {
                return t[n] + s * (r[n] - t[n]);
              });
            }(e, _n2.previous, _n2.next, _n2.interpolation.value));
            break;
          }

        case "STEP":
          {
            var _n3 = this._getPreNext(t, r, 1 * s);

            _n3 && (e = _n3.previous);
            break;
          }

        case "CUBICSPLINE":
          {
            var _n4 = this._getPreNext(t, r, 3 * s);

            _n4 && (e = this._getCubicSpline(_n4.interpolation, _n4.previous, _n4.next, t.input.array, 3 * s));
            break;
          }
      }

      return e;
    },
    _getQuaternion: function _getQuaternion(e, r, s) {
      switch (r.interpolation) {
        case "LINEAR":
          {
            var _n5 = this._getPreNext(r, s, 1);

            _n5 && slerp(e, _n5.previous, _n5.next, _n5.interpolation.value);
            break;
          }

        case "STEP":
          {
            var _t11 = this._getPreNext(r, s, 1);

            _t11 && (e = _t11.previous);
            break;
          }

        case "CUBICSPLINE":
          {
            var _t12 = this._getPreNext(r, s, 3);

            _t12 && (_t12.previous = _t12.previous.map(function (e) {
              return Math.acos(e);
            }), _t12.next = _t12.next.map(function (e) {
              return Math.acos(e);
            }), e = (e = this._getCubicSpline(_t12.interpolation, _t12.previous, _t12.next, r.input.array, 3)).map(function (e) {
              return Math.cos(e);
            }));
            break;
          }
      }

      return e;
    },
    _getPreNext: function _getPreNext(e, t, r) {
      var s = e.input.array,
          n = e.output.array,
          i = e.output.itemSize,
          a = this._getInterpolation(s, t);

      return a ? {
        previous: n.slice(a.preIndex * i * r, (a.preIndex + 1) * i * r),
        next: n.slice(a.nextIndex * i * r, (a.nextIndex + 1) * i * r),
        interpolation: a
      } : null;
    },
    _getInterpolation: function _getInterpolation(e, t) {
      (t < e[0] || t > e[e.length - 1]) && (t = Math.max(e[0], Math.min(e[e.length - 1], t))), t === e[e.length - 1] && (t = e[0]);

      for (var _r11 = 0; _r11 < e.length - 1; _r11++) {
        if (t >= e[_r11] && t < e[_r11 + 1]) {
          var _s5 = e[_r11];
          return {
            preIndex: _r11,
            nextIndex: _r11 + 1,
            value: (t - _s5) / (e[_r11 + 1] - _s5)
          };
        }
      }

      return null;
    },
    _getCubicSpline: function _getCubicSpline(e, t, r, s, n) {
      var i = e.value,
          a = t.slice(n, 2 * n),
          o = t.slice(2 * n, 3 * n),
          u = s[e.preIndex],
          h = s[e.nextIndex],
          l = r.slice(0, n),
          f = r.slice(3, 2 * n),
          c = [];

      for (var _e3 = 0; _e3 < 3; _e3++) {
        var _t13 = a[_e3],
            _r12 = (h - u) * o[_e3],
            _s6 = f[_e3],
            _n6 = (h - u) * l[_e3],
            _g = (2 * Math.pow(i, 3) - 3 * Math.pow(i, 2) + 1) * _t13 + (Math.pow(i, 3) - 2 * Math.pow(i, 2) + i) * _r12 + (2 * -Math.pow(i, 3) + 3 * Math.pow(i, 2)) * _s6 + (Math.pow(i, 3) - Math.pow(i, 2)) * _n6;

        c.push(_g);
      }

      return c;
    },
    getAnimationClip: function getAnimationClip(e, t, s) {
      var n = e.nodes[t].weights || (e.nodes[t].meshes ? e.nodes[t].meshes[0].weights : void 0),
          i = this._getTRSW(e, {
        T: [0, 0, 0],
        R: [0, 0, 0, 1],
        S: [1, 1, 1],
        W: n
      }, t, s);

      return {
        trs: fromRotationTranslationScale([], i.R, i.T, i.S),
        weights: i.W
      };
    },
    getTimeSpan: function getTimeSpan(e) {
      if (!e.animations) return null;
      var t = -1 / 0,
          r = 1 / 0;
      return e.animations.forEach(function (e) {
        var s = e.channels;

        for (var _n7 = 0; _n7 < s.length; _n7++) {
          var _i2 = s[_n7],
              _a3 = e.samplers[_i2.sampler].input.array;
          _a3[_a3.length - 1] > t && (t = _a3[_a3.length - 1]), _a3[0] < r && (r = _a3[0]);
        }
      }), {
        max: t,
        min: r
      };
    }
  },
      w = "undefined" == typeof document ? null : document.createElement("canvas");

  var T = function () {
    function T(e, t, r) {
      if (this.options = r || {}, t.buffer instanceof ArrayBuffer) {
        var _b$read = b.read(t.buffer, t.byteOffset),
            _r13 = _b$read.json,
            _s7 = _b$read.glbBuffer;

        this._init(e, _r13, _s7);
      } else this._init(e, t);
    }

    var _proto4 = T.prototype;

    _proto4.load = function load() {
      var e = this._loadScene(),
          t = this._loadAnimations();

      return n.all([e, t]).then(function (e) {
        return e[0].animations = e[1], e[0];
      });
    };

    T.getAnimationClip = function getAnimationClip(e, t, r) {
      return y.getAnimationClip(e, t, r);
    };

    T.getAnimationTimeSpan = function getAnimationTimeSpan(e) {
      return y.getTimeSpan(e);
    };

    _proto4._init = function _init(e, t, r) {
      this.gltf = t, this.version = t.asset ? +t.asset.version : 1, this.rootPath = e, this.glbBuffer = r, this.buffers = {}, this.requests = {}, this.accessor = new c(e, t, r), this.options.requestImage = this.options.requestImage || I, 2 === this.version ? this.adapter = new g(e, t, r, this.options.requestImage) : this.adapter = new l(e, t);
    };

    _proto4._parseNodes = function _parseNodes(e, t) {
      var _this8 = this;

      if (e.children && e.children.length > 0) {
        if (!u(e.children[0]) && (a(r = e.children[0]) || "string" != typeof r && (null === r.constructor || r.constructor !== String))) return e;

        var _s8 = e.children.map(function (e) {
          var r = t[e];
          return r.nodeIndex = e, _this8._parseNodes(r, t);
        });

        e.children = _s8;
      }

      var r;

      if (o(e.skin)) {
        var _r14 = e.skin.joints;

        if (_r14 && _r14.length && u(_r14[0])) {
          var _r15 = e.skin.joints.map(function (e) {
            return t[e];
          });

          e.skin.joints = _r15;
        }
      }

      return e;
    };

    _proto4._loadScene = function _loadScene() {
      var _this9 = this;

      return this._loadNodes().then(function (e) {
        var t = _this9.scenes = [];
        var r;

        for (var _t14 in e) {
          e[_t14] = _this9._parseNodes(e[_t14], e), e[_t14].nodeIndex = Number(_t14) ? Number(_t14) : _t14;
        }

        _this9.adapter.iterate(function (s, n, i) {
          var a = {};
          n.name && (a.name = n.name), n.nodes && (a.nodes = n.nodes.map(function (t) {
            return e[t];
          })), _this9.gltf.scene === s && (r = i), t.push(a);
        }, "scenes");

        var s = {
          scene: r,
          scenes: t,
          nodes: e,
          meshes: _this9.meshes,
          skins: _this9.skins
        };
        return _this9.gltf.extensions && (s.extensions = _this9.gltf.extensions), s;
      });
    };

    _proto4._loadNodes = function _loadNodes() {
      var _this10 = this;

      return this._loadMeshes().then(function () {
        var e = _this10.nodes = {};
        return _this10.adapter.iterate(function (t, r) {
          var s = _this10.adapter.createNode(r, _this10.meshes, _this10.skins);

          e[t] = s;
        }, "nodes"), e;
      });
    };

    _proto4._loadSkins = function _loadSkins() {
      var _this11 = this;

      this.skins = {};
      var e = [];
      return this.adapter.iterate(function (t, r, s) {
        e.push(_this11._loadSkin(r).then(function (e) {
          e.index = s, _this11.skins[t] = e;
        }));
      }, "skins"), e;
    };

    _proto4._loadSkin = function _loadSkin(e) {
      var t = e.inverseBindMatrices;
      return this.accessor._requestData("inverseBindMatrices", t).then(function (t) {
        return e.inverseBindMatrices = t, e;
      });
    };

    _proto4._loadAnimations = function _loadAnimations() {
      var e = this.gltf.animations;
      return o(e) ? this.adapter.getAnimations(e) : null;
    };

    _proto4._loadMeshes = function _loadMeshes() {
      var _this12 = this;

      this.meshes = {};
      var e = [];
      return this.adapter.iterate(function (t, r, s) {
        e.push(_this12._loadMesh(r).then(function (e) {
          e.index = s, _this12.meshes[t] = e;
        }));
      }, "meshes"), e = e.concat(this._loadSkins()), n.all(e);
    };

    _proto4._loadMesh = function _loadMesh(e) {
      var _this13 = this;

      var t = e.primitives.map(function (e) {
        return _this13._loadPrimitive(e);
      });
      return n.all(t).then(function (t) {
        var r = {};
        return h(r, e), r.primitives = t, r;
      });
    };

    _proto4._loadPrimitive = function _loadPrimitive(e) {
      var _this14 = this;

      var t = [],
          r = e.attributes,
          s = this._loadMaterial(e);

      s && t.push(s);
      var i = null;

      for (var _e4 in r) {
        var _s9 = this.accessor._requestData(_e4, r[_e4]);

        _s9 && t.push(_s9);
      }

      if (o(e.indices)) {
        var _r16 = this.accessor._requestData("indices", e.indices);

        _r16 && t.push(_r16);
      }

      if (o(e.targets)) for (var _r17 = 0; _r17 < e.targets.length; _r17++) {
        var _s10 = e.targets[_r17];

        for (var _e5 in _s10) {
          var _n8 = this.accessor._requestData(_e5 + "_" + _r17, _s10[_e5]);

          _n8 && t.push(_n8);
        }
      }
      return n.all(t).then(function (t) {
        var r;
        _this14.transferables = [];
        var s = {
          attributes: t.reduce(function (e, t) {
            return t.material ? (i = t.material, t.transferables && t.transferables.forEach(function (e) {
              _this14.transferables.indexOf(e) < 0 && _this14.transferables.push(e);
            })) : ("indices" === t.name ? r = t.array : e[t.name] = {
              array: t.array,
              itemSize: t.itemSize,
              accessorName: t.accessorName
            }, _this14.transferables.indexOf(t.array.buffer) < 0 && _this14.transferables.push(t.array.buffer)), e;
          }, {}),
          material: i
        };
        return r && (s.indices = r), s.mode = o(e.mode) ? e.mode : 4, o(e.extras) && (s.extras = e.extras), s;
      });
    };

    _proto4._loadMaterial = function _loadMaterial(e) {
      var t = e.material;

      if (2 === this.version) {
        if (!o(t)) return null;
        return this.adapter.getMaterial(t);
      }

      var r = this.adapter.getBaseColorTexture(t);
      return r ? this._loadImage(r.source).then(function (e) {
        var s = [e.buffer],
            n = r.source;
        e.index = n, h(r.source, n), r.source.image = e;
        var i = {
          baseColorTexture: r
        };
        return t.name && (i.name = t.name), t.extensions && (i.extensions = t.extensions), i.extensions && (delete i.extensions.KHR_binary_glTF, delete i.extensions.binary_glTF, 0 === Object.keys(i.extensions).length && delete i.extensions), t.extras && (i.extras = t.extras), {
          material: i,
          transferables: s
        };
      }) : null;
    };

    _proto4._loadImage = function _loadImage(e) {
      var _this15 = this;

      if (e.bufferView || e.extensions && (e.extensions.KHR_binary_glTF || e.extensions.binary_glTF)) {
        var _t15 = e.bufferView ? e : e.extensions.KHR_binary_glTF || e.extensions.binary_glTF;

        if (e.extensions && (e.mimeType = _t15.mimeType, e.width = _t15.width, e.height = _t15.height), this.buffers[_t15.bufferView]) return n.resolve(this.buffers[_t15.bufferView]);

        var _r18 = this.gltf.bufferViews[_t15.bufferView],
            _s11 = (_r18.byteOffset || 0) + this.glbBuffer.byteOffset,
            _i3 = _r18.byteLength,
            _a4 = this.buffers[_t15.bufferView] = new Uint8Array(this.glbBuffer.buffer, _s11, _i3);

        return n.resolve(_a4);
      }

      {
        var _t16 = e.uri,
            _r19 = this.rootPath + "/" + _t16;

        return this.requests[_r19] ? this.requests[_r19].then(function () {
          return _this15.buffers[_r19];
        }) : this.requests[_r19] = i.getArrayBuffer(_r19, null).then(function (e) {
          var t = e.data;
          return _this15.buffers[_r19] = t, new Uint8Array(t);
        });
      }
    };

    return T;
  }();

  function I(e, t) {
    var r = new Image();
    r.onload = function () {
      if (!w) return void t(new Error("There is no canvas to draw image!"));
      w.width = r.width, w.height = r.height;
      var e = w.getContext("2d");
      e.drawImage(r, 0, 0, r.width, r.height);
      var s = e.getImageData(0, 0, r.width, r.height),
          n = {
        width: r.width,
        height: r.height,
        data: new Uint8Array(s.data)
      };
      t(null, n);
    }, r.onerror = function (e) {
      t(e);
    }, r.src = e;
  }

  var planes = [];

  for (var i$1 = 0; i$1 < 6; i$1++) {
    planes[i$1] = [];
  }
  var p$1 = [];
  function intersectsBox(matrix, box, mask) {
    setPlanes(matrix);

    for (var i = 0; i < 6; i++) {
      if (mask && mask.charAt(i) === '0') {
        continue;
      }

      var plane = planes[i];
      p$1[0] = plane[0] > 0 ? box[1][0] : box[0][0];
      p$1[1] = plane[1] > 0 ? box[1][1] : box[0][1];
      p$1[2] = plane[2] > 0 ? box[1][2] : box[0][2];

      if (distanceToPoint(plane, p$1) < 0) {
        return false;
      }
    }

    return true;
  }

  function setPlanes(m) {
    var me = m;
    var me0 = me[0],
        me1 = me[1],
        me2 = me[2],
        me3 = me[3];
    var me4 = me[4],
        me5 = me[5],
        me6 = me[6],
        me7 = me[7];
    var me8 = me[8],
        me9 = me[9],
        me10 = me[10],
        me11 = me[11];
    var me12 = me[12],
        me13 = me[13],
        me14 = me[14],
        me15 = me[15];
    setComponents(planes[0], me3 - me0, me7 - me4, me11 - me8, me15 - me12);
    setComponents(planes[1], me3 + me0, me7 + me4, me11 + me8, me15 + me12);
    setComponents(planes[2], me3 + me1, me7 + me5, me11 + me9, me15 + me13);
    setComponents(planes[3], me3 - me1, me7 - me5, me11 - me9, me15 - me13);
    setComponents(planes[4], me3 - me2, me7 - me6, me11 - me10, me15 - me14);
    setComponents(planes[5], me3 + me2, me7 + me6, me11 + me10, me15 + me14);
  }

  var normalLength = 1.0 / 6;

  function setComponents(out, x, y, z, w) {
    out[0] = x * normalLength;
    out[1] = y * normalLength;
    out[2] = z * normalLength;
    out[3] = w * normalLength;
    return out;
  }

  function distanceToPoint(plane, p) {
    return plane[0] * p[0] + plane[1] * p[1] + plane[2] * p[2] + plane[3];
  }

  var SHADER_MAP = {};

  var Skin = function () {
    function Skin(joints, inverseBindMatrixData, jointTexture) {
      this.joints = joints;
      this.inverseBindMatrices = [];
      this.jointMatrices = [];
      this.jointData = new Float32Array(joints.length * 16);

      for (var i = 0; i < joints.length; ++i) {
        this.inverseBindMatrices.push(new Float32Array(inverseBindMatrixData.buffer, inverseBindMatrixData.byteOffset + Float32Array.BYTES_PER_ELEMENT * 16 * i, 16));
        this.jointMatrices.push(new Float32Array(this.jointData.buffer, Float32Array.BYTES_PER_ELEMENT * 16 * i, 16));
      }

      this.jointTexture = jointTexture;
      this.jointTextureSize = [4, 6];
    }

    var _proto = Skin.prototype;

    _proto.update = function update(nodeMatrix) {
      var globalWorldInverse = [];
      gl.mat4.invert(globalWorldInverse, nodeMatrix);

      for (var j = 0; j < this.joints.length; ++j) {
        var joint = this.joints[j];
        var dst = this.jointMatrices[j];
        gl.mat4.multiply(dst, globalWorldInverse, joint.nodeMatrix);
        gl.mat4.multiply(dst, dst, this.inverseBindMatrices[j]);
      }

      this.jointTexture({
        width: 4,
        type: 'float',
        height: this.joints.length,
        data: this.jointData
      });
    };

    return Skin;
  }();

  var TRS = function () {
    function TRS(translation, rotation, scale) {
      if (translation === void 0) {
        translation = [0, 0, 0];
      }

      if (rotation === void 0) {
        rotation = [0, 0, 0, 1];
      }

      if (scale === void 0) {
        scale = [1, 1, 1];
      }

      this.translation = translation;
      this.rotation = rotation;
      this.scale = scale;
    }

    var _proto = TRS.prototype;

    _proto.setMatrix = function setMatrix(dst) {
      dst = dst || new Float32Array(16);
      gl.mat4.fromRotationTranslationScale(dst, this.rotation, this.translation, this.scale);
      return dst;
    };

    return TRS;
  }();

  var ANIMATION_TIME = 0.0;
  var pickingVert = "\n        attribute vec3 POSITION;\n        uniform mat4 projViewMatrix;\n        uniform mat4 modelMatrix;\n\n        #ifdef USE_INSTANCE\n        #include <instance_vert>\n        #endif\n        //\u5F15\u5165fbo picking\u7684vert\u76F8\u5173\u51FD\u6570\n        #include <fbo_picking_vert>\n\n        void main()\n        {\n            #ifdef USE_INSTANCE\n                gl_Position = instance_drawInstance(POSITION, projViewMatrix);\n            #else\n                mat4 projViewModelMatrix = projViewMatrix * modelMatrix;\n                gl_Position = projViewModelMatrix * vec4(POSITION, 1.0);\n            #endif\n            //\u4F20\u5165gl_Position\u7684depth\u503C\n            fbo_picking_setData(gl_Position.w, true);\n        }";
  var morphVS = "\nattribute vec3 POSITION;\n        attribute vec3 POSITION_0;\n        attribute vec3 POSITION_1;\n        // attribute vec3 NORMAL;\n        #ifdef USE_BASECOLORTEXTURE\n            attribute vec2 TEXCOORD_0;\n            varying vec2 vTexCoords;\n        #endif\n        uniform mat4 projViewMatrix;\n        // uniform mat4 normalMatrix;\n        uniform mat4 modelMatrix;\n        uniform vec2 weights;\n        varying vec4 vFragPos;\n        // varying vec3 vNormal;\n\n        void main() {\n            gl_Position = projViewMatrix * modelMatrix * vec4(POSITION + weights.x * POSITION_0 + weights.y * POSITION_1, 1.0);\n            vFragPos = modelMatrix * vec4(POSITION, 1.0);\n            // vNormal = normalize(vec3(normalMatrix * vec4(NORMAL, 1.0)));\n            #ifdef USE_BASECOLORTEXTURE\n                vTexCoords = TEXCOORD_0;\n            #endif\n        }\n";
  var morphFS = "\nvoid main() {\n    gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);\n}\n";
  var V0 = [],
      V1 = [];
  var MODES = ['points', 'lines', 'line strip', 'line loop', 'triangles', 'triangle strip', 'triangle fan'];
  var TEXTURE_SAMPLER = {
    '9728': 'nearest',
    '9729': 'linear',
    '9984': 'nearest mipmap nearest',
    '9985': 'linear mipmap nearest',
    '9986': 'nearest mipmap linear',
    '9987': 'linear mipmap linear',
    '33071': 'clamp ro edge',
    '33684': 'mirrored repeat',
    '10497': 'repeat'
  };
  var PREFILTER_CUBE_SIZE = 512;

  var GLTFLayerRenderer = function (_maptalks$renderer$Ca) {
    _inheritsLoose(GLTFLayerRenderer, _maptalks$renderer$Ca);

    function GLTFLayerRenderer(layer) {
      var _this;

      _this = _maptalks$renderer$Ca.call(this, layer) || this;
      _this.gltfScenes = {};
      _this._geometries = {};
      _this._shaderList = {};
      _this.sign = 1.0;

      _this._initShader();

      return _this;
    }

    var _proto = GLTFLayerRenderer.prototype;

    _proto.draw = function draw(timestamp) {
      ANIMATION_TIME = timestamp;
      this.prepareCanvas();

      this._renderScene();
    };

    _proto.drawOnInteracting = function drawOnInteracting(e, timestamp) {
      ANIMATION_TIME = timestamp;

      this._renderScene();
    };

    _proto.needToRedraw = function needToRedraw() {
      for (var uid in this.layer._markerMap) {
        var marker = this.layer._markerMap[uid];

        if (marker.isDirty()) {
          return true;
        }
      }

      return _maptalks$renderer$Ca.prototype.needToRedraw.call(this);
    };

    _proto.hitDetect = function hitDetect() {
      return false;
    };

    _proto.createContext = function createContext() {
      if (this.canvas.gl && this.canvas.gl.wrap) {
        this.gl = this.canvas.gl.wrap();
      } else {
        var layer = this.layer;
        var attributes = layer.options.glOptions || {
          alpha: true,
          depth: true,
          stencil: true
        };
        this.glOptions = attributes;
        this.gl = this.gl || this._createGLContext(this.canvas, attributes);
      }

      this.regl = gl.createREGL({
        gl: this.gl,
        extensions: ['ANGLE_instanced_arrays', 'OES_texture_float', 'OES_element_index_uint', 'OES_standard_derivatives', 'EXT_shader_texture_lod'],
        optionalExtensions: this.layer.options['glExtensions'] || []
      });

      this._initRenderer();

      this.layer.fire('contextcreate', {
        context: this.gl
      });
    };

    _proto._initRenderer = function _initRenderer() {
      var map = this.layer.getMap();
      var renderer = new gl.reshader.Renderer(this.regl);
      this.renderer = renderer;
      this._uniforms = {
        'projMatrix': map.projMatrix,
        'projViewMatrix': map.projViewMatrix,
        'viewMatrix': map.viewMatrix,
        'viewPos': map.cameraPosition
      };
      this.pickingFBO = this.regl.framebuffer(map.width, map.height);
      this._picking = new gl.reshader.FBORayPicking(renderer, {
        vert: pickingVert,
        uniforms: [{
          name: 'projViewModelMatrix',
          type: 'function',
          fn: function fn(context, props) {
            return gl.mat4.multiply([], props['projViewMatrix'], props['modelMatrix']);
          }
        }, 'projViewMatrix', 'uPickingId']
      }, this.pickingFBO);
    };

    _proto._initShader = function _initShader() {
      var _this2 = this;

      var shaderMap = SHADER_MAP;

      for (var name in shaderMap) {
        var shader = shaderMap[name];

        this._registerShader(shader.name, shader.type, shader.config, shader.uniforms);
      }

      var viewport = {
        x: 0,
        y: 0,
        width: function width() {
          return _this2.canvas ? _this2.canvas.width : 1;
        },
        height: function height() {
          return _this2.canvas ? _this2.canvas.height : 1;
        }
      };
      this._morphShader = new gl.reshader.MeshShader({
        vert: morphVS,
        frag: morphFS,
        uniforms: ['projViewMatrix', 'viewPos', 'weights', {
          name: 'projViewModelMatrix',
          type: 'function',
          fn: function fn(context, props) {
            return gl.mat4.multiply([], props['projViewMatrix'], props['modelMatrix']);
          }
        }],
        defines: {},
        extraCommandProps: {
          viewport: viewport
        }
      });
    };

    _proto._updateGeometries = function _updateGeometries(marker) {
      var shader = marker.getShader();

      var geometryObject = this._geometries[marker.getUrl()];

      if (shader === 'wireframe' && geometryObject) {
        geometryObject.geometries.forEach(function (geoObject) {
          geoObject.geometry.buildUniqueVertex();

          if (!geoObject.geometry.data.aBarycentric) {
            geoObject.geometry.createBarycentric('aBarycentric');
          }
        });
      }
    };

    _proto._registerShader = function _registerShader(name, type, config, material) {
      var _this3 = this;

      var viewport = {
        x: 0,
        y: 0,
        width: function width() {
          return _this3.canvas ? _this3.canvas.width : 1;
        },
        height: function height() {
          return _this3.canvas ? _this3.canvas.height : 1;
        }
      };

      if (!config.extraCommandProps) {
        config.extraCommandProps = {};
      }

      var copyConfig = maptalks.Util.extend({}, config);
      copyConfig.extraCommandProps = maptalks.Util.extend({}, config.extraCommandProps);
      copyConfig.extraCommandProps.viewport = viewport;
      var copyUniforms = null;

      if (!(material instanceof gl.reshader.Material)) {
        copyUniforms = maptalks.Util.extend({}, material);
      }

      var shader;

      if (type.indexOf('.') > -1) {
        type = type.split('.');
        var namespace = type[0];
        type = type[1];
        shader = new gl.reshader[namespace][type](copyConfig);
      } else {
        shader = new gl.reshader[type](copyConfig);
      }

      this._shaderList[name] = {
        shader: shader,
        material: material,
        uniforms: copyUniforms
      };
      this.shaderListTest = this._shaderList;
    };

    _proto.clearCanvas = function clearCanvas() {
      if (!this.canvas) {
        return;
      }

      this.regl.clear({
        color: [0, 0, 0, 0],
        depth: 1,
        stencil: 0
      });

      _maptalks$renderer$Ca.prototype.clearCanvas.call(this);
    };

    _proto.resizeCanvas = function resizeCanvas(size) {
      _maptalks$renderer$Ca.prototype.resizeCanvas.call(this, size);

      if (this.pickingFBO) {
        this.pickingFBO.resize(this.canvas.width, this.canvas.height);
      }
    };

    _proto._renderScene = function _renderScene() {
      var _this4 = this;

      var renderCount = 0;

      if (isEmptyObject(this.gltfScenes) || !this._iblUniforms) {
        return;
      }

      var _loop = function _loop(name) {
        var visibleMarkers = _this4.layer._markerList.filter(function (marker) {
          return marker.isVisible() && marker.getShader() === name;
        });

        if (!visibleMarkers.length) {
          return "continue";
        }

        _this4._checkMarkersDirty(visibleMarkers);

        _this4._toRenderScene = _this4._createSceneInFrustum(visibleMarkers);

        if (!_this4._toRenderScene) {
          return "continue";
        }

        _this4.renderer.render(_this4._shaderList[name].shader, _this4._uniforms, _this4._toRenderScene, null);

        renderCount++;
      };

      for (var name in this._shaderList) {
        var _ret = _loop(name);

        if (_ret === "continue") continue;
      }

      this._needRefreshPicking = true;
      this.layer.fire('rendercomplete-debug', {
        count: renderCount
      });
      this.completeRender();
    };

    _proto._checkMarkersDirty = function _checkMarkersDirty(markers) {
      var _this5 = this;

      markers.forEach(function (marker) {
        if (marker.isDirty()) {
          var uid = marker._uid;

          if (!_this5.gltfScenes[uid]) {
            return;
          }

          _this5._updateSceneMatrix(uid);
        }

        if (marker.isAnimated() || marker.hasFunctionDefinition()) {
          marker.setDirty(true);
        } else {
          marker.setDirty(false);
        }
      });
    };

    _proto._createSceneInFrustum = function _createSceneInFrustum(markers) {
      var visibles = [];
      var map = this.layer.getMap();

      for (var i$$1 = 0; i$$1 < markers.length; i$$1++) {
        var marker = markers[i$$1];
        var scene = this.gltfScenes[marker._uid];

        if (!scene) {
          continue;
        }

        var meshes = scene.modelMeshes;

        for (var ii = 0; ii < meshes.length; ii++) {
          var mesh = meshes[ii];
          var uniforms = marker.getUniforms();

          this._setMeshUniforms(mesh, uniforms);

          var material = marker.getMaterial();

          for (var m in material) {
            mesh.material.set(m, material[m]);
          }

          if (mesh instanceof gl.reshader.InstancedMesh) {
            visibles.push(mesh);
            continue;
          }

          var box = mesh.geometry.boundingBox;
          var min = box.min,
              max = box.max;
          gl.vec4.set(V0, min[0], min[1], min[2], 1);
          gl.vec4.set(V1, max[0], max[1], max[2], 1);
          var boxMin = gl.vec4.transformMat4(V0, V0, mesh.localTransform),
              boxMax = gl.vec4.transformMat4(V1, V1, mesh.localTransform);

          if (intersectsBox(map.projViewMatrix, [boxMin, boxMax])) {
            mesh.setUniform('time', ANIMATION_TIME * 0.001);
            visibles.push(mesh);
          }
        }
      }

      return visibles.length ? new gl.reshader.Scene(visibles) : null;
    };

    _proto._prepareMesh = function _prepareMesh(geoObject, uid, shaderName, uniforms) {
      var marker = this.layer._markerMap[uid];
      var geometry = geoObject.geometry;

      if (shaderName === 'wireframe' && !geometry.data.aBarycentric) {
        geometry.buildUniqueVertex();
        geometry.createBarycentric('aBarycentric');
      }

      var modelMesh = this._buildMesh(uid, geoObject);

      uniforms.uPickingId = uid;

      this._setMeshUniforms(modelMesh, uniforms);

      this._setMeshDefines(shaderName, modelMesh, marker.getType());

      if (shaderName === 'phong') {
        var position = marker._getPosition() || this.layer.getMap().getCenter();
        modelMesh.setUniform('lightPosition', [position[0] + uniforms['lightPosition'][0], position[1] + uniforms['lightPosition'][1], uniforms['lightPosition'][2]]);

        if (modelMesh.primitive) {
          this._setPhongTexture(modelMesh);
        } else {
          modelMesh.setUniform('baseColorFactor', [1.0, 1.0, 1.0, 1.0]);
        }
      } else if (this._isPBRShader(shaderName)) {
        var materialMapTable = {
          lit: 'LitMaterial',
          subsurface: 'SubsurfaceMaterial',
          cloth: 'ClothMaterial'
        };

        var material = marker.getMaterial() || this._shaderList[shaderName].material;

        var materialUniforms = this._setPBRTexture(modelMesh.primitive);

        if (materialUniforms) {
          for (var u in materialUniforms) {
            if (material.set) {
              material.set(u, materialUniforms[u]);
            } else {
              material[u] = materialUniforms[u];
            }
          }
        }

        modelMesh.material = material instanceof gl.reshader.Material ? material : new gl.reshader.pbr[materialMapTable[shaderName]](material);
      }

      return modelMesh;
    };

    _proto._setMeshDefines = function _setMeshDefines(shaderName, modelMesh, markerType) {
      var defines = modelMesh.getDefines();
      defines.USE_PICKING_ID = 2;

      if (modelMesh.node && modelMesh.node.mesh.skin) {
        defines.USE_SKIN = 1;
      }

      defines = maptalks.Util.extend({}, this._getGeometryDefines(modelMesh.geometry, shaderName), defines);
      modelMesh.setDefines(defines);

      if (markerType === 'groupgltfmarker') {
        var _defines = modelMesh.getDefines();

        _defines.USE_INSTANCE = 1;
        _defines.USE_PICKING_ID = 1;
        modelMesh.setDefines(maptalks.Util.extend({
          USE_INSTANCE: 1
        }, _defines));
      }
    };

    _proto._buildMesh = function _buildMesh(uid, geoObject) {
      var _this6 = this;

      var geometry = geoObject.geometry;
      var marker = this.layer._markerMap[uid];
      var type = marker.getType();

      if (type === 'groupgltfmarker') {
        var attributes = marker._getInstanceAttributesData();

        var count = marker.getCount();
        var instanceMesh = new gl.reshader.InstancedMesh(attributes, count, geometry);

        if (this.regl) {
          instanceMesh.generateInstancedBuffers(this.regl);
        } else {
          this.layer.on('contextcreate', function () {
            instanceMesh.generateInstancedBuffers(_this6.regl);
          });
        }

        return instanceMesh;
      }

      var modelMesh = new gl.reshader.Mesh(geometry);
      modelMesh.properties.nodeIndex = geoObject.nodeIndex;
      modelMesh.properties.markerId = uid;
      modelMesh._nodeMatrix = geoObject.matrix;
      modelMesh.node = geoObject.node;
      modelMesh.primitive = geoObject.primitive;
      var mesh = geoObject.mesh;

      if (mesh && mesh.skin) {
        modelMesh.skin = mesh.skin;
        modelMesh.setUniform('jointTexture', mesh.skin.jointTexture);
        modelMesh.setUniform('jointTextureSize', mesh.skin.jointTextureSize);
        modelMesh.setUniform('numJoints', mesh.skin.joints.length);
      }

      return modelMesh;
    };

    _proto._getGeometryDefines = function _getGeometryDefines(geometry, shaderName) {
      var defines = {};
      var shader = this._shaderList[shaderName].shader;

      if (shader.getGeometryDefines) {
        defines = shader.getGeometryDefines(geometry);
        defines['HAS_DIRECTIONAL_LIGHTING'] = 1;
        defines['IBL_MAX_MIP_LEVEL'] = Math.log(PREFILTER_CUBE_SIZE) / Math.log(2) + '.0';
      }

      return defines;
    };

    _proto._extendUniforms = function _extendUniforms(marker) {
      var markerUniforms = marker.getUniforms();
      var shaderName = marker.getShader();
      var defaultUniforms = this._shaderList[shaderName].uniforms;
      var uniforms = maptalks.Util.extend({}, defaultUniforms, markerUniforms);
      return uniforms;
    };

    _proto._createScene = function _createScene(marker) {
      var _this7 = this;

      var uid = marker._uid;
      var url = marker.getUrl();
      var modelMeshes = [];
      var shaderName = marker.getShader();

      var uniforms = this._extendUniforms(marker);

      var sharedGeometry = this._geometries[url];

      if (sharedGeometry) {
        sharedGeometry.geometries.forEach(function (geoObject) {
          var modelMesh = _this7._prepareMesh(geoObject, uid, shaderName, uniforms);

          modelMeshes.push(modelMesh);
        });
        sharedGeometry.count += 1;
      } else {
        var json = marker._getGLTFData();

        this._geometries[url] = {
          uid: uid,
          json: json,
          geometries: [],
          count: 1
        };

        if (!json.scenes) {
          modelMeshes = this._createSimpleScene(json, uid, url, shaderName, uniforms);
        } else {
          modelMeshes = this._createGLTFScene(json, uid, url, shaderName, uniforms);
        }
      }

      this.gltfScenes[uid] = {
        uid: uid,
        modelMeshes: modelMeshes
      };
      marker.setDirty(true);
      this.setToRedraw();
    };

    _proto._createGLTFScene = function _createGLTFScene(json, uid, url, shaderName, uniforms) {
      var _this8 = this;

      var modelMeshes = [];
      var meshes = [];
      var nodes = json.scenes[0].nodes;
      nodes.forEach(function (node) {
        _this8._parserNode(node, meshes);
      });
      meshes.forEach(function (mesh) {
        mesh.primitives.forEach(function (primitive) {
          var modelGeometry = _this8._createGeometry(primitive);

          var geoObject = {
            nodeIndex: mesh.nodeIndex,
            markerId: uid,
            matrix: mesh.nodeMatrix,
            geometry: modelGeometry,
            primitive: primitive,
            node: mesh.node,
            mesh: mesh
          };

          _this8._geometries[url].geometries.push(geoObject);

          var modelMesh = _this8._prepareMesh(geoObject, uid, shaderName, uniforms);

          if (mesh.weights) {
            modelMesh.setUniform('weights', mesh.weights);
          }

          modelMeshes.push(modelMesh);
        });
      });
      return modelMeshes;
    };

    _proto._parserNode = function _parserNode(node, meshes) {
      if (node.isParsed) {
        return;
      }

      node.nodeMatrix = node.nodeMatrix || gl.mat4.identity([]);
      node.localMatrix = node.localMatrix || gl.mat4.identity([]);

      if (node.matrix) {
        node.trs = new TRS();
        node.trs.setMatrix(node.matrix);
      } else {
        node.trs = new TRS(node.translation, node.rotation, node.scale);
      }

      if (node.children) {
        for (var i$$1 = 0; i$$1 < node.children.length; i$$1++) {
          var child = node.children[i$$1];

          this._parserNode(child, meshes);
        }
      }

      if (defined(node.mesh)) {
        node.mesh = node.meshes[0];
        node.mesh.node = node;
        meshes.push(node.mesh);
      }

      if (node.skin) {
        var skin = node.skin;
        var jointTexture = this.regl.texture();
        node.mesh.skin = new Skin(skin.joints, skin.inverseBindMatrices.array, jointTexture);
      }

      node.isParsed = true;
    };

    _proto._createGeometry = function _createGeometry(primitive) {
      var attributes = {};

      for (var attr in primitive.attributes) {
        attributes[attr] = primitive.attributes[attr].array;
      }

      var modelGeometry = new gl.reshader.Geometry(attributes, primitive.indices, 0, {
        primitive: maptalks.Util.isNumber(primitive.mode) ? MODES[primitive.mode] : primitive.mode,
        positionAttribute: 'POSITION',
        normalAttribute: 'NORMAL',
        uv0Attribute: 'TEXCOORD_0'
      });

      if (!modelGeometry.data['TANGENT']) {
        modelGeometry.createTangent('TANGENT');
      }

      return modelGeometry;
    };

    _proto._createSimpleScene = function _createSimpleScene(json, uid, url, shaderName, uniforms) {
      var modelMeshes = [];

      var modelGeometry = this._createGeometry(json);

      var geoObject = {
        nodeIndex: null,
        markerId: uid,
        trs: [[0, 0, 0], [0, 0, 0, 1], [1, 1, 1]],
        geometry: modelGeometry,
        mesh: null
      };

      this._geometries[url].geometries.push(geoObject);

      var modelMesh = this._prepareMesh(geoObject, uid, shaderName, uniforms);

      modelMeshes.push(modelMesh);
      return modelMeshes;
    };

    _proto._setPhongTexture = function _setPhongTexture(modelMesh) {
      var primitive = modelMesh.primitive;
      var material = primitive.material.pbrMetallicRoughness;
      var baseColorTexture = material.baseColorTexture;

      if (baseColorTexture) {
        var texture = this._toTexture(baseColorTexture);

        var defines = modelMesh.getDefines();
        defines.USE_BASECOLORTEXTURE = 1;
        modelMesh.setDefines(defines);
        modelMesh.setUniform('baseColorTexture', texture);
        modelMesh.setUniform('baseColorFactor', [1.0, 1.0, 1.0, 1.0]);
      }

      if (material.baseColorFactor) {
        var baseColorFactor = material.baseColorFactor;
        modelMesh.setUniform('baseColorFactor', baseColorFactor);
      }
    };

    _proto._setPBRTexture = function _setPBRTexture(primitive) {
      if (!primitive) {
        return null;
      }

      var pbrMaterial = primitive.material.pbrMetallicRoughness;
      var metallicRoughnessTexture = pbrMaterial.metallicRoughnessTexture;
      var materialUniforms = {};
      var baseColorTexture = pbrMaterial.baseColorTexture;

      if (baseColorTexture) {
        var texture = this._toTexture(baseColorTexture);

        materialUniforms['baseColorTexture'] = texture;
      } else if (pbrMaterial.baseColorFactor) {
        materialUniforms['baseColorFactor'] = pbrMaterial.baseColorFactor;
      }

      if (metallicRoughnessTexture) {
        var _texture = this._toTexture(metallicRoughnessTexture);

        materialUniforms['metallicRoughnessTexture'] = _texture;
      } else {
        if (defined(pbrMaterial.metallicFactor)) {
          materialUniforms['metallicFactor'] = pbrMaterial.metallicFactor;
        }

        if (defined(pbrMaterial.roughnessFactor)) {
          materialUniforms['roughnessFactor'] = pbrMaterial.roughnessFactor;
        }
      }

      if (primitive.material.normalTexture) {
        var _texture2 = this._toTexture(primitive.material.normalTexture);

        materialUniforms['normalTexture'] = _texture2;
      }

      if (primitive.material.occlusionTexture) {
        var _texture3 = this._toTexture(primitive.material.occlusionTexture);

        materialUniforms['occlusionTexture'] = _texture3;
      }

      if (primitive.material.emissiveTexture) {
        var _texture4 = this._toTexture(primitive.material.emissiveTexture);

        materialUniforms['emissiveTexture'] = _texture4;
      }

      return materialUniforms;
    };

    _proto._toTexture = function _toTexture(texture) {
      var data = texture.texture.image.array;
      var sampler = texture.texture.sampler || {};
      var width = texture.texture.image.width;
      var height = texture.texture.image.height;
      return this.regl.texture({
        width: width,
        height: height,
        data: data,
        mag: TEXTURE_SAMPLER[sampler.magFilter] || TEXTURE_SAMPLER['9728'],
        min: TEXTURE_SAMPLER[sampler.minFilter] || TEXTURE_SAMPLER['9728'],
        wrapS: TEXTURE_SAMPLER[sampler.wrapS] || TEXTURE_SAMPLER['10497'],
        wrapT: TEXTURE_SAMPLER[sampler.wrapT] || TEXTURE_SAMPLER['10497']
      });
    };

    _proto._setMeshUniforms = function _setMeshUniforms(mesh, uniforms) {
      for (var k in uniforms) {
        mesh.setUniform(k, uniforms[k]);
      }

      return mesh;
    };

    _proto._updateNodeMatrix = function _updateNodeMatrix(marker, node, parentNodeMatrix) {
      var _this9 = this;

      var trs = node.trs;

      if (trs) {
        trs.setMatrix(node.localMatrix);
      }

      if (parentNodeMatrix) {
        gl.mat4.multiply(node.nodeMatrix, parentNodeMatrix, node.localMatrix);
      } else {
        gl.mat4.copy(node.nodeMatrix, node.localMatrix);
      }

      var nodeMatrix = node.nodeMatrix;

      if (node.children) {
        node.children.forEach(function (child) {
          _this9._updateNodeMatrix(marker, child, nodeMatrix);
        });
      }

      if (marker.isAnimated()) {
        var url = marker.getUrl();
        var json = this._geometries[url].json;
        var speed = marker.getAnimationSpeed();
        var isLooped = marker.isLooped();
        var timespan = json.animations ? T.getAnimationTimeSpan(json) : null;
        var animTime = isLooped ? ANIMATION_TIME * 0.001 % (timespan.max - timespan.min) : ANIMATION_TIME * 0.001;
        var animClip = T.getAnimationClip(json, Number(node.nodeIndex), animTime * speed);
        var animTransformMat = animClip.trs;
        decompose(animTransformMat, node.trs.translation, node.trs.rotation, node.trs.scale);

        if (animClip.weights) {
          node.morphWeights = animClip.weights;
        }

        if (node.skin) {
          node.skin.joints.forEach(function (joint) {
            var animSkinMat = T.getAnimationClip(json, Number(joint.nodeIndex), animTime * speed).trs;
            decompose(animSkinMat, joint.trs.translation, joint.trs.rotation, joint.trs.scale);
          });
        }
      }
    };

    _proto._updateSceneMatrix = function _updateSceneMatrix(uid) {
      var _this10 = this;

      var scene = this.gltfScenes[uid];

      if (!scene) {
        return;
      }

      var marker = this.layer._markerMap[uid];
      var url = marker.getUrl();

      if (!this._geometries[url]) {
        return;
      }

      var json = this._geometries[url].json;

      if (!json) {
        return;
      }

      marker._updateMatrix();

      var transformMat = marker.getModelMatrix();

      if (json.scenes) {
        json.scenes[0].nodes.forEach(function (node) {
          _this10._updateNodeMatrix(marker, node);
        });
      }

      var meshes = scene.modelMeshes;
      meshes.forEach(function (mesh) {
        if (mesh.skin) {
          mesh.skin.update(mesh.node.nodeMatrix);
          mesh.setUniform('jointTexture', mesh.skin.jointTexture);
        }

        if (mesh.node && mesh.node.nodeMatrix) {
          gl.mat4.multiply(transformMat, transformMat, mesh.node.nodeMatrix);
        }

        mesh.setLocalTransform(transformMat);
      });
    };

    _proto._updateInstancedMeshData = function _updateInstancedMeshData(mesh, marker) {
      var attributes = marker._getInstanceAttributesData(mesh.localTransform);

      var matrix = gl.mat4.multiply([], marker._attribteMatrixs[0], mesh.localTransform);
      mesh.setLocalTransform(matrix);

      for (var key in attributes) {
        mesh.updateInstancedData(key, attributes[key]);
        mesh.instanceCount = marker.getCount();
      }
    };

    _proto._deleteScene = function _deleteScene(uid) {
      if (defined(uid)) {
        this._disposeMesh(uid);

        delete this.gltfScenes[uid];
        this.setToRedraw();
      }
    };

    _proto._deleteAll = function _deleteAll() {
      for (var uid in this.gltfScenes) {
        this._disposeMesh(uid);
      }

      this.gltfScenes = {};
      this.setToRedraw();
    };

    _proto._disposeMesh = function _disposeMesh(uid) {
      var _this11 = this;

      if (!this.gltfScenes[uid]) {
        return;
      }

      var marker = this.layer._markerMap[uid];
      var url = marker.getUrl();
      this._geometries[url].count -= 1;
      var meshes = this.gltfScenes[uid].modelMeshes;
      meshes.forEach(function (mesh) {
        if (_this11._geometries[url].count <= 0) {
          mesh.geometry.dispose();
        }

        if (mesh.material) {
          mesh.material.dispose();
        }

        mesh.dispose();
      });
    };

    _proto._removeGeometry = function _removeGeometry(url) {
      if (this._geometries && this._geometries[url]) {
        this._geometries[url].count -= 1;

        if (this._geometries[url].count <= 0) {
          this._geometries[url].geometries.forEach(function (geoObject) {
            geoObject.geometry.dispose();
          });

          delete this._geometries[url];
        }
      }
    };

    _proto._createGLContext = function _createGLContext(canvas, options) {
      var names = ['webgl', 'experimental-webgl'];
      var context = null;

      for (var i$$1 = 0; i$$1 < names.length; ++i$$1) {
        try {
          context = canvas.getContext(names[i$$1], options);
        } catch (e) {}

        if (context) {
          break;
        }
      }

      return context;
    };

    _proto._identify = function _identify(x, y, options) {
      if (options === void 0) {
        options = {};
      }

      if (!this._picking) {
        return null;
      }

      var map = this.layer.getMap();

      if (this._needRefreshPicking) {
        if (!this._toRenderScene) {
          return null;
        }

        var meshes = this._toRenderScene.getMeshes();

        this._picking.render(meshes, this._uniforms, true);

        this._needRefreshPicking = false;
      }

      var _this$_picking$pick = this._picking.pick(x, y, options.tolerance || 3, {
        'projViewMatrix': map.projViewMatrix
      }, {
        viewMatrix: map.viewMatrix,
        projMatrix: map.projMatrix,
        returnPoint: true
      }),
          meshId = _this$_picking$pick.meshId,
          pickingId = _this$_picking$pick.pickingId,
          point = _this$_picking$pick.point;

      var uid = this._squeezeTarget(pickingId);

      var target = this.layer._markerMap[uid];
      return {
        meshId: meshId,
        target: target,
        pickingId: pickingId,
        point: point
      };
    };

    _proto._squeezeTarget = function _squeezeTarget(pickingId) {
      if (!defined(pickingId)) {
        return null;
      }

      if (this.layer._markerMap[pickingId]) {
        return pickingId;
      }

      var keys = Object.keys(this.layer._markerMap);

      for (var i$$1 = 0; i$$1 < keys.length - 1; i$$1++) {
        var key0 = Number(keys[i$$1]);
        var key1 = Number(keys[i$$1 + 1]);

        if (pickingId >= key0 && pickingId < key1) {
          return key0;
        }
      }

      var endKey = Number(keys[keys.length - 1]);

      if (pickingId >= endKey) {
        return endKey;
      }

      return null;
    };

    _proto._isPBRShader = function _isPBRShader(shaderName) {
      return shaderName === 'lit' || shaderName === 'subsurface' || shaderName === 'cloth';
    };

    return GLTFLayerRenderer;
  }(maptalks.renderer.CanvasRenderer);

  function createFunction(parameters, defaultType) {
    var fun;
    var isFeatureConstant, isZoomConstant;

    if (!isFunctionDefinition(parameters)) {
      fun = function fun() {
        return parameters;
      };

      isFeatureConstant = true;
      isZoomConstant = true;
    } else {
      var zoomAndFeatureDependent = parameters.stops && typeof parameters.stops[0][0] === 'object';
      var featureDependent = zoomAndFeatureDependent || parameters.property !== undefined;
      var zoomDependent = zoomAndFeatureDependent || !featureDependent;
      var type = parameters.type || defaultType || 'exponential';
      var innerFun;

      if (type === 'exponential') {
        innerFun = evaluateExponentialFunction;
      } else if (type === 'interval') {
        innerFun = evaluateIntervalFunction;
      } else if (type === 'categorical') {
        innerFun = evaluateCategoricalFunction;
      } else if (type === 'identity') {
        innerFun = evaluateIdentityFunction;
      } else {
        throw new Error('Unknown function type "' + type + '"');
      }

      if (zoomAndFeatureDependent) {
        var featureFunctions = {};
        var featureFunctionStops = [];

        for (var s = 0; s < parameters.stops.length; s++) {
          var stop = parameters.stops[s];

          if (featureFunctions[stop[0].zoom] === undefined) {
            featureFunctions[stop[0].zoom] = {
              zoom: stop[0].zoom,
              type: parameters.type,
              property: parameters.property,
              default: parameters.default,
              stops: []
            };
          }

          featureFunctions[stop[0].zoom].stops.push([stop[0].value, stop[1]]);
        }

        for (var z in featureFunctions) {
          featureFunctionStops.push([featureFunctions[z].zoom, createFunction(featureFunctions[z])]);
        }

        fun = function fun(zoom, feature) {
          var value = evaluateExponentialFunction({
            stops: featureFunctionStops,
            base: parameters.base
          }, zoom)(zoom, feature);
          return typeof value === 'function' ? value(zoom, feature) : value;
        };

        isFeatureConstant = false;
        isZoomConstant = false;
      } else if (zoomDependent) {
        fun = function fun(zoom) {
          var value = innerFun(parameters, zoom);
          return typeof value === 'function' ? value(zoom) : value;
        };

        isFeatureConstant = true;
        isZoomConstant = false;
      } else {
        fun = function fun(zoom, feature) {
          var value = innerFun(parameters, feature ? feature[parameters.property] : null);
          return typeof value === 'function' ? value(zoom, feature) : value;
        };

        isFeatureConstant = false;
        isZoomConstant = true;
      }
    }

    fun.isZoomConstant = isZoomConstant;
    fun.isFeatureConstant = isFeatureConstant;
    return fun;
  }

  function coalesce(a, b, c) {
    if (a !== undefined) return a;
    if (b !== undefined) return b;
    if (c !== undefined) return c;
    return null;
  }

  function evaluateCategoricalFunction(parameters, input) {
    for (var i = 0; i < parameters.stops.length; i++) {
      if (input === parameters.stops[i][0]) {
        return parameters.stops[i][1];
      }
    }

    return parameters.default;
  }

  function evaluateIntervalFunction(parameters, input) {
    for (var i = 0; i < parameters.stops.length; i++) {
      if (input < parameters.stops[i][0]) break;
    }

    return parameters.stops[Math.max(i - 1, 0)][1];
  }

  function evaluateExponentialFunction(parameters, input) {
    var base = parameters.base !== undefined ? parameters.base : 1;
    var i = 0;

    while (true) {
      if (i >= parameters.stops.length) break;else if (input <= parameters.stops[i][0]) break;else i++;
    }

    if (i === 0) {
      return parameters.stops[i][1];
    } else if (i === parameters.stops.length) {
      return parameters.stops[i - 1][1];
    } else {
      return interpolate(input, base, parameters.stops[i - 1][0], parameters.stops[i][0], parameters.stops[i - 1][1], parameters.stops[i][1]);
    }
  }

  function evaluateIdentityFunction(parameters, input) {
    return coalesce(input, parameters.default);
  }

  function interpolate(input, base, inputLower, inputUpper, outputLower, outputUpper) {
    if (typeof outputLower === 'function') {
      return function () {
        var evaluatedLower = outputLower.apply(undefined, arguments);
        var evaluatedUpper = outputUpper.apply(undefined, arguments);
        return interpolate(input, base, inputLower, inputUpper, evaluatedLower, evaluatedUpper);
      };
    } else if (outputLower.length) {
      return interpolateArray(input, base, inputLower, inputUpper, outputLower, outputUpper);
    } else {
      return interpolateNumber(input, base, inputLower, inputUpper, outputLower, outputUpper);
    }
  }

  function interpolateNumber(input, base, inputLower, inputUpper, outputLower, outputUpper) {
    var difference = inputUpper - inputLower;
    var progress = input - inputLower;
    var ratio;

    if (base === 1) {
      ratio = progress / difference;
    } else {
      ratio = (Math.pow(base, progress) - 1) / (Math.pow(base, difference) - 1);
    }

    return outputLower * (1 - ratio) + outputUpper * ratio;
  }

  function interpolateArray(input, base, inputLower, inputUpper, outputLower, outputUpper) {
    var output = [];

    for (var i = 0; i < outputLower.length; i++) {
      output[i] = interpolateNumber(input, base, inputLower, inputUpper, outputLower[i], outputUpper[i]);
    }

    return output;
  }

  function isFunctionDefinition(obj) {
    return obj && typeof obj === 'object' && (obj.stops || obj.property && obj.type === 'identity');
  }
  function hasFunctionDefinition(obj) {
    for (var p in obj) {
      if (isFunctionDefinition(obj[p])) {
        return true;
      }
    }

    return false;
  }
  function interpolated(parameters) {
    return createFunction1(parameters, 'exponential');
  }
  function loadFunctionTypes(obj, argFn) {
    if (!obj) {
      return null;
    }

    var hit = false;

    if (Array.isArray(obj)) {
      var multResult = [],
          loaded;

      for (var i = 0; i < obj.length; i++) {
        loaded = loadFunctionTypes(obj[i], argFn);

        if (!loaded) {
          multResult.push(obj[i]);
        } else {
          multResult.push(loaded);
          hit = true;
        }
      }

      return hit ? multResult : obj;
    }

    var result = {
      '__fn_types_loaded': true
    },
        props = [],
        p;

    for (p in obj) {
      if (obj.hasOwnProperty(p)) {
        props.push(p);
      }
    }

    var buildFn = function buildFn(p) {
      Object.defineProperty(result, p, {
        get: function get() {
          if (!this['__fn_' + p]) {
            this['__fn_' + p] = interpolated(this['_' + p]);
          }

          return this['__fn_' + p].apply(this, argFn());
        },
        set: function set(v) {
          this['_' + p] = v;
        },
        configurable: true,
        enumerable: true
      });
    };

    for (var _i = 0, len = props.length; _i < len; _i++) {
      p = props[_i];

      if (isFunctionDefinition(obj[p])) {
        hit = true;
        result['_' + p] = obj[p];
        buildFn(p);
      } else {
        result[p] = obj[p];
      }
    }

    return hit ? result : obj;
  }

  function createFunction1(parameters, defaultType) {
    if (!isFunctionDefinition(parameters)) {
      return function () {
        return parameters;
      };
    }

    parameters = JSON.parse(JSON.stringify(parameters));
    var isZoomConstant = true;
    var isFeatureConstant = true;
    var stops = parameters.stops;

    for (var i = 0; i < stops.length; i++) {
      if (isFunctionDefinition(stops[i][1])) {
        var _fn = createFunction(stops[i][1], defaultType);

        isZoomConstant = isZoomConstant && _fn.isZoomConstant;
        isFeatureConstant = isFeatureConstant && _fn.isFeatureConstant;
        stops[i] = [stops[i][0], _fn];
      }
    }

    var fn = createFunction(parameters, defaultType);
    fn.isZoomConstant = isZoomConstant && fn.isZoomConstant;
    fn.isFeatureConstant = isFeatureConstant && fn.isFeatureConstant;
    return fn;
  }

  var DEFAULT_ROTATION = [0, 0, 0];
  var options = {
    visible: true
  };

  var GLTFMarker = function (_Eventable) {
    _inheritsLoose(GLTFMarker, _Eventable);

    function GLTFMarker(coordinates, options) {
      var _this;

      _this = _Eventable.call(this, options) || this;

      if (coordinates) {
        _this.setCoordinates(coordinates);
      }

      _this._loaded = false;

      _this._initSymbol();

      _this._updateMatrix();

      _this._type = 'gltfmarker';
      return _this;
    }

    GLTFMarker.fromJSON = function fromJSON(json) {
      return new GLTFMarker(json.coordinates, json.options);
    };

    var _proto = GLTFMarker.prototype;

    _proto._loadData = function _loadData() {
      var _this2 = this;

      var url = this.getUrl();
      var index = url.lastIndexOf('/');
      var root = url.slice(0, index);
      var postfix = url.slice(url.lastIndexOf('.'));

      if (postfix === '.gltf') {
        return i.getJSON(url, {}).then(function (json) {
          _this2._gltfjson = json;
          var loader = new T(root, json);
          return _this2._exportGLTFData(loader);
        });
      } else if (postfix === '.glb') {
        return i.getArrayBuffer(url, {}).then(function (json) {
          _this2._gltfjson = json;
          var loader = new T(root, {
            buffer: json.data,
            byteOffset: 0
          });
          return _this2._exportGLTFData(loader);
        });
      }

      return null;
    };

    _proto._exportGLTFData = function _exportGLTFData(loader) {
      var _this3 = this;

      return loader.load().then(function (gltfData) {
        _this3._setGLTFData(gltfData);

        return gltfData;
      });
    };

    _proto._initSymbol = function _initSymbol() {
      if (this.options.symbol) {
        this.setSymbol(this.options.symbol);
      } else {
        this.options.symbol = {};
        this._externSymbol = {};
      }
    };

    _proto._getGLTFData = function _getGLTFData() {
      return this._gltfData;
    };

    _proto._setGLTFData = function _setGLTFData(data) {
      this._gltfData = data;
    };

    _proto._getGLTFJson = function _getGLTFJson() {
      return this._gltfjson;
    };

    _proto._setPropInSymbol = function _setPropInSymbol(prop, value) {
      this.options.symbol = this.options.symbol || {};
      this.options.symbol[prop] = value;
    };

    _proto._setPropInExternSymbol = function _setPropInExternSymbol(prop, value) {
      this._externSymbol = this._externSymbol || {};
      this._externSymbol[prop] = value;
    };

    _proto.getMap = function getMap() {
      if (!this._layer) {
        return null;
      }

      return this._layer.getMap();
    };

    _proto.getLayer = function getLayer() {
      return this._layer;
    };

    _proto.setUrl = function setUrl(url) {
      var _this4 = this;

      var oldUrl = this.getUrl();

      this._setPropInSymbol('url', url);

      if (this._layer) {
        this._layer._loadGLTFData(this).then(function () {
          _this4._layer._removeGLTFRequests(oldUrl);

          _this4.fire('setUrl-debug');
        });
      }

      this._dirty = true;
      return this;
    };

    _proto.getUrl = function getUrl() {
      var symbol = this._getInternalSymbol() || {};
      return symbol.url || 'sphere';
    };

    _proto.addTo = function addTo(layer) {
      if (this._layer) {
        throw new Error('GLTFMarker cannot be added to two or more layers at the same time.');
      }

      this._layer = layer;

      this._layer.addMarker(this);

      return this;
    };

    _proto.remove = function remove() {
      if (this._layer) {
        this._layer.removeMarker(this);

        delete this._layer;
      }
    };

    _proto.show = function show() {
      this.options.visible = true;
      this._dirty = true;
      return this;
    };

    _proto.hide = function hide() {
      this.options.visible = false;
      this._dirty = true;
    };

    _proto.isVisible = function isVisible() {
      return this.options.visible;
    };

    _proto.getCoordinates = function getCoordinates() {
      return this._coordinates;
    };

    _proto.setCoordinates = function setCoordinates(coordinates) {
      if (Array.isArray(coordinates)) {
        this._coordinates = new maptalks.Coordinate(coordinates);
      } else {
        this._coordinates = coordinates;
      }

      this._dirty = true;
      return this;
    };

    _proto.copy = function copy() {
      var jsonData = this.toJSON();
      return GLTFMarker.fromJSON(jsonData);
    };

    _proto.setId = function setId(id) {
      this.options.id = id;
    };

    _proto.getId = function getId() {
      return this.options.id;
    };

    _proto.setShader = function setShader(shader) {
      this.options.symbol.shader = shader;

      if (this._layer) {
        this._layer._updateGeometries(this);
      }

      this._dirty = true;
      return this;
    };

    _proto.getShader = function getShader() {
      var symbol = this._getInternalSymbol() || {};
      return symbol.shader || 'phong';
    };

    _proto.setUniforms = function setUniforms(uniforms) {
      this.options.symbol.uniforms = maptalks.Util.extend({}, uniforms);
      this._dirty = true;
      return this;
    };

    _proto.getUniforms = function getUniforms() {
      var symbol = this._getInternalSymbol() || {};
      return symbol.uniforms;
    };

    _proto.setUniform = function setUniform(key, value) {
      var symbol = this.options.symbol;

      if (!symbol.uniforms) {
        symbol.uniforms = {};
      }

      symbol.uniforms[key] = value;
      this._dirty = true;
      return this;
    };

    _proto.getUniform = function getUniform(key) {
      var symbol = this._getInternalSymbol() || {};

      if (!symbol.uniforms) {
        return null;
      }

      return symbol.uniforms[key];
    };

    _proto.setMaterial = function setMaterial(material) {
      this.options.symbol.material = material;
      this._dirty = true;
      return this;
    };

    _proto.getMaterial = function getMaterial() {
      var symbol = this._getInternalSymbol() || {};
      return symbol.material;
    };

    _proto.isAnimated = function isAnimated() {
      var symbol = this._getInternalSymbol() || {};
      return symbol.animation && this._gltfData && this._gltfData.animations;
    };

    _proto.setAnimation = function setAnimation(isAnimation) {
      this._dirty = true;
      this.options.symbol.animation = isAnimation;
      return this;
    };

    _proto.setAnimationloop = function setAnimationloop(looped) {
      this.options.symbol.loop = looped;
      return this;
    };

    _proto.isLooped = function isLooped() {
      return this.options.symbol.loop;
    };

    _proto.getAnimationSpeed = function getAnimationSpeed() {
      var symbol = this._getInternalSymbol() || {};
      return symbol.speed || 1.0;
    };

    _proto.setAnimationSpeed = function setAnimationSpeed(speed) {
      this.options.symbol.speed = speed;
      return this;
    };

    _proto._getPosition = function _getPosition(coordinate) {
      var map = this.getMap();

      if (map) {
        return coordinateToWorld(map, coordinate || this.getCoordinates());
      }

      return null;
    };

    _proto.setTranslation = function setTranslation(translation) {
      this.options.symbol.translation = translation || [0, 0, 0];

      this._updateMatrix();

      return this;
    };

    _proto.getTranslation = function getTranslation() {
      var symbol = this._getInternalSymbol() || {};
      return symbol.translation || [0, 0, 0];
    };

    _proto._getWorldTranslation = function _getWorldTranslation() {
      var trans = this.getTranslation();

      var position = this._getPosition();

      if (position) {
        return gl.vec3.add([], trans, position);
      }

      return trans;
    };

    _proto.setRotation = function setRotation(xAngle, yAngle, zAngle) {
      this.options.symbol.rotation = [xAngle, yAngle, zAngle];

      this._updateMatrix();

      return this;
    };

    _proto.getRotation = function getRotation() {
      var symbol = this._getInternalSymbol() || {};
      return symbol.rotation || DEFAULT_ROTATION;
    };

    _proto.setScale = function setScale(scale) {
      this.options.symbol.scale = scale || [1, 1, 1];

      this._updateMatrix();

      return this;
    };

    _proto.getScale = function getScale() {
      var symbol = this._getInternalSymbol() || {};
      return symbol.scale || [1, 1, 1];
    };

    _proto.setSymbol = function setSymbol(symbol) {
      this._checkUrl(symbol);

      this.options.symbol = this._prepareSymbol(symbol);

      this._onSymbolChanged();

      return this;
    };

    _proto.getSymbol = function getSymbol() {
      return this.options.symbol;
    };

    _proto._setExternSymbol = function _setExternSymbol(symbol) {
      this._externSymbol = this._prepareSymbol(symbol);

      this._onSymbolChanged();

      return this;
    };

    _proto._getInternalSymbol = function _getInternalSymbol() {
      var symbol = null;

      if (!isEmptyObject(this.options.symbol)) {
        symbol = this.options.symbol;
      } else if (!isEmptyObject(this._externSymbol)) {
        symbol = this._externSymbol;
      }

      return symbol;
    };

    _proto._loadFunctionTypes = function _loadFunctionTypes(obj) {
      var _this5 = this;

      return loadFunctionTypes(obj, function () {
        var map = _this5.getMap();

        if (map) {
          var zoom = map.getZoom();
          return [zoom];
        } else {
          return null;
        }
      });
    };

    _proto._prepareSymbol = function _prepareSymbol(symbol) {
      var copySymbol = JSON.parse(JSON.stringify(symbol));

      var functionSymbol = this._loadFunctionTypes(copySymbol);

      if (functionSymbol && functionSymbol.uniforms) {
        functionSymbol.uniforms = this._loadFunctionTypes(symbol.uniforms);
      }

      delete this._hasFuncDefinition;
      return functionSymbol;
    };

    _proto.hasFunctionDefinition = function hasFunctionDefinition$$1() {
      if (defined(this._hasFuncDefinition)) {
        return this._hasFuncDefinition;
      }

      var symbol = this._getInternalSymbol();

      this._hasFuncDefinition = hasFunctionDefinition(symbol) || symbol && symbol.uniforms && hasFunctionDefinition(symbol.uniforms);
      return this._hasFuncDefinition;
    };

    _proto._onSymbolChanged = function _onSymbolChanged() {
      this._updateMatrix();

      if (this._layer) {
        this._layer._updateGeometries(this);
      }
    };

    _proto.updateSymbol = function updateSymbol(symbol) {
      var copySymbol = this._prepareSymbol(symbol);

      this._checkUrl(copySymbol);

      for (var i$$1 in copySymbol) {
        this._setPropInSymbol(i$$1, copySymbol[i$$1]);
      }

      this._onSymbolChanged();
    };

    _proto._checkUrl = function _checkUrl(symbol) {
      var oldUrl = this.getUrl();
      var newUrl = symbol.url;

      if (newUrl && newUrl !== oldUrl) {
        this.setUrl(newUrl);
      }
    };

    _proto.setModelMatrix = function setModelMatrix(matrix) {
      this._modelMatrix = matrix;
      return this;
    };

    _proto.getModelMatrix = function getModelMatrix() {
      this._modelMatrix = this._modelMatrix || gl.mat4.identity([]);
      return this._modelMatrix;
    };

    _proto._updateMatrix = function _updateMatrix() {
      var rotation = this.getRotation();
      var eluerQuat = gl.quat.fromEuler([], rotation[0] || 0, rotation[1] || 0, rotation[2] || 0);
      this._modelMatrix = gl.mat4.fromRotationTranslationScale([], eluerQuat, this._getWorldTranslation(), this.getScale());
      this._dirty = true;
    };

    _proto.setProperties = function setProperties(properties) {
      this.options.properties = properties;
      return this;
    };

    _proto.getProperties = function getProperties() {
      return this.options.properties;
    };

    _proto.isDirty = function isDirty() {
      return this._dirty;
    };

    _proto.setDirty = function setDirty(dirty) {
      this._dirty = dirty;
      return this;
    };

    _proto.on = function on(events, callback, context) {
      _Eventable.prototype.on.call(this, events, callback, context || this);

      if (this._layer) {
        this._layer._addEvents(events);
      }
    };

    _proto.off = function off(events, callback, context) {
      _Eventable.prototype.off.call(this, events, callback, context || this);

      if (this._layer) {
        this._layer._removeEvents();
      }
    };

    _proto.toJSON = function toJSON() {
      return JSON.parse(JSON.stringify({
        coordinates: this.getCoordinates(),
        options: this.options
      }));
    };

    _proto._setLoadState = function _setLoadState(state) {
      this._loaded = state;
    };

    _proto.isLoaded = function isLoaded() {
      return this._loaded;
    };

    _proto.getType = function getType() {
      return this._type;
    };

    _proto._getUID = function _getUID() {
      return this._uid;
    };

    return GLTFMarker;
  }(maptalks.Eventable(maptalks.Handlerable(maptalks.Class)));
  GLTFMarker.mergeOptions(options);

  function coordinateToWorld(map, coordinate, z) {
    if (z === void 0) {
      z = 0;
    }

    if (!map || !(coordinate instanceof maptalks.Coordinate)) {
      return null;
    }

    var p = map.coordinateToPoint(coordinate, getTargetZoom(map));
    return [p.x, p.y, z];
  }

  function getTargetZoom(map) {
    return map.getGLZoom();
  }

  var types$1 = ['Point', 'Polygon', 'LineString', 'MultiPoint', 'MultiPolygon', 'MultiLineString', 'GeometryCollection', 'Feature', 'FeatureCollection'].reduce(function (memo, t) {
    memo[t] = true;
    return memo;
  }, {});
  var GeoJSON = {
    toGeometry: function toGeometry(geoJSON) {
      if (maptalks.Util.isString(geoJSON)) {
        geoJSON = maptalks.Util.parseJSON(geoJSON);
      }

      if (Array.isArray(geoJSON)) {
        var resultGeos = [];

        for (var i = 0, len = geoJSON.length; i < len; i++) {
          var geo = GeoJSON._convert(geoJSON[i]);

          if (Array.isArray(geo)) {
            maptalks.Util.pushIn(resultGeos, geo);
          } else {
            resultGeos.push(geo);
          }
        }

        return resultGeos;
      } else {
        var resultGeo = GeoJSON._convert(geoJSON);

        return resultGeo;
      }
    },
    _convert: function _convert(json) {
      if (!json || maptalks.Util.isNil(json['type'])) {
        return null;
      }

      var type = json['type'];

      if (type === 'Feature') {
        var g = json['geometry'];

        var geometry = GeoJSON._convert(g);

        if (!geometry) {
          return null;
        }

        geometry.setId(json['id']);
        geometry.setProperties(json['properties']);
        return geometry;
      } else if (type === 'FeatureCollection') {
        var features = json['features'];

        if (!features) {
          return null;
        }

        var result = GeoJSON.toGeometry(features);
        return result;
      } else if (type === 'Point') {
        return new GLTFMarker(json['coordinates']);
      } else if (type === 'GeometryCollection') {
        var geometries = json['geometries'];
        var mGeos = [];
        var len = geometries.length;

        for (var i = 0; i < len; i++) {
          mGeos.push(GeoJSON._convert(geometries[i]));
        }

        return mGeos;
      } else {
        throw new Error('geometry\'s type is invalid, only support type of Point');
      }
    },
    isGeoJSON: function isGeoJSON(geoJSON) {
      if (!geoJSON || typeof geoJSON !== 'object') return false;
      if (!geoJSON.type) return false;
      if (!types$1[geoJSON.type]) return false;
      return true;
    }
  };

  var language = {
    'zh-CN': {
      animation: '动画',
      loop: '循环',
      speed: '速度',
      translation: '平移',
      rotation: '旋转',
      scale: '缩放',
      model: '选择模型',
      shader: '选择滤镜',
      phong: '冯氏光照',
      wireframe: '线框',
      lightPosition: '灯光位置',
      lightAmbient: '环境光',
      lightDiffuse: '漫反射',
      lightSpecular: '镜面反射',
      ambientStrength: '环境光强度',
      specularStrength: '高光强度',
      materialShininess: '材质反光度',
      opacity: '透明度',
      frontColor: '前景色',
      backColor: '后景色',
      fillColor: '填充色',
      fill: '填充色',
      stroke: '画笔颜色',
      lineWidth: '线宽',
      alpha: '透明度',
      animationGroup: '动画属性',
      threeGroup: '三维属性',
      highLight: '高光',
      diffuse: '漫射',
      color: '颜色',
      width: '宽度',
      default: '默认值',
      seeThrough: '透视',
      dash: '虚线',
      dashEnabled: '开启虚线',
      dashAnimate: '虚线动画',
      dashOverlap: '虚线重叠',
      dashRepeats: '虚线重复',
      dashLength: '虚线长度',
      squeeze: '挤压',
      insideAltColor: '开启内填充色',
      dualStroke: '开启双向画笔',
      squeezeMin: '最小挤压力',
      squeezeMax: '最大挤压力',
      Sleek: ' 圆滑',
      FunkyTorus: '时尚',
      BlockyFade: '斑驳',
      SimpleWire: '简约',
      NicerWire: '至美',
      Animated: '动画',
      FunZone: '滑稽',
      Dotted: '点缀',
      Flower: '花簇',
      Tapered: '渐缩'
    },
    'en-US': {
      animation: 'Animation',
      loop: 'Loop',
      speed: 'Speed',
      translation: 'Translation',
      rotation: 'Rotation',
      scale: 'Scale',
      model: 'Model',
      shader: 'Shader',
      phong: 'Phong',
      wireframe: 'Wireframe',
      lightPosition: 'Light Position',
      lightAmbient: 'Light Ambient',
      lightDiffuse: 'Light Diffuse',
      lightSpecular: 'Light Specular',
      ambientStrength: 'Ambient Strength',
      specularStrength: 'Specular Strength',
      materialShininess: 'Material Shininess',
      opacity: 'Opacity',
      frontColor: 'Front Color',
      backColor: 'Back Color',
      fillColor: 'Fill Color',
      fill: 'Fill Color',
      stroke: 'stroke color',
      lineWidth: 'Line Width',
      alpha: 'Alpha',
      animationGroup: 'Animation',
      threeGroup: 'Three',
      highLight: 'HighLight',
      diffuse: 'Diffuse',
      color: 'Color',
      width: 'Width',
      default: 'Default',
      seeThrough: 'See Through',
      dash: 'Dash Line',
      dashEnabled: 'Enable Dash',
      dashAnimate: 'Dash Animation',
      dashOverlap: 'Dash Overlap',
      dashRepeats: 'Dash Repeats',
      dashLength: 'Dash Length',
      squeeze: 'Squeeze',
      insideAltColor: 'Inside Color',
      dualStroke: 'Dual Strik',
      squeezeMin: 'Min Squeeze',
      squeezeMax: 'Max Squeeze',
      Sleek: ' Sleek',
      FunkyTorus: 'FunkyTorus',
      BlockyFade: 'BlockyFade',
      SimpleWire: 'SimpleWire',
      NicerWire: 'NicerWire',
      Animated: 'Animated',
      FunZone: 'FunZone',
      Dotted: 'Dotted',
      Flower: 'Flower',
      Tapered: 'Tapered'
    }
  };

  function getStudioTypings() {
    return {
      i18n: language,
      groups: [{
        name: 'animationGroup',
        children: [{
          name: 'animation'
        }, {
          name: 'loop'
        }, {
          name: 'speed'
        }, {
          name: 'translation'
        }, {
          name: 'rotation'
        }, {
          name: 'scale'
        }]
      }, {
        name: 'threeGroup',
        children: [{
          name: 'shader'
        }, {
          name: 'uniforms'
        }]
      }],
      typing: {
        name: 'style',
        type: 'array',
        onChange: 'setStyle',
        items: [{
          type: 'object',
          properties: {
            filter: {
              type: 'filter',
              name: 'filter',
              value: ['==', 'layer']
            },
            symbol: {
              type: 'object',
              name: 'symbol',
              properties: {
                animation: {
                  type: 'switch',
                  name: 'animation',
                  value: true
                },
                loop: {
                  type: 'switch',
                  name: 'loop',
                  value: false
                },
                speed: {
                  type: 'range',
                  name: 'speed',
                  options: [0, 20, 0.1],
                  value: 22.5
                },
                translation: {
                  type: 'array',
                  name: 'translation',
                  value: [1, 1, 1],
                  items: [{
                    type: 'range',
                    name: 'directionX',
                    options: [0.1, 10, 0.1]
                  }, {
                    type: 'range',
                    name: 'directionY',
                    options: [0.1, 10, 0.1]
                  }, {
                    type: 'range',
                    name: 'directionZ',
                    options: [0.1, 10, 0.1]
                  }]
                },
                rotation: {
                  type: 'array',
                  name: 'rotation',
                  value: [0, 0, 0],
                  items: [{
                    type: 'range',
                    name: 'directionX',
                    options: [0.1, 10, 0.1]
                  }, {
                    type: 'range',
                    name: 'directionY',
                    options: [0.1, 10, 0.1]
                  }, {
                    type: 'range',
                    name: 'directionZ',
                    options: [0.1, 10, 0.1]
                  }]
                },
                scale: {
                  type: 'array',
                  name: 'scale',
                  value: [1, 1, 1],
                  items: [{
                    type: 'range',
                    name: 'directionX',
                    options: [0.1, 10, 0.1]
                  }, {
                    type: 'range',
                    name: 'directionY',
                    options: [0.1, 10, 0.1]
                  }, {
                    type: 'range',
                    name: 'directionZ',
                    options: [0.1, 10, 0.1]
                  }]
                },
                shader: {
                  type: 'radio',
                  name: 'shader',
                  options: [],
                  value: 'phong'
                },
                uniforms: {
                  type: 'object',
                  name: 'uniforms',
                  value: 'phong',
                  oneOf: []
                }
              }
            }
          }
        }]
      }
    };
  }

  var cubePosition = [1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1, 1, 1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1, 1, 1, 1, 1, -1, -1, 1, -1, -1, 1, 1, -1, 1, 1, -1, 1, -1, -1, -1, -1, -1, -1, 1, -1, -1, -1, 1, -1, -1, 1, -1, 1, -1, -1, 1, 1, -1, -1, -1, -1, -1, -1, 1, -1, 1, 1, -1];
  var cubeNormal = [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1];
  var cubeIndices = [0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11, 12, 13, 14, 12, 14, 15, 16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23];

  function SphereGeometry(radius, widthSegments, heightSegments, phiStart, phiLength, thetaStart, thetaLength) {
    radius = radius || 1;
    widthSegments = Math.max(3, Math.floor(widthSegments) || 8);
    heightSegments = Math.max(2, Math.floor(heightSegments) || 6);
    phiStart = phiStart !== undefined ? phiStart : 0;
    phiLength = phiLength !== undefined ? phiLength : Math.PI * 2;
    thetaStart = thetaStart !== undefined ? thetaStart : 0;
    thetaLength = thetaLength !== undefined ? thetaLength : Math.PI;
    var thetaEnd = thetaStart + thetaLength;
    var ix, iy;
    var index = 0;
    var grid = [];
    var vertex = [];
    var normal = [];
    var indices = [];
    var vertices = [];
    var normals = [];
    var uvs = [];

    for (iy = 0; iy <= heightSegments; iy++) {
      var verticesRow = [];
      var v = iy / heightSegments;
      var uOffset = iy === 0 ? 0.5 / widthSegments : iy === heightSegments ? -0.5 / widthSegments : 0;

      for (ix = 0; ix <= widthSegments; ix++) {
        var u = ix / widthSegments;
        vertex[0] = -radius * Math.cos(phiStart + u * phiLength) * Math.sin(thetaStart + v * thetaLength);
        vertex[1] = radius * Math.cos(thetaStart + v * thetaLength);
        vertex[2] = radius * Math.sin(phiStart + u * phiLength) * Math.sin(thetaStart + v * thetaLength);
        vertices.push(vertex[0], vertex[1], vertex[2]);
        gl.vec3.set(normal, vertex[0], vertex[1], vertex[2]);
        gl.vec3.normalize(normal, normal);
        normals.push(normal[0], normal[1], normal[2]);
        uvs.push(u + uOffset, 1 - v);
        verticesRow.push(index++);
      }

      grid.push(verticesRow);
    }

    for (iy = 0; iy < heightSegments; iy++) {
      for (ix = 0; ix < widthSegments; ix++) {
        var a = grid[iy][ix + 1];
        var b = grid[iy][ix];
        var c = grid[iy + 1][ix];
        var d = grid[iy + 1][ix + 1];
        if (iy !== 0 || thetaStart > 0) indices.push(a, b, d);
        if (iy !== heightSegments - 1 || thetaEnd < Math.PI) indices.push(b, c, d);
      }
    }

    return {
      vertices: vertices,
      textures: uvs,
      normals: normals,
      indices: indices
    };
  }

  var sphere = SphereGeometry(2, 128, 128);
  function getModel(model) {
    if (model === 'cube') {
      return {
        attributes: {
          POSITION: {
            array: new Int8Array(cubePosition)
          },
          NORMAL: {
            array: new Int8Array(cubeNormal)
          }
        },
        indices: new Uint16Array(cubeIndices),
        mode: 4
      };
    } else if (model === 'sphere') {
      return {
        attributes: {
          POSITION: {
            array: sphere.vertices
          },
          NORMAL: {
            array: sphere.normals
          },
          TEXCOORD_0: {
            array: sphere.textures
          }
        },
        indices: sphere.indices,
        mode: 4
      };
    }

    return null;
  }

  function getDefaultShaderTypings() {
    var phongStudioTypings = {
      structure: {
        name: 'phong',
        groups: [{
          name: 'highLight',
          children: [{
            name: 'lightPosition'
          }, {
            name: 'lightAmbient'
          }, {
            name: 'lightDiffuse'
          }, {
            name: 'lightSpecular'
          }]
        }, {
          name: 'diffuse',
          children: [{
            name: 'ambientStrength'
          }, {
            name: 'specularStrength'
          }, {
            name: 'materialShininess'
          }]
        }, {
          name: 'opacity',
          children: [{
            name: 'opacity'
          }]
        }]
      },
      typing: {
        name: 'phong',
        presets: [{
          name: 'default',
          value: {
            lightPosition: [1, 1, 1],
            lightAmbient: [0, 0, 0, 1],
            lightDiffuse: [0.5, 0.5, 0.5, 1],
            lightSpecular: [0.1, 0.7, 0.3, 1],
            specularStrength: 0.8,
            ambientStrength: 0.5,
            materialShininess: 32,
            opacity: 1
          }
        }, {
          name: 'highLight',
          value: {
            lightPosition: [1, 1, 1],
            lightAmbient: [0.7, 1, 1, 1],
            lightDiffuse: [0.2, 0.1, 0.9, 1],
            lightSpecular: [0.5, 0.3, 0.7, 1],
            specularStrength: 0.7,
            ambientStrength: 0.8,
            materialShininess: 64,
            opacity: 0.5
          }
        }],
        properties: {
          lightPosition: {
            type: 'array',
            name: 'lightPosition',
            value: [1, 1, 1],
            items: [{
              type: 'range',
              name: 'directionX',
              options: [0.1, 10, 0.1]
            }, {
              type: 'range',
              name: 'directionY',
              options: [0.1, 10, 0.1]
            }, {
              type: 'range',
              name: 'directionZ',
              options: [0.1, 10, 0.1]
            }]
          },
          lightAmbient: {
            type: 'color',
            name: 'lightAmbient',
            value: [1.0, 1.0, 1.0, 1.0]
          },
          lightDiffuse: {
            type: 'color',
            name: 'lightDiffuse',
            value: [0.5, 0.5, 0.5, 1.0]
          },
          lightSpecular: {
            type: 'color',
            name: 'lightSpecular',
            value: [0.1, 0.7, 0.3, 1.0]
          },
          ambientStrength: {
            type: 'range',
            name: 'ambientStrength',
            options: [0.1, 1, 0.1],
            value: 0.5
          },
          specularStrength: {
            type: 'range',
            name: 'specularStrength',
            options: [0.1, 1, 0.1],
            value: 0.8
          },
          materialShininess: {
            type: 'range',
            name: 'materialShininess',
            options: [1.0, 64.0, 1.0],
            value: 32
          },
          opacity: {
            type: 'range',
            name: 'opacity',
            options: [0, 1, 0.01],
            value: 1
          }
        }
      }
    };
    var wireframeStudioTypings = {
      structure: {
        name: 'wireframe',
        groups: [{
          name: 'color',
          children: [{
            name: 'fill'
          }, {
            name: 'stroke'
          }]
        }, {
          name: 'dash',
          children: [{
            name: 'dashEnabled'
          }, {
            name: 'dashAnimate'
          }, {
            name: 'dashOverlap'
          }, {
            name: 'dashRepeats'
          }, {
            name: 'dashLength'
          }]
        }, {
          name: 'squeeze',
          children: [{
            name: 'seeThrough'
          }, {
            name: 'insideAltColor'
          }, {
            name: 'dualStroke'
          }, {
            name: 'squeezeMin'
          }, {
            name: 'squeezeMax'
          }]
        }, {
          name: 'opacity',
          children: [{
            name: 'alpha'
          }]
        }]
      },
      typing: {
        name: 'wireframe',
        presets: [{
          name: 'Sleek',
          value: {
            'seeThrough': true,
            'thickness': 0.01,
            'fill': [0.7725, 0.7725, 0.7725, 1.0],
            'stroke': [0.1255, 0.1255, 0.1255, 1],
            'dashEnabled': true,
            'dashAnimate': false,
            'dashRepeats': 9,
            'dashLength': 0.7,
            'dashOverlap': true,
            'noiseA': false,
            'noiseB': false,
            'insideAltColor': true,
            'squeeze': true,
            'squeezeMin': 0.1,
            'squeezeMax': 1,
            'dualStroke': false,
            'secondThickness': 0.05
          }
        }, {
          name: 'FunkyTorus',
          value: {
            'seeThrough': false,
            'thickness': 0.02,
            'fill': [0.0549, 0.1411, 0.1882, 1.0],
            'stroke': [0.9882, 0.2274, 0.3176, 1.0],
            'dashEnabled': false,
            'dashAnimate': false,
            'dashRepeats': 1,
            'dashLength': 0.8,
            'dashOverlap': true,
            'noiseA': false,
            'noiseB': false,
            'insideAltColor': true,
            'squeeze': true,
            'squeezeMin': 0,
            'squeezeMax': 1,
            'dualStroke': true,
            'secondThickness': 0.05
          }
        }, {
          name: 'BlockyFade',
          value: {
            'seeThrough': true,
            'thickness': 0.01,
            'fill': [0.698, 0.8353, 0.7294, 1.0],
            'stroke': [0.3803, 0.6784, 0.6274, 1.0],
            'dashEnabled': false,
            'dashAnimate': false,
            'dashRepeats': 1,
            'dashLength': 0.9,
            'dashOverlap': true,
            'noiseA': true,
            'noiseB': false,
            'insideAltColor': true,
            'squeeze': true,
            'squeezeMin': 0.1,
            'squeezeMax': 1,
            'dualStroke': false,
            'secondThickness': 0.05
          }
        }, {
          name: 'SimpleWire',
          value: {
            'seeThrough': true,
            'thickness': 0.03,
            'fill': [0.8235, 0.8235, 0.8235, 1.0],
            'stroke': [0.698, 0.2274, 0.9333, 1.0],
            'dashEnabled': false,
            'dashAnimate': false,
            'dashRepeats': 1,
            'dashLength': 0.8,
            'dashOverlap': true,
            'noiseA': false,
            'noiseB': false,
            'insideAltColor': false,
            'squeeze': false,
            'squeezeMin': 0.5,
            'squeezeMax': 1,
            'dualStroke': false,
            'secondThickness': 0.05
          }
        }, {
          name: 'NicerWire',
          value: {
            'seeThrough': true,
            'thickness': 0.03,
            'fill': [0.9019, 0.9019, 0.9019, 1.0],
            'stroke': [0.145, 0.145, 0.145, 1.0],
            'dashEnabled': false,
            'dashAnimate': false,
            'dashRepeats': 1,
            'dashLength': 0.8,
            'dashOverlap': true,
            'noiseA': false,
            'noiseB': false,
            'insideAltColor': true,
            'squeeze': true,
            'squeezeMin': 0.4,
            'squeezeMax': 1,
            'dualStroke': false,
            'secondThickness': 0.05
          }
        }, {
          name: 'Animated',
          value: {
            'seeThrough': false,
            'thickness': 0.02,
            'fill': [0.7764, 0.8392, 0.7215, 1.0],
            'stroke': [0.596, 0.498, 0.4117, 1.0],
            'dashEnabled': true,
            'dashAnimate': true,
            'dashRepeats': 6,
            'dashLength': 0.6,
            'dashOverlap': true,
            'noiseA': false,
            'noiseB': false,
            'insideAltColor': false,
            'squeeze': true,
            'squeezeMin': 0.2,
            'squeezeMax': 1,
            'dualStroke': false,
            'secondThickness': 0.03
          }
        }, {
          name: 'FunZone',
          value: {
            'seeThrough': true,
            'thickness': 0.02,
            'fill': [0.1058, 0.6901, 0.8078, 1.0],
            'stroke': [0.3098, 0.5255, 0.6, 1.0],
            'dashEnabled': false,
            'dashAnimate': false,
            'dashRepeats': 2,
            'dashLength': 0.7,
            'dashOverlap': true,
            'noiseA': true,
            'noiseB': true,
            'insideAltColor': true,
            'squeeze': true,
            'squeezeMin': 0.2,
            'squeezeMax': 1,
            'dualStroke': false,
            'secondThickness': 0.03
          }
        }, {
          name: 'Dotted',
          value: {
            'seeThrough': true,
            'thickness': 0.04,
            'fill': [0.8117, 0.498, 0.3686, 1.0],
            'stroke': [0.5765, 0.2, 0.2, 1.0],
            'dashEnabled': true,
            'dashAnimate': false,
            'dashRepeats': 8,
            'dashLength': 0.5,
            'dashOverlap': true,
            'noiseA': false,
            'noiseB': false,
            'insideAltColor': true,
            'squeeze': true,
            'squeezeMin': 0.2,
            'squeezeMax': 1,
            'dualStroke': false,
            'secondThickness': 0.05
          }
        }, {
          name: 'Flower',
          value: {
            'seeThrough': true,
            'thickness': 0.09,
            'fill': [0.8392, 0.8823, 0.7804, 1.0],
            'stroke': [0.5804, 0.7804, 0.7137, 1.0],
            'dashEnabled': true,
            'dashAnimate': false,
            'dashRepeats': 1,
            'dashLength': 0.8,
            'dashOverlap': false,
            'noiseA': false,
            'noiseB': false,
            'insideAltColor': true,
            'squeeze': true,
            'squeezeMin': 0.2,
            'squeezeMax': 0,
            'dualStroke': false,
            'secondThickness': 0.05
          }
        }, {
          name: 'Tapered',
          value: {
            'seeThrough': false,
            'thickness': 0.015,
            'fill': [0.898, 0.8666, 0.7961, 1.0],
            'stroke': [0.9215, 0.4823, 0.349, 1.0],
            'dashEnabled': true,
            'dashAnimate': false,
            'dashRepeats': 1,
            'dashLength': 0.6,
            'dashOverlap': true,
            'noiseA': false,
            'noiseB': false,
            'insideAltColor': true,
            'squeeze': true,
            'squeezeMin': 0,
            'squeezeMax': 0.64,
            'dualStroke': false,
            'secondThickness': 0.03
          }
        }],
        properties: {
          time: {
            name: 'time',
            type: 'range',
            value: 0.0
          },
          seeThrough: {
            name: 'seeThrough',
            type: 'switch',
            value: true
          },
          fill: {
            name: 'fill',
            type: 'color',
            value: [1.0, 0.5137, 0.98, 1.0]
          },
          stroke: {
            name: 'stroke',
            type: 'color',
            value: [0.7019, 0.9333, 0.2274, 1.0]
          },
          dashEnabled: {
            name: 'dashEnabled',
            type: 'switch',
            value: false
          },
          dashAnimate: {
            name: 'dashAnimate',
            type: 'switch',
            value: false
          },
          dashOverlap: {
            name: 'dashOverlap',
            type: 'switch',
            value: true
          },
          dashRepeats: {
            name: 'dashRepeats',
            type: 'range',
            options: [0.0, 10.0, 1.0],
            value: 1.0
          },
          dashLength: {
            name: 'dashLength',
            type: 'range',
            options: [0.0, 10.0, 0.1],
            value: 0.8
          },
          thickness: {
            name: 'thickness',
            type: 'range',
            options: [0.01, 1.0, 0.01],
            value: 0.03
          },
          secondThickness: {
            name: 'secondThickness',
            type: 'range',
            options: [0.01, 1.0, 0.01],
            value: 0.05
          },
          insideAltColor: {
            name: 'insideAltColor',
            type: 'switch',
            value: false
          },
          squeeze: {
            name: 'squeeze',
            type: 'switch',
            value: false
          },
          dualStroke: {
            name: 'dualStroke',
            type: 'switch',
            value: false
          },
          squeezeMin: {
            name: 'squeezeMin',
            type: 'range',
            options: [0.1, 1.0, 0.1],
            value: 0.5
          },
          squeezeMax: {
            name: 'squeezeMax',
            type: 'range',
            options: [0.1, 1.0, 0.1],
            value: 1.0
          },
          opacity: {
            type: 'range',
            name: 'opacity',
            options: [0, 1, 0.01],
            value: 1
          }
        }
      }
    };
    return {
      phongStudioTypings: phongStudioTypings,
      wireframeStudioTypings: wireframeStudioTypings
    };
  }

  var options$1 = {
    'renderer': 'gl',
    'doubleBuffer': false,
    'glOptions': null,
    'markerEvents': true,
    forceRenderOnZooming: true,
    forceRenderOnMoving: true,
    forceRenderOnRotating: true
  };
  var uid = 0;
  var MAP_EVENTS = ['mousedown', 'mouseup', 'mousemove', 'click', 'dbclick', 'touchstart', 'touchmove', 'touchend'];
  var PREFILTER_CUBE_SIZE$1 = 512;

  var GLTFLayer = function (_maptalks$Layer) {
    _inheritsLoose(GLTFLayer, _maptalks$Layer);

    function GLTFLayer(id, options) {
      var _this;

      _this = _maptalks$Layer.call(this, id, options) || this;
      _this._markerMap = {};
      _this._markerList = [];
      _this.requests = {};
      _this._modelMap = {};
      _this._idList = {};
      _this.mapEvents = '';

      if (options && options.data) {
        _this.addMarker(options.data);
      }

      return _this;
    }

    GLTFLayer.registerShader = function registerShader(name, type, config, uniforms, shaderTypings) {
      checkTypings(uniforms, shaderTypings);
      SHADER_MAP[name] = {
        name: name,
        type: type,
        config: config,
        uniforms: uniforms,
        shaderTypings: shaderTypings
      };
    };

    GLTFLayer.removeShader = function removeShader(name) {
      delete SHADER_MAP[name];
    };

    GLTFLayer.getShaders = function getShaders() {
      var shaders = [];

      for (var name in SHADER_MAP) {
        shaders.push({
          shader: name,
          uniforms: SHADER_MAP[name].uniforms,
          shaderTypings: SHADER_MAP[name].shaderTypings
        });
      }

      return shaders;
    };

    GLTFLayer.getShaderMap = function getShaderMap() {
      return SHADER_MAP;
    };

    GLTFLayer.initDefaultShader = function initDefaultShader() {
      var defaultShaderTypings = getDefaultShaderTypings();
      var phongShader = getPhongShader();
      GLTFLayer.registerShader('phong', 'PhongShader', phongShader.shader, phongShader.material.getUniforms(), defaultShaderTypings.phongStudioTypings);
      var wireFrameShader = getWireFrameShader();
      GLTFLayer.registerShader('wireframe', 'WireframeShader', wireFrameShader.shader, wireFrameShader.material.getUniforms(), defaultShaderTypings.wireframeStudioTypings);
      var LitShader = getLitShader();
      GLTFLayer.registerShader('lit', 'pbr.LitShader', LitShader.shader, LitShader.material);
      var SubsufaceShader = getSubsurfaceShader();
      GLTFLayer.registerShader('subsurface', 'pbr.SubsurfaceShader', SubsufaceShader.shader, SubsufaceShader.material);
      var ClothShader = getClothShader();
      GLTFLayer.registerShader('cloth', 'pbr.ClothShader', ClothShader.shader, ClothShader.material);
    };

    GLTFLayer.getStudioTypings = function getStudioTypings$$1() {
      var studioTypings = getStudioTypings();

      var shaderTypings = GLTFLayer.getShaders().map(function (shader) {
        return shader.shaderTypings;
      });

      for (var i = 0; i < shaderTypings.length; i++) {
        var shaderTyping = shaderTypings[i];

        if (shaderTyping) {
          var symbolProperties = studioTypings.typing.items[0].properties.symbol.properties;
          studioTypings.groups[1].children.push(shaderTyping.structure);
          symbolProperties.shader.options.push(shaderTyping.typing.name);
          symbolProperties.uniforms.oneOf.push(shaderTyping.typing);
        }
      }

      return studioTypings;
    };

    GLTFLayer.fromJSON = function fromJSON(json) {
      if (!json || json['type'] !== 'GLTFLayer') {
        return null;
      }

      var layer = new GLTFLayer(json['id'], json['options']);
      var geoJSONs = json['geometries'];
      var geometries = [];

      for (var i = 0; i < geoJSONs.length; i++) {
        var geo = GLTFMarker.fromJSON(geoJSONs[i]);

        if (geo) {
          geometries.push(geo);
        }
      }

      layer.addMarker(geometries);

      if (json['style']) {
        layer.setStyle(json['style']);
      }

      return layer;
    };

    var _proto = GLTFLayer.prototype;

    _proto.addMarker = function addMarker(markers) {
      var _this2 = this;

      if (GeoJSON.isGeoJSON(markers)) {
        return this.addMarker(GeoJSON.toGeometry(markers));
      }

      if (Array.isArray(markers)) {
        markers.forEach(function (marker) {
          _this2.addMarker(marker);
        });
      } else {
        var marker = markers;
        marker._uid = uid;
        this._markerMap[uid] = marker;

        this._markerList.push(marker);

        marker._layer = this;

        this._addEvents(marker.getListeningEvents());

        var id = marker.getId();

        if (id) {
          this._idList[id] = marker;
        }

        this._loadModel(marker);

        marker.fire('add', {
          type: 'add',
          target: marker,
          layer: this
        });

        if (marker.getType() === 'groupgltfmarker') {
          uid += marker.getCount() - 1;
        } else {
          uid++;
        }
      }

      return this;
    };

    _proto.getModels = function getModels() {
      this._modelMap['sphere'] = getModel('sphere');
      return this._modelMap;
    };

    _proto.toJSON = function toJSON(options) {
      if (!options) {
        options = {};
      }

      var profile = {
        'type': this.getJSONType(),
        'id': this.getId(),
        'options': this.config()
      };

      if (isNil(options['style']) || options['style']) {
        profile['style'] = this.getStyle();
      }

      if (isNil(options['geometries']) || options['geometries']) {
        var geoJSONs = [];
        var markers = this.getMarkers();

        for (var i = 0; i < markers.length; i++) {
          var marker = markers[i];
          var json = marker.toJSON();
          geoJSONs.push(json);
        }

        profile['geometries'] = geoJSONs;
      }

      return profile;
    };

    _proto._loadModel = function _loadModel(marker) {
      var url = marker.getUrl();

      if (url === 'sphere') {
        this._loadSimpleModel(marker);
      } else {
        this._loadGLTFData(marker);
      }
    };

    _proto._loadGLTFData = function _loadGLTFData(marker) {
      var _this3 = this;

      var renderer = this.getRenderer();

      if (renderer) {
        return this._requestGLTFData(marker);
      } else {
        this.on('renderercreate', function () {
          _this3._requestGLTFData(marker);
        });
      }

      return null;
    };

    _proto._requestGLTFData = function _requestGLTFData(marker) {
      var _this4 = this;

      var url = marker.getUrl();
      var renderer = this.getRenderer();

      if (!this.requests[url]) {
        this.requests[url] = marker._loadData();
        this.requests[url].count = 0;
      }

      return this.requests[url].then(function (data) {
        if (!_this4._markerMap[marker._uid] || !_this4.requests[url]) {
          return;
        }

        var gltfData = marker._getGLTFData();

        if (!gltfData) {
          marker._setGLTFData(data);
        }

        _this4.requests[url].gltfjson = marker._getGLTFJson();
        _this4._modelMap[url] = data;

        renderer._createScene(marker);

        renderer._updateGeometries(marker);

        _this4.requests[url].count += 1;
        _this4.requests[url].complete = true;

        marker._setLoadState(true);

        marker.fire('load', {
          data: gltfData
        });

        if (_this4._isModelsLoadComplete()) {
          _this4.fire('modelload', {
            models: _this4.getModels()
          });
        }
      });
    };

    _proto._isRequestsComplete = function _isRequestsComplete() {
      for (var i in this.requests) {
        if (!this.requests[i].complete) {
          return false;
        }
      }

      return true;
    };

    _proto._isModelsLoadComplete = function _isModelsLoadComplete() {
      for (var i = 0; i < this._markerList.length; i++) {
        if (!this._markerList[i].isLoaded()) {
          return false;
        }
      }

      return true;
    };

    _proto._loadSimpleModel = function _loadSimpleModel(marker) {
      var url = marker.getUrl();
      marker._gltfData = this._modelMap[url] = getModel(url);
      var renderer = this.getRenderer();

      if (renderer) {
        renderer._createScene(marker);
      } else {
        this.on('renderercreate', function (e) {
          e.renderer._createScene(marker);
        });
      }

      marker._setLoadState(true);

      marker.fire('load', {
        data: marker._gltfData
      });
    };

    _proto.setStyle = function setStyle(layerStyle) {
      if (!layerStyle) {
        delete this._layerStyle;
        return this;
      }

      this._layerStyle = JSON.parse(JSON.stringify(layerStyle));

      this._styleMarkerList();

      return this;
    };

    _proto.getStyle = function getStyle() {
      if (this._layerStyle) {
        return this._layerStyle.$root ? this._layerStyle.style : this._layerStyle;
      }

      return this._layerStyle;
    };

    _proto.updateSymbol = function updateSymbol(idx, symbolProperties) {
      var style = this.getStyle();

      if (!style) {
        return;
      }

      var symbol = style[idx].symbol || {};

      for (var p in symbolProperties) {
        symbol[p] = symbolProperties[p];
      }

      this._styleMarkerList();
    };

    _proto._styleMarkerList = function _styleMarkerList() {
      this._processRootUrl(this._layerStyle);

      var cookStyles = this._layerStyle.$root ? this._layerStyle.style : this._layerStyle;
      this._cookedStyles = compileStyle(cookStyles);

      this._markerList.forEach(function (marker) {
        this._styleMarker(marker);
      }, this);
    };

    _proto.getGLTFUrls = function getGLTFUrls() {
      return Object.keys(this.requests);
    };

    _proto._processRootUrl = function _processRootUrl(layerStyle) {
      if (maptalks.Util.isString(layerStyle.$root)) {
        var regex = /\{*(\$root)*\}/g;
        layerStyle.style.forEach(function (stl) {
          var url = stl.symbol.url;

          if (url && url.indexOf('{$root}') > -1) {
            stl.symbol.url = url.replace(regex, layerStyle.$root);
          }
        });
      }
    };

    _proto._styleMarker = function _styleMarker(marker) {
      var _this5 = this;

      if (!this._cookedStyles) {
        return false;
      }

      for (var i = 0, len = this._cookedStyles.length; i < len; i++) {
        if (this._cookedStyles[i]['filter']({
          properties: marker.getProperties()
        }) === true) {
          var _ret = function () {
            var symbol = _this5._cookedStyles[i]['symbol'];
            var newUrl = symbol.url;
            var oldUrl = marker.getUrl();

            marker._setPropInExternSymbol('url', newUrl);

            if (newUrl && newUrl !== oldUrl) {
              _this5._loadGLTFData(marker).then(function () {
                _this5._removeGLTFRequests(oldUrl);

                marker._setExternSymbol(symbol);
              });
            } else {
              marker._setExternSymbol(symbol);
            }

            return {
              v: true
            };
          }();

          if (typeof _ret === "object") return _ret.v;
        }
      }

      return false;
    };

    _proto._updateGeometries = function _updateGeometries(marker) {
      var renderer = this.getRenderer();

      if (renderer) {
        renderer._updateGeometries(marker);
      }
    };

    _proto._addEvents = function _addEvents(events) {
      var _this6 = this;

      var splitEvents = maptalks.Util.isString(events) ? events.split(/\s+/).map(function (e) {
        return e === 'mouseleave' || e === 'mouseenter' || e === 'mouseout' ? 'mousemove' : e;
      }) : events;
      var currentEvents = this.mapEvents;
      var newEvents = intersectArray(splitEvents, MAP_EVENTS).filter(function (e) {
        return _this6.mapEvents.indexOf(e) < 0;
      });
      this.mapEvents += ' ' + newEvents.join(' ');
      this.mapEvents = this.mapEvents.trim();
      var map = this.getMap();

      if (map) {
        map.off(currentEvents, this._mapEventHandler, this);
        map.on(this.mapEvents, this._mapEventHandler, this);
      }
    };

    _proto._removeEvents = function _removeEvents() {
      var newEvents = {};
      var currentEvents = this.mapEvents;

      for (var i = 0; i < this._markerList.length; i++) {
        var marker = this._markerList[i];
        var markerEvents = marker.getListeningEvents().map(function (e) {
          return e === 'mouseleave' || e === 'mouseenter' || e === 'mouseout' ? 'mousemove' : e;
        });

        for (var ii = 0; ii < markerEvents.length; ii++) {
          newEvents[markerEvents[ii]] = 1;
        }
      }

      this.mapEvents = intersectArray(Object.keys(newEvents), MAP_EVENTS).join(' ');
      var map = this.getMap();

      if (map) {
        map.off(currentEvents, this._mapEventHandler, this);
        map.on(this.mapEvents, this._mapEventHandler, this);
      }
    };

    _proto.removeMarker = function removeMarker(markers) {
      var _this7 = this;

      if (Array.isArray(markers)) {
        markers.forEach(function (marker) {
          _this7.removeMarker(marker);
        });
      } else {
        this._deleteMarker(markers);

        this._removeEvents();
      }
    };

    _proto.remove = function remove() {
      var map = this.getMap();

      if (!map) {
        return;
      }

      map.off(this.mapEvents, this._mapEventHandler);

      _maptalks$Layer.prototype.remove.call(this);
    };

    _proto.identify = function identify(x, y, options) {
      var renderer = this.getRenderer();

      if (renderer) {
        return renderer._identify(x, y, options);
      }

      return null;
    };

    _proto._deleteMarker = function _deleteMarker(marker) {
      var url = marker.getUrl();
      var id = maptalks.Util.isString(marker) ? this._idList[marker]._uid : marker._uid;

      this._markerList.splice(this._markerList.indexOf(this._markerMap[id]), 1);

      if (this.requests[url]) {
        this.requests[url].count -= 1;
      }

      if (this.requests[url].count <= 0) {
        delete this.requests[url];
      }

      var renderer = this.getRenderer();

      if (renderer) {
        renderer._deleteScene(id);
      }

      delete this._markerMap[id];
      delete this._idList[marker];
    };

    _proto._removeGLTFRequests = function _removeGLTFRequests(url) {
      if (!this.requests[url]) {
        return;
      }

      this.requests[url].count -= 1;

      if (this.requests[url].count <= 0) {
        delete this.requests[url];
        delete this._modelMap[url];
      }

      var renderer = this.getRenderer();

      if (renderer) {
        renderer._removeGeometry(url);
      }
    };

    _proto.getMarkers = function getMarkers() {
      return this._markerList;
    };

    _proto.getById = function getById(id) {
      return this._idList[id];
    };

    _proto.getCount = function getCount() {
      return this._markerList.length;
    };

    _proto.getAll = function getAll() {
      return this._markerList.slice(0);
    };

    _proto.clear = function clear() {
      var renderer = this.getRenderer();

      if (renderer) {
        renderer._deleteAll();
      }

      this._markerMap = {};
      this._markerList = [];
      this.requests = {};
      this._idList = {};
      return this;
    };

    _proto._mapEventHandler = function _mapEventHandler(e) {
      if (!this.options.markerEvents) {
        return;
      }

      var map = this.getMap();

      if (!map) {
        return;
      }

      this._lastTargetId = this._currentTargetId;
      this._lastPoint = this._currentPoint;
      this._lastMeshId = this._currentMeshId;
      this._lastPickingId = this._currentPickingId;
      var containerPoint = map.coordinateToContainerPoint(e.coordinate, map.getGLZoom());
      var x = Math.round(containerPoint.x),
          y = Math.round(containerPoint.y);

      if (x <= 0 || x >= map.width || y <= 0 || y >= map.height) {
        this._currentTargetId = null;
        this._currentMeshId = null;
        this._currentPoint = null;
        return;
      }

      var result = this.identify(x, y);

      if (!result) {
        return;
      }

      this._currentTargetId = result.target ? result.target._uid : null;
      this._currentMeshId = result.meshId;
      this._currentPoint = JSON.stringify(result.point);
      this._currentPickingId = result.pickingId;

      if (e.type === 'mousemove') {
        var mousemoveTargets = this._getMouseMoveTargets();

        mousemoveTargets.forEach(function (e) {
          e.target.fire(e.type, e);
        });
      } else if (result.target) {
        result.target.fire(e.type, {
          type: e.type,
          target: result.target,
          meshId: result.meshId,
          pickingId: result.pickingId,
          point: result.point
        });
      }
    };

    _proto._getMouseMoveTargets = function _getMouseMoveTargets() {
      var eventTargets = [];

      if (defined(this._currentTargetId) && !defined(this._lastTargetId)) {
        eventTargets.push({
          type: 'mouseenter',
          target: this._markerMap[this._currentTargetId],
          meshId: this._currentMeshId,
          pickingId: this._currentPickingId,
          point: JSON.parse(this._currentPoint)
        });
      } else if (!defined(this._currentTargetId) && defined(this._lastTargetId)) {
        eventTargets.push({
          type: 'mouseout',
          target: this._markerMap[this._lastTargetId],
          meshId: this._lastMeshId,
          pickingId: this._lastPickingId,
          point: JSON.parse(this._lastPoint)
        }, {
          type: 'mouseleave',
          target: this._markerMap[this._lastTargetId],
          meshId: this._lastMeshId,
          pickingId: this._lastPickingId,
          point: JSON.parse(this._lastPoint)
        });
      } else if (defined(this._currentTargetId) && defined(this._lastTargetId)) {
        if (this._currentTargetId === this._lastTargetId) {
          eventTargets.push({
            type: 'mousemove',
            target: this._markerMap[this._currentTargetId],
            meshId: this._currentMeshId,
            pickingId: this._currentPickingId,
            point: JSON.parse(this._currentPoint)
          });
        } else {
          eventTargets.push({
            type: 'mouseenter',
            target: this._markerMap[this._currentTargetId],
            meshId: this._currentMeshId,
            pickingId: this._currentPickingId,
            point: JSON.parse(this._currentPoint)
          }, {
            type: 'mouseout',
            target: this._markerMap[this._lastTargetId],
            meshId: this._lastMeshId,
            pickingId: this._lastPickingId,
            point: JSON.parse(this._lastPoint)
          }, {
            type: 'mouseleave',
            target: this._markerMap[this._lastTargetId],
            meshId: this._lastMeshId,
            pickingId: this._lastPickingId,
            point: JSON.parse(this._lastPoint)
          });
        }
      }

      return eventTargets;
    };

    _proto.getResourceFiles = function getResourceFiles(cb) {
      var _this8 = this;

      if (!cb) {
        return;
      }

      if (this._isModelsLoadComplete()) {
        cb(this._copyResources());
      } else {
        this.on('modelload', function () {
          cb(_this8._copyResources());
        });
      }
    };

    _proto._copyResources = function _copyResources() {
      var resources = {};

      for (var key in this.requests) {
        var json = this.requests[key].gltfjson;
        var files = resolveResouceFiles(json);
        resources[key] = files;
      }

      return resources;
    };

    _proto.setIBLSkyBox = function setIBLSkyBox(skyboxTextures) {
      var _this9 = this;

      var promises = skyboxTextures.map(function (url) {
        return new Promise(function (resolve) {
          var img = new Image();

          img.onload = function () {
            resolve(img);
          };

          img.src = url;
        });
      });
      Promise.all(promises).then(function (images) {
        var renderer = _this9.getRenderer();

        if (renderer) {
          _this9._cresteIBLMaps(images, renderer);
        } else {
          _this9.on('renderercreate', function (e) {
            _this9._cresteIBLMaps(images, e.renderer);
          });
        }
      });
    };

    _proto._cresteIBLMaps = function _cresteIBLMaps(images, renderer) {
      var map = this.getMap();
      var iblMaps = createMaps(renderer.regl, images.slice(0, 6));
      renderer._iblUniforms = {
        'light_iblDFG': iblMaps.dfgLUT,
        'light_iblSpecular': iblMaps.prefilterMap,
        'resolution': [renderer.canvas.width, renderer.canvas.height, 1 / renderer.canvas.width, 1 / renderer.canvas.height],
        'cameraPosition': map.cameraPosition,
        'iblSH': iblMaps.sh
      };
      renderer._uniforms = maptalks.Util.extend({}, renderer._iblUniforms, renderer._uniforms);
    };

    return GLTFLayer;
  }(maptalks.Layer);
  GLTFLayer.initDefaultShader();
  GLTFLayer.mergeOptions(options$1);
  GLTFLayer.registerJSONType('GLTFLayer');
  GLTFLayer.registerRenderer('gl', GLTFLayerRenderer);

  function checkTypings(uniforms, studioTypings) {
    if (!studioTypings) {
      return;
    }

    var names = Object.keys(uniforms);
    var studioTypeNames = Object.keys(studioTypings.typing.properties);
    var intersect = intersectArray(names, studioTypeNames);

    if (intersect.length < names.length) {
      throw new Error('studioTypings\'s name is not matching with unifroms\'s name');
    }
  }

  function getPhongShader() {
    var shader = {
      positionAttribute: 'POSITION'
    };
    var material = new gl.reshader.PhongMaterial();
    return {
      shader: shader,
      material: material
    };
  }

  function getWireFrameShader() {
    var shader = {
      positionAttribute: 'POSITION',
      extraCommandProps: {
        cull: {
          enable: false,
          face: 'back'
        },
        frontFace: 'cw'
      }
    };
    var material = new gl.reshader.WireFrameMaterial();
    return {
      shader: shader,
      material: material
    };
  }

  function getLitShader() {
    var shader = {
      positionAttribute: 'POSITION',
      normalAttribute: 'NORMAL',
      tangentAttribute: 'TANGENT',
      colorAttribute: 'COLOR_0',
      uv0Attribute: 'TEXCOORD_0',
      uv1Attribute: 'TEXCOORD_1',
      extraCommandProps: {
        cull: {
          enable: false,
          face: 'back'
        }
      }
    };
    var material = new gl.reshader.pbr.LitMaterial({
      'baseColorFactor': [1.0, 1.0, 1.0, 1.0],
      'metallicFactor': 0.5,
      'roughnessFactor': 0.5,
      'reflectance': 0.5,
      'clearCoat': 0,
      'clearCoatRoughness': 0.3,
      'anisotropy': 0
    });
    return {
      shader: shader,
      material: material
    };
  }

  function getSubsurfaceShader() {
    var shader = {
      positionAttribute: 'POSITION',
      normalAttribute: 'NORMAL',
      tangentAttribute: 'TANGENT',
      colorAttribute: 'COLOR_0',
      uv0Attribute: 'TEXCOORD_0',
      uv1Attribute: 'TEXCOORD_1'
    };
    var material = new gl.reshader.pbr.SubsurfaceMaterial();
    return {
      shader: shader,
      material: material
    };
  }

  function getClothShader() {
    var shader = {
      positionAttribute: 'POSITION',
      normalAttribute: 'NORMAL',
      tangentAttribute: 'TANGENT',
      colorAttribute: 'COLOR_0',
      uv0Attribute: 'TEXCOORD_0',
      uv1Attribute: 'TEXCOORD_1'
    };
    var material = new gl.reshader.pbr.ClothMaterial();
    return {
      shader: shader,
      material: material
    };
  }

  function resolveResouceFiles(gltf) {
    var resources = [];

    var getUri = function getUri(res) {
      var uri = [];

      if (res) {
        for (var i = 0; i < res.length; i++) {
          var r = res[i];

          if (r && typeof r.uri === 'string') {
            uri.push(r.uri);
          }
        }
      }

      return uri;
    };

    resources = resources.concat(getUri(gltf.buffers));
    resources = resources.concat(getUri(gltf.images));
    return resources;
  }

  function createMaps(regl, hdr) {
    return gl.reshader.pbr.PBRHelper.createIBLMaps(regl, {
      envTexture: hdr,
      envCubeSize: PREFILTER_CUBE_SIZE$1,
      prefilterCubeSize: 512
    });
  }

  exports.GLTFLayer = GLTFLayer;
  exports.GLTFMarker = GLTFMarker;

  Object.defineProperty(exports, '__esModule', { value: true });

  typeof console !== 'undefined' && console.log('@maptalks/gltf-layer v0.1.7, requires maptalks@<2.0.0.');

}));
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFwdGFsa3MuZ2x0Zi1kZXYuanMiLCJzb3VyY2VzIjpbIi4uL25vZGVfbW9kdWxlcy9AbWFwdGFsa3MvZmVhdHVyZS1maWx0ZXIvaW5kZXguanMiLCIuLi9zcmMvY29tbW9uL1V0aWwuanMiLCIuLi8uLi9nbHRmLWxvYWRlci9ub2RlX21vZHVsZXMvem91c2FuL3pvdXNhbi1taW4uanMiLCIuLi8uLi9nbHRmLWxvYWRlci9ub2RlX21vZHVsZXMvZ2wtbWF0cml4L2xpYi9nbC1tYXRyaXgvY29tbW9uLmpzIiwiLi4vLi4vZ2x0Zi1sb2FkZXIvbm9kZV9tb2R1bGVzL2dsLW1hdHJpeC9saWIvZ2wtbWF0cml4L21hdDMuanMiLCIuLi8uLi9nbHRmLWxvYWRlci9ub2RlX21vZHVsZXMvZ2wtbWF0cml4L2xpYi9nbC1tYXRyaXgvbWF0NC5qcyIsIi4uLy4uL2dsdGYtbG9hZGVyL25vZGVfbW9kdWxlcy9nbC1tYXRyaXgvbGliL2dsLW1hdHJpeC92ZWMzLmpzIiwiLi4vLi4vZ2x0Zi1sb2FkZXIvbm9kZV9tb2R1bGVzL2dsLW1hdHJpeC9saWIvZ2wtbWF0cml4L3ZlYzQuanMiLCIuLi8uLi9nbHRmLWxvYWRlci9ub2RlX21vZHVsZXMvZ2wtbWF0cml4L2xpYi9nbC1tYXRyaXgvcXVhdC5qcyIsIi4uLy4uL2dsdGYtbG9hZGVyL25vZGVfbW9kdWxlcy9nbC1tYXRyaXgvbGliL2dsLW1hdHJpeC92ZWMyLmpzIiwiLi4vLi4vZ2x0Zi1sb2FkZXIvZGlzdC9nbHRmLWxvYWRlci5lcy5qcyIsIi4uL25vZGVfbW9kdWxlcy9mcnVzdHVtLWludGVyc2VjdHMvc3JjL2luZGV4LmpzIiwiLi4vc3JjL2NvbW1vbi9TaGFkZXJNYXAuanMiLCIuLi9zcmMvTm9kZS9Ta2luLmpzIiwiLi4vc3JjL05vZGUvVFJTLmpzIiwiLi4vc3JjL0dMVEZMYXllclJlbmRlcmVyLmpzIiwiLi4vbm9kZV9tb2R1bGVzL0BtYXB0YWxrcy9mdW5jdGlvbi10eXBlL2luZGV4LmpzIiwiLi4vc3JjL0dMVEZNYXJrZXIuanMiLCIuLi9zcmMvY29tbW9uL0dlb0pTT04uanMiLCIuLi9zcmMvY29tbW9uL2xhbmd1YWdlLmpzIiwiLi4vc3JjL2NvbW1vbi9zdHVkaW9UeXBpbmdzLmpzIiwiLi4vc3JjL2NvbW1vbi9TaW1wbGVNb2RlbC5qcyIsIi4uL3NyYy9jb21tb24vc2hhZGVyVHlwaW5ncy5qcyIsIi4uL3NyYy9HTFRGTGF5ZXIuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLyohXHJcbiAgICBGZWF0dXJlIEZpbHRlciBieVxyXG5cclxuICAgIChjKSBtYXBib3ggMjAxNiBhbmQgbWFwdGFsa3MgMjAxOFxyXG4gICAgd3d3Lm1hcGJveC5jb20gfCB3d3cubWFwdGFsa3Mub3JnXHJcbiAgICBMaWNlbnNlOiBNSVQsIGhlYWRlciByZXF1aXJlZC5cclxuKi9cclxuY29uc3QgdHlwZXMgPSBbJ1Vua25vd24nLCAnUG9pbnQnLCAnTGluZVN0cmluZycsICdQb2x5Z29uJywgJ011bHRpUG9pbnQnLCAnTXVsdGlMaW5lU3RyaW5nJywgJ011bHRpUG9seWdvbicsICdHZW9tZXRyeUNvbGxlY3Rpb24nXTtcclxuXHJcbi8qKlxyXG4gKiBHaXZlbiBhIGZpbHRlciBleHByZXNzZWQgYXMgbmVzdGVkIGFycmF5cywgcmV0dXJuIGEgbmV3IGZ1bmN0aW9uXHJcbiAqIHRoYXQgZXZhbHVhdGVzIHdoZXRoZXIgYSBnaXZlbiBmZWF0dXJlICh3aXRoIGEgLnByb3BlcnRpZXMgb3IgLnRhZ3MgcHJvcGVydHkpXHJcbiAqIHBhc3NlcyBpdHMgdGVzdC5cclxuICpcclxuICogQHBhcmFtIHtBcnJheX0gZmlsdGVyIG1hcGJveCBnbCBmaWx0ZXJcclxuICogQHJldHVybnMge0Z1bmN0aW9ufSBmaWx0ZXItZXZhbHVhdGluZyBmdW5jdGlvblxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUZpbHRlcihmaWx0ZXIpIHtcclxuICAgIHJldHVybiBuZXcgRnVuY3Rpb24oJ2YnLCBgdmFyIHAgPSAoZiAmJiBmLnByb3BlcnRpZXMgfHwge30pOyByZXR1cm4gJHtjb21waWxlKGZpbHRlcil9YCk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGNvbXBpbGUoZmlsdGVyKSB7XHJcbiAgICBpZiAoIWZpbHRlcikgcmV0dXJuICd0cnVlJztcclxuICAgIGNvbnN0IG9wID0gZmlsdGVyWzBdO1xyXG4gICAgaWYgKGZpbHRlci5sZW5ndGggPD0gMSkgcmV0dXJuIG9wID09PSAnYW55JyA/ICdmYWxzZScgOiAndHJ1ZSc7XHJcbiAgICBjb25zdCBzdHIgPVxyXG4gICAgICAgIG9wID09PSAnPT0nID8gY29tcGlsZUNvbXBhcmlzb25PcChmaWx0ZXJbMV0sIGZpbHRlclsyXSwgJz09PScsIGZhbHNlKSA6XHJcbiAgICAgICAgICAgIG9wID09PSAnIT0nID8gY29tcGlsZUNvbXBhcmlzb25PcChmaWx0ZXJbMV0sIGZpbHRlclsyXSwgJyE9PScsIGZhbHNlKSA6XHJcbiAgICAgICAgICAgICAgICBvcCA9PT0gJzwnIHx8XHJcbiAgICAgICAgICAgICAgICAgICAgb3AgPT09ICc+JyB8fFxyXG4gICAgICAgIG9wID09PSAnPD0nIHx8XHJcbiAgICAgICAgb3AgPT09ICc+PScgPyBjb21waWxlQ29tcGFyaXNvbk9wKGZpbHRlclsxXSwgZmlsdGVyWzJdLCBvcCwgdHJ1ZSkgOlxyXG4gICAgICAgICAgICAgICAgICAgIG9wID09PSAnYW55JyA/IGNvbXBpbGVMb2dpY2FsT3AoZmlsdGVyLnNsaWNlKDEpLCAnfHwnKSA6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG9wID09PSAnYWxsJyA/IGNvbXBpbGVMb2dpY2FsT3AoZmlsdGVyLnNsaWNlKDEpLCAnJiYnKSA6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvcCA9PT0gJ25vbmUnID8gY29tcGlsZU5lZ2F0aW9uKGNvbXBpbGVMb2dpY2FsT3AoZmlsdGVyLnNsaWNlKDEpLCAnfHwnKSkgOlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9wID09PSAnaW4nID8gY29tcGlsZUluT3AoZmlsdGVyWzFdLCBmaWx0ZXIuc2xpY2UoMikpIDpcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb3AgPT09ICchaW4nID8gY29tcGlsZU5lZ2F0aW9uKGNvbXBpbGVJbk9wKGZpbHRlclsxXSwgZmlsdGVyLnNsaWNlKDIpKSkgOlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb3AgPT09ICdoYXMnID8gY29tcGlsZUhhc09wKGZpbHRlclsxXSkgOlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9wID09PSAnIWhhcycgPyBjb21waWxlTmVnYXRpb24oY29tcGlsZUhhc09wKGZpbHRlclsxXSkpIDpcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ3RydWUnO1xyXG4gICAgcmV0dXJuIGAoJHtzdHJ9KWA7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGNvbXBpbGVQcm9wZXJ0eVJlZmVyZW5jZShwcm9wZXJ0eSkge1xyXG4gICAgLy8gY29uc3QgcmVmID1cclxuICAgIC8vICAgICBwcm9wZXJ0eSA9PT0gJyR0eXBlJyA/ICdmLnR5cGUnIDpcclxuICAgIC8vICAgICAgICAgcHJvcGVydHkgPT09ICckaWQnID8gJ2YuaWQnIDogYHBbJHtKU09OLnN0cmluZ2lmeShwcm9wZXJ0eSl9XWA7XHJcbiAgICAvLyByZXR1cm4gcmVmO1xyXG4gICAgcmV0dXJuIHByb3BlcnR5WzBdID09PSAnJCcgPyAnZi4nICsgcHJvcGVydHkuc3Vic3RyaW5nKDEpIDogJ3BbJyArIEpTT04uc3RyaW5naWZ5KHByb3BlcnR5KSArICddJztcclxufVxyXG5cclxuZnVuY3Rpb24gY29tcGlsZUNvbXBhcmlzb25PcChwcm9wZXJ0eSwgdmFsdWUsIG9wLCBjaGVja1R5cGUpIHtcclxuICAgIGNvbnN0IGxlZnQgPSBjb21waWxlUHJvcGVydHlSZWZlcmVuY2UocHJvcGVydHkpO1xyXG4gICAgY29uc3QgcmlnaHQgPSBwcm9wZXJ0eSA9PT0gJyR0eXBlJyA/IHR5cGVzLmluZGV4T2YodmFsdWUpIDogSlNPTi5zdHJpbmdpZnkodmFsdWUpO1xyXG4gICAgcmV0dXJuIChjaGVja1R5cGUgPyBgdHlwZW9mICR7bGVmdH09PT0gdHlwZW9mICR7cmlnaHR9JiZgIDogJycpICsgbGVmdCArIG9wICsgcmlnaHQ7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGNvbXBpbGVMb2dpY2FsT3AoZXhwcmVzc2lvbnMsIG9wKSB7XHJcbiAgICByZXR1cm4gZXhwcmVzc2lvbnMubWFwKGNvbXBpbGUpLmpvaW4ob3ApO1xyXG59XHJcblxyXG5mdW5jdGlvbiBjb21waWxlSW5PcChwcm9wZXJ0eSwgdmFsdWVzKSB7XHJcbiAgICBpZiAocHJvcGVydHkgPT09ICckdHlwZScpIHZhbHVlcyA9IHZhbHVlcy5tYXAoKHZhbHVlKSA9PiB7XHJcbiAgICAgICAgcmV0dXJuIHR5cGVzLmluZGV4T2YodmFsdWUpO1xyXG4gICAgfSk7XHJcbiAgICBjb25zdCBsZWZ0ID0gSlNPTi5zdHJpbmdpZnkodmFsdWVzLnNvcnQoY29tcGFyZSkpO1xyXG4gICAgY29uc3QgcmlnaHQgPSBjb21waWxlUHJvcGVydHlSZWZlcmVuY2UocHJvcGVydHkpO1xyXG5cclxuICAgIGlmICh2YWx1ZXMubGVuZ3RoIDw9IDIwMCkgcmV0dXJuIGAke2xlZnR9LmluZGV4T2YoJHtyaWdodH0pICE9PSAtMWA7XHJcblxyXG4gICAgcmV0dXJuIGBmdW5jdGlvbih2LCBhLCBpLCBqKSB7XHJcbiAgICAgICAgd2hpbGUgKGkgPD0gaikgeyB2YXIgbSA9IChpICsgaikgPj4gMTtcclxuICAgICAgICAgICAgaWYgKGFbbV0gPT09IHYpIHJldHVybiB0cnVlOyBpZiAoYVttXSA+IHYpIGogPSBtIC0gMTsgZWxzZSBpID0gbSArIDE7XHJcbiAgICAgICAgfVxyXG4gICAgcmV0dXJuIGZhbHNlOyB9KCR7cmlnaHR9LCAke2xlZnR9LDAsJHt2YWx1ZXMubGVuZ3RoIC0gMX0pYDtcclxufVxyXG5cclxuZnVuY3Rpb24gY29tcGlsZUhhc09wKHByb3BlcnR5KSB7XHJcbiAgICByZXR1cm4gcHJvcGVydHkgPT09ICckaWQnID8gJ1wiaWRcIiBpbiBmJyA6IGAke0pTT04uc3RyaW5naWZ5KHByb3BlcnR5KX0gaW4gcGA7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGNvbXBpbGVOZWdhdGlvbihleHByZXNzaW9uKSB7XHJcbiAgICByZXR1cm4gYCEoJHtleHByZXNzaW9ufSlgO1xyXG59XHJcblxyXG4vLyBDb21wYXJpc29uIGZ1bmN0aW9uIHRvIHNvcnQgbnVtYmVycyBhbmQgc3RyaW5nc1xyXG5mdW5jdGlvbiBjb21wYXJlKGEsIGIpIHtcclxuICAgIHJldHVybiBhIDwgYiA/IC0xIDogYSA+IGIgPyAxIDogMDtcclxufVxyXG5cclxuLyoqXHJcbiAqIEdldCBmZWF0dXJlIG9iamVjdCBmcm9tIGEgZ2VvbWV0cnkgZm9yIGZpbHRlciBmdW5jdGlvbnMuXHJcbiAqIEBwYXJhbSAge0dlb21ldHJ5fSBnZW9tZXRyeSBnZW9tZXRyeVxyXG4gKiBAcmV0dXJuIHtPYmplY3R9ICAgICAgICAgIGZlYXR1cmUgZm9yIGZpbHRlciBmdW5jdGlvbnNcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBnZXRGaWx0ZXJGZWF0dXJlKGdlb21ldHJ5KSB7XHJcbiAgICBjb25zdCBqc29uID0gZ2VvbWV0cnkuX3RvSlNPTigpLFxyXG4gICAgICAgIGcgPSBqc29uWydmZWF0dXJlJ107XHJcbiAgICBnWyd0eXBlJ10gPSB0eXBlcy5pbmRleE9mKGdbJ2dlb21ldHJ5J11bJ3R5cGUnXSk7XHJcbiAgICBnWydzdWJUeXBlJ10gPSBqc29uWydzdWJUeXBlJ107XHJcbiAgICByZXR1cm4gZztcclxufVxyXG5cclxuLyoqXHJcbiAqIENvbXBpbGUgbGF5ZXIncyBzdHlsZSwgc3R5bGVzIHRvIHN5bWJvbGl6ZSBsYXllcidzIGdlb21ldHJpZXMsIGUuZy48YnI+XHJcbiAqIDxwcmU+XHJcbiAqIFtcclxuICogICB7XHJcbiAqICAgICAnZmlsdGVyJyA6IFsnPT0nLCAnZm9vJywgJ3ZhbCddLFxyXG4gKiAgICAgJ3N5bWJvbCcgOiB7J21hcmtlckZpbGUnOidmb28ucG5nJ31cclxuICogICB9XHJcbiAqIF1cclxuICogPC9wcmU+XHJcbiAqIEBwYXJhbSAge09iamVjdHxPYmplY3RbXX0gc3R5bGVzIC0gc3R5bGUgdG8gY29tcGlsZVxyXG4gKiBAcmV0dXJuIHtPYmplY3RbXX0gICAgICAgY29tcGlsZWQgc3R5bGVzXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gY29tcGlsZVN0eWxlKHN0eWxlcykge1xyXG4gICAgaWYgKCFBcnJheS5pc0FycmF5KHN0eWxlcykpIHtcclxuICAgICAgICByZXR1cm4gY29tcGlsZVN0eWxlKFtzdHlsZXNdKTtcclxuICAgIH1cclxuICAgIGNvbnN0IGNvbXBpbGVkID0gW107XHJcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHN0eWxlcy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgIGxldCBmaWx0ZXI7XHJcbiAgICAgICAgaWYgKHN0eWxlc1tpXVsnZmlsdGVyJ10gPT09IHRydWUpIHtcclxuICAgICAgICAgICAgZmlsdGVyID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gdHJ1ZTsgfTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBmaWx0ZXIgPSBjcmVhdGVGaWx0ZXIoc3R5bGVzW2ldWydmaWx0ZXInXSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGNvbXBpbGVkLnB1c2goZXh0ZW5kKHt9LCBzdHlsZXNbaV0sIHtcclxuICAgICAgICAgICAgZmlsdGVyIDogZmlsdGVyXHJcbiAgICAgICAgfSkpO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIGNvbXBpbGVkO1xyXG59XHJcblxyXG5mdW5jdGlvbiBleHRlbmQoZGVzdCkgeyAvLyAoT2JqZWN0WywgT2JqZWN0LCAuLi5dKSAtPlxyXG4gICAgZm9yIChsZXQgaSA9IDE7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICBjb25zdCBzcmMgPSBhcmd1bWVudHNbaV07XHJcbiAgICAgICAgZm9yIChjb25zdCBrIGluIHNyYykge1xyXG4gICAgICAgICAgICBkZXN0W2tdID0gc3JjW2tdO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIHJldHVybiBkZXN0O1xyXG59XHJcbiIsIi8qKlxyXG4gKiBXaGV0aGVyIHRoZSBvYmplY3QgaXMgbnVsbCBvciB1bmRlZmluZWQuXHJcbiAqIEBwYXJhbSAge09iamVjdH0gIG9iaiAtIG9iamVjdFxyXG4gKiBAcmV0dXJuIHtCb29sZWFufVxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGlzTmlsKG9iaikge1xyXG4gICAgcmV0dXJuIG9iaiA9PSBudWxsO1xyXG59XHJcblxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGRlZmluZWQob2JqKSB7XHJcbiAgICByZXR1cm4gIWlzTmlsKG9iaik7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBpc0VtcHR5T2JqZWN0KGUpIHtcclxuICAgIGxldCB0O1xyXG4gICAgZm9yICh0IGluIGUpXHJcbiAgICAgICAgcmV0dXJuICExO1xyXG4gICAgcmV0dXJuICEwO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gaW50ZXJzZWN0QXJyYXkoYSwgYikge1xyXG4gICAgY29uc3QgYlNldCA9IG5ldyBTZXQoYik7XHJcbiAgICByZXR1cm4gQXJyYXkuZnJvbShuZXcgU2V0KGEuZmlsdGVyKHYgPT4gYlNldC5oYXModikpKSk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBkZWNvbXBvc2UobWF0LCB0cmFuc2xhdGlvbiwgcXVhdGVybmlvbiwgc2NhbGUpIHtcclxuICAgIGxldCBzeCA9IGxlbmd0aChtYXQuc2xpY2UoMCwgMykpO1xyXG4gICAgY29uc3Qgc3kgPSBsZW5ndGgobWF0LnNsaWNlKDQsIDcpKTtcclxuICAgIGNvbnN0IHN6ID0gbGVuZ3RoKG1hdC5zbGljZSg4LCAxMSkpO1xyXG5cclxuICAgIC8vIGlmIGRlbWF0cm1pbmUgaXMgbmVnYXRpdmUsIHdlIG5lZWQgdG8gaW52ZXJ0IG9uZSBzY2FsZVxyXG4gICAgY29uc3QgZGV0ID0gZGV0ZXJtaW5hdGUobWF0KTtcclxuICAgIGlmIChkZXQgPCAwKSB7XHJcbiAgICAgICAgc3ggPSAtc3g7XHJcbiAgICB9XHJcblxyXG4gICAgdHJhbnNsYXRpb25bMF0gPSBtYXRbMTJdO1xyXG4gICAgdHJhbnNsYXRpb25bMV0gPSBtYXRbMTNdO1xyXG4gICAgdHJhbnNsYXRpb25bMl0gPSBtYXRbMTRdO1xyXG5cclxuICAgIC8vIHNjYWxlIHRoZSByb3RhdGlvbiBwYXJ0XHJcbiAgICBjb25zdCBtYXRyaXggPSBjb3B5KG1hdCk7XHJcblxyXG4gICAgY29uc3QgaW52U1ggPSAxIC8gc3g7XHJcbiAgICBjb25zdCBpbnZTWSA9IDEgLyBzeTtcclxuICAgIGNvbnN0IGludlNaID0gMSAvIHN6O1xyXG5cclxuICAgIG1hdHJpeFswXSAqPSBpbnZTWDtcclxuICAgIG1hdHJpeFsxXSAqPSBpbnZTWDtcclxuICAgIG1hdHJpeFsyXSAqPSBpbnZTWDtcclxuXHJcbiAgICBtYXRyaXhbNF0gKj0gaW52U1k7XHJcbiAgICBtYXRyaXhbNV0gKj0gaW52U1k7XHJcbiAgICBtYXRyaXhbNl0gKj0gaW52U1k7XHJcblxyXG4gICAgbWF0cml4WzhdICo9IGludlNaO1xyXG4gICAgbWF0cml4WzldICo9IGludlNaO1xyXG4gICAgbWF0cml4WzEwXSAqPSBpbnZTWjtcclxuXHJcbiAgICBxdWF0RnJvbVJvdGF0aW9uTWF0cml4KG1hdHJpeCwgcXVhdGVybmlvbik7XHJcblxyXG4gICAgc2NhbGVbMF0gPSBzeDtcclxuICAgIHNjYWxlWzFdID0gc3k7XHJcbiAgICBzY2FsZVsyXSA9IHN6O1xyXG59XHJcblxyXG5mdW5jdGlvbiBsZW5ndGgodikge1xyXG4gICAgcmV0dXJuIE1hdGguc3FydCh2WzBdICogdlswXSArIHZbMV0gKiB2WzFdICsgdlsyXSAqIHZbMl0pO1xyXG59XHJcblxyXG5mdW5jdGlvbiBxdWF0RnJvbVJvdGF0aW9uTWF0cml4KG0sIGRzdCkge1xyXG4gICAgLy8gaHR0cDovL3d3dy5ldWNsaWRlYW5zcGFjZS5jb20vbWF0aHMvZ2VvbWV0cnkvcm90YXRpb25zL2NvbnZlcnNpb25zL21hdHJpeFRvUXVhdGVybmlvbi9pbmRleC5odG1cclxuXHJcbiAgICAvLyBhc3N1bWVzIHRoZSB1cHBlciAzeDMgb2YgbSBpcyBhIHB1cmUgcm90YXRpb24gbWF0cml4IChpLmUsIHVuc2NhbGVkKVxyXG4gICAgY29uc3QgbTExID0gbVswXTtcclxuICAgIGNvbnN0IG0xMiA9IG1bNF07XHJcbiAgICBjb25zdCBtMTMgPSBtWzhdO1xyXG4gICAgY29uc3QgbTIxID0gbVsxXTtcclxuICAgIGNvbnN0IG0yMiA9IG1bNV07XHJcbiAgICBjb25zdCBtMjMgPSBtWzldO1xyXG4gICAgY29uc3QgbTMxID0gbVsyXTtcclxuICAgIGNvbnN0IG0zMiA9IG1bNl07XHJcbiAgICBjb25zdCBtMzMgPSBtWzEwXTtcclxuXHJcbiAgICBjb25zdCB0cmFjZSA9IG0xMSArIG0yMiArIG0zMztcclxuXHJcbiAgICBpZiAodHJhY2UgPiAwKSB7XHJcbiAgICAgICAgY29uc3QgcyA9IDAuNSAvIE1hdGguc3FydCh0cmFjZSArIDEpO1xyXG4gICAgICAgIGRzdFszXSA9IDAuMjUgLyBzO1xyXG4gICAgICAgIGRzdFswXSA9IChtMzIgLSBtMjMpICogcztcclxuICAgICAgICBkc3RbMV0gPSAobTEzIC0gbTMxKSAqIHM7XHJcbiAgICAgICAgZHN0WzJdID0gKG0yMSAtIG0xMikgKiBzO1xyXG4gICAgfSBlbHNlIGlmIChtMTEgPiBtMjIgJiYgbTExID4gbTMzKSB7XHJcbiAgICAgICAgY29uc3QgcyA9IDIgKiBNYXRoLnNxcnQoMSArIG0xMSAtIG0yMiAtIG0zMyk7XHJcbiAgICAgICAgZHN0WzNdID0gKG0zMiAtIG0yMykgLyBzO1xyXG4gICAgICAgIGRzdFswXSA9IDAuMjUgKiBzO1xyXG4gICAgICAgIGRzdFsxXSA9IChtMTIgKyBtMjEpIC8gcztcclxuICAgICAgICBkc3RbMl0gPSAobTEzICsgbTMxKSAvIHM7XHJcbiAgICB9IGVsc2UgaWYgKG0yMiA+IG0zMykge1xyXG4gICAgICAgIGNvbnN0IHMgPSAyICogTWF0aC5zcXJ0KDEgKyBtMjIgLSBtMTEgLSBtMzMpO1xyXG4gICAgICAgIGRzdFszXSA9IChtMTMgLSBtMzEpIC8gcztcclxuICAgICAgICBkc3RbMF0gPSAobTEyICsgbTIxKSAvIHM7XHJcbiAgICAgICAgZHN0WzFdID0gMC4yNSAqIHM7XHJcbiAgICAgICAgZHN0WzJdID0gKG0yMyArIG0zMikgLyBzO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICBjb25zdCBzID0gMiAqIE1hdGguc3FydCgxICsgbTMzIC0gbTExIC0gbTIyKTtcclxuICAgICAgICBkc3RbM10gPSAobTIxIC0gbTEyKSAvIHM7XHJcbiAgICAgICAgZHN0WzBdID0gKG0xMyArIG0zMSkgLyBzO1xyXG4gICAgICAgIGRzdFsxXSA9IChtMjMgKyBtMzIpIC8gcztcclxuICAgICAgICBkc3RbMl0gPSAwLjI1ICogcztcclxuICAgIH1cclxufVxyXG5cclxuZnVuY3Rpb24gY29weShzcmMsIGRzdCkge1xyXG4gICAgZHN0ID0gZHN0IHx8IG5ldyBGbG9hdDMyQXJyYXkoMTYpO1xyXG5cclxuICAgIGRzdFsgMF0gPSBzcmNbIDBdO1xyXG4gICAgZHN0WyAxXSA9IHNyY1sgMV07XHJcbiAgICBkc3RbIDJdID0gc3JjWyAyXTtcclxuICAgIGRzdFsgM10gPSBzcmNbIDNdO1xyXG4gICAgZHN0WyA0XSA9IHNyY1sgNF07XHJcbiAgICBkc3RbIDVdID0gc3JjWyA1XTtcclxuICAgIGRzdFsgNl0gPSBzcmNbIDZdO1xyXG4gICAgZHN0WyA3XSA9IHNyY1sgN107XHJcbiAgICBkc3RbIDhdID0gc3JjWyA4XTtcclxuICAgIGRzdFsgOV0gPSBzcmNbIDldO1xyXG4gICAgZHN0WzEwXSA9IHNyY1sxMF07XHJcbiAgICBkc3RbMTFdID0gc3JjWzExXTtcclxuICAgIGRzdFsxMl0gPSBzcmNbMTJdO1xyXG4gICAgZHN0WzEzXSA9IHNyY1sxM107XHJcbiAgICBkc3RbMTRdID0gc3JjWzE0XTtcclxuICAgIGRzdFsxNV0gPSBzcmNbMTVdO1xyXG5cclxuICAgIHJldHVybiBkc3Q7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGRldGVybWluYXRlKG0pIHtcclxuICAgIGNvbnN0IG0wMCA9IG1bMCAqIDQgKyAwXTtcclxuICAgIGNvbnN0IG0wMSA9IG1bMCAqIDQgKyAxXTtcclxuICAgIGNvbnN0IG0wMiA9IG1bMCAqIDQgKyAyXTtcclxuICAgIGNvbnN0IG0wMyA9IG1bMCAqIDQgKyAzXTtcclxuICAgIGNvbnN0IG0xMCA9IG1bMSAqIDQgKyAwXTtcclxuICAgIGNvbnN0IG0xMSA9IG1bMSAqIDQgKyAxXTtcclxuICAgIGNvbnN0IG0xMiA9IG1bMSAqIDQgKyAyXTtcclxuICAgIGNvbnN0IG0xMyA9IG1bMSAqIDQgKyAzXTtcclxuICAgIGNvbnN0IG0yMCA9IG1bMiAqIDQgKyAwXTtcclxuICAgIGNvbnN0IG0yMSA9IG1bMiAqIDQgKyAxXTtcclxuICAgIGNvbnN0IG0yMiA9IG1bMiAqIDQgKyAyXTtcclxuICAgIGNvbnN0IG0yMyA9IG1bMiAqIDQgKyAzXTtcclxuICAgIGNvbnN0IG0zMCA9IG1bMyAqIDQgKyAwXTtcclxuICAgIGNvbnN0IG0zMSA9IG1bMyAqIDQgKyAxXTtcclxuICAgIGNvbnN0IG0zMiA9IG1bMyAqIDQgKyAyXTtcclxuICAgIGNvbnN0IG0zMyA9IG1bMyAqIDQgKyAzXTtcclxuICAgIGNvbnN0IHRtcDAgID0gbTIyICogbTMzO1xyXG4gICAgY29uc3QgdG1wMSAgPSBtMzIgKiBtMjM7XHJcbiAgICBjb25zdCB0bXAyICA9IG0xMiAqIG0zMztcclxuICAgIGNvbnN0IHRtcDMgID0gbTMyICogbTEzO1xyXG4gICAgY29uc3QgdG1wNCAgPSBtMTIgKiBtMjM7XHJcbiAgICBjb25zdCB0bXA1ICA9IG0yMiAqIG0xMztcclxuICAgIGNvbnN0IHRtcDYgID0gbTAyICogbTMzO1xyXG4gICAgY29uc3QgdG1wNyAgPSBtMzIgKiBtMDM7XHJcbiAgICBjb25zdCB0bXA4ICA9IG0wMiAqIG0yMztcclxuICAgIGNvbnN0IHRtcDkgID0gbTIyICogbTAzO1xyXG4gICAgY29uc3QgdG1wMTAgPSBtMDIgKiBtMTM7XHJcbiAgICBjb25zdCB0bXAxMSA9IG0xMiAqIG0wMztcclxuXHJcbiAgICBjb25zdCB0MCA9ICh0bXAwICogbTExICsgdG1wMyAqIG0yMSArIHRtcDQgKiBtMzEpIC1cclxuICAgICAgICAodG1wMSAqIG0xMSArIHRtcDIgKiBtMjEgKyB0bXA1ICogbTMxKTtcclxuICAgIGNvbnN0IHQxID0gKHRtcDEgKiBtMDEgKyB0bXA2ICogbTIxICsgdG1wOSAqIG0zMSkgLVxyXG4gICAgICAgICh0bXAwICogbTAxICsgdG1wNyAqIG0yMSArIHRtcDggKiBtMzEpO1xyXG4gICAgY29uc3QgdDIgPSAodG1wMiAqIG0wMSArIHRtcDcgKiBtMTEgKyB0bXAxMCAqIG0zMSkgLVxyXG4gICAgICAgICh0bXAzICogbTAxICsgdG1wNiAqIG0xMSArIHRtcDExICogbTMxKTtcclxuICAgIGNvbnN0IHQzID0gKHRtcDUgKiBtMDEgKyB0bXA4ICogbTExICsgdG1wMTEgKiBtMjEpIC1cclxuICAgICAgICAodG1wNCAqIG0wMSArIHRtcDkgKiBtMTEgKyB0bXAxMCAqIG0yMSk7XHJcblxyXG4gICAgcmV0dXJuIDEuMCAvIChtMDAgKiB0MCArIG0xMCAqIHQxICsgbTIwICogdDIgKyBtMzAgKiB0Myk7XHJcbn1cclxuIiwiIWZ1bmN0aW9uKGkpe1widXNlIHN0cmljdFwiO3ZhciBjLHMsdT1cImZ1bGZpbGxlZFwiLGY9XCJ1bmRlZmluZWRcIixhPWZ1bmN0aW9uKCl7dmFyIGU9W10sbj0wO2Z1bmN0aW9uIG8oKXtmb3IoO2UubGVuZ3RoLW47KXt0cnl7ZVtuXSgpfWNhdGNoKHQpe2kuY29uc29sZSYmaS5jb25zb2xlLmVycm9yKHQpfWVbbisrXT1zLDEwMjQ9PW4mJihlLnNwbGljZSgwLDEwMjQpLG49MCl9fXZhciByPWZ1bmN0aW9uKCl7aWYodHlwZW9mIE11dGF0aW9uT2JzZXJ2ZXI9PT1mKXJldHVybiB0eXBlb2YgcHJvY2VzcyE9PWYmJlwiZnVuY3Rpb25cIj09dHlwZW9mIHByb2Nlc3MubmV4dFRpY2s/ZnVuY3Rpb24oKXtwcm9jZXNzLm5leHRUaWNrKG8pfTp0eXBlb2Ygc2V0SW1tZWRpYXRlIT09Zj9mdW5jdGlvbigpe3NldEltbWVkaWF0ZShvKX06ZnVuY3Rpb24oKXtzZXRUaW1lb3V0KG8sMCl9O3ZhciB0PWRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7cmV0dXJuIG5ldyBNdXRhdGlvbk9ic2VydmVyKG8pLm9ic2VydmUodCx7YXR0cmlidXRlczohMH0pLGZ1bmN0aW9uKCl7dC5zZXRBdHRyaWJ1dGUoXCJhXCIsMCl9fSgpO3JldHVybiBmdW5jdGlvbih0KXtlLnB1c2godCksZS5sZW5ndGgtbj09MSYmcigpfX0oKTtmdW5jdGlvbiBsKHQpe2lmKCEodGhpcyBpbnN0YW5jZW9mIGwpKXRocm93IG5ldyBUeXBlRXJyb3IoXCJab3VzYW4gbXVzdCBiZSBjcmVhdGVkIHdpdGggdGhlIG5ldyBrZXl3b3JkXCIpO2lmKFwiZnVuY3Rpb25cIj09dHlwZW9mIHQpe3ZhciBlPXRoaXM7dHJ5e3QoZnVuY3Rpb24odCl7ZS5yZXNvbHZlKHQpfSxmdW5jdGlvbih0KXtlLnJlamVjdCh0KX0pfWNhdGNoKHQpe2UucmVqZWN0KHQpfX1lbHNlIGlmKDA8YXJndW1lbnRzLmxlbmd0aCl0aHJvdyBuZXcgVHlwZUVycm9yKFwiWm91c2FuIHJlc29sdmVyIFwiK3QrXCIgaXMgbm90IGEgZnVuY3Rpb25cIil9ZnVuY3Rpb24gaChlLHQpe2lmKFwiZnVuY3Rpb25cIj09dHlwZW9mIGUueSl0cnl7dmFyIG49ZS55LmNhbGwocyx0KTtlLnAucmVzb2x2ZShuKX1jYXRjaCh0KXtlLnAucmVqZWN0KHQpfWVsc2UgZS5wLnJlc29sdmUodCl9ZnVuY3Rpb24gdihlLHQpe2lmKFwiZnVuY3Rpb25cIj09dHlwZW9mIGUubil0cnl7dmFyIG49ZS5uLmNhbGwocyx0KTtlLnAucmVzb2x2ZShuKX1jYXRjaCh0KXtlLnAucmVqZWN0KHQpfWVsc2UgZS5wLnJlamVjdCh0KX1sLnByb3RvdHlwZT17cmVzb2x2ZTpmdW5jdGlvbihuKXtpZih0aGlzLnN0YXRlPT09Yyl7aWYobj09PXRoaXMpcmV0dXJuIHRoaXMucmVqZWN0KG5ldyBUeXBlRXJyb3IoXCJBdHRlbXB0IHRvIHJlc29sdmUgcHJvbWlzZSB3aXRoIHNlbGZcIikpO3ZhciBvPXRoaXM7aWYobiYmKFwiZnVuY3Rpb25cIj09dHlwZW9mIG58fFwib2JqZWN0XCI9PXR5cGVvZiBuKSl0cnl7dmFyIGU9ITAsdD1uLnRoZW47aWYoXCJmdW5jdGlvblwiPT10eXBlb2YgdClyZXR1cm4gdm9pZCB0LmNhbGwobixmdW5jdGlvbih0KXtlJiYoZT0hMSxvLnJlc29sdmUodCkpfSxmdW5jdGlvbih0KXtlJiYoZT0hMSxvLnJlamVjdCh0KSl9KX1jYXRjaCh0KXtyZXR1cm4gdm9pZChlJiZ0aGlzLnJlamVjdCh0KSl9dGhpcy5zdGF0ZT11LHRoaXMudj1uLG8uYyYmYShmdW5jdGlvbigpe2Zvcih2YXIgdD0wLGU9by5jLmxlbmd0aDt0PGU7dCsrKWgoby5jW3RdLG4pfSl9fSxyZWplY3Q6ZnVuY3Rpb24obil7aWYodGhpcy5zdGF0ZT09PWMpe3ZhciB0PXRoaXM7dGhpcy5zdGF0ZT1cInJlamVjdGVkXCIsdGhpcy52PW47dmFyIG89dGhpcy5jO2Eobz9mdW5jdGlvbigpe2Zvcih2YXIgdD0wLGU9by5sZW5ndGg7dDxlO3QrKyl2KG9bdF0sbil9OmZ1bmN0aW9uKCl7dC5oYW5kbGVkfHwhbC5zdXBwcmVzc1VuY2F1Z2h0UmVqZWN0aW9uRXJyb3ImJmkuY29uc29sZSYmbC53YXJuKFwiWW91IHVwc2V0IFpvdXNhbi4gUGxlYXNlIGNhdGNoIHJlamVjdGlvbnM6IFwiLG4sbj9uLnN0YWNrOm51bGwpfSl9fSx0aGVuOmZ1bmN0aW9uKHQsZSl7dmFyIG49bmV3IGwsbz17eTp0LG46ZSxwOm59O2lmKHRoaXMuc3RhdGU9PT1jKXRoaXMuYz90aGlzLmMucHVzaChvKTp0aGlzLmM9W29dO2Vsc2V7dmFyIHI9dGhpcy5zdGF0ZSxpPXRoaXMudjt0aGlzLmhhbmRsZWQ9ITAsYShmdW5jdGlvbigpe3I9PT11P2gobyxpKTp2KG8saSl9KX1yZXR1cm4gbn0sY2F0Y2g6ZnVuY3Rpb24odCl7cmV0dXJuIHRoaXMudGhlbihudWxsLHQpfSxmaW5hbGx5OmZ1bmN0aW9uKHQpe3JldHVybiB0aGlzLnRoZW4odCx0KX0sdGltZW91dDpmdW5jdGlvbih0LG8pe289b3x8XCJUaW1lb3V0XCI7dmFyIHI9dGhpcztyZXR1cm4gbmV3IGwoZnVuY3Rpb24oZSxuKXtzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7bihFcnJvcihvKSl9LHQpLHIudGhlbihmdW5jdGlvbih0KXtlKHQpfSxmdW5jdGlvbih0KXtuKHQpfSl9KX19LGwucmVzb2x2ZT1mdW5jdGlvbih0KXt2YXIgZT1uZXcgbDtyZXR1cm4gZS5yZXNvbHZlKHQpLGV9LGwucmVqZWN0PWZ1bmN0aW9uKHQpe3ZhciBlPW5ldyBsO3JldHVybiBlLmM9W10sZS5yZWplY3QodCksZX0sbC5hbGw9ZnVuY3Rpb24obil7dmFyIG89W10scj0wLGk9bmV3IGw7ZnVuY3Rpb24gdCh0LGUpe3QmJlwiZnVuY3Rpb25cIj09dHlwZW9mIHQudGhlbnx8KHQ9bC5yZXNvbHZlKHQpKSx0LnRoZW4oZnVuY3Rpb24odCl7b1tlXT10LCsrcj09bi5sZW5ndGgmJmkucmVzb2x2ZShvKX0sZnVuY3Rpb24odCl7aS5yZWplY3QodCl9KX1mb3IodmFyIGU9MDtlPG4ubGVuZ3RoO2UrKyl0KG5bZV0sZSk7cmV0dXJuIG4ubGVuZ3RofHxpLnJlc29sdmUobyksaX0sbC53YXJuPWNvbnNvbGUud2Fybix0eXBlb2YgbW9kdWxlIT1mJiZtb2R1bGUuZXhwb3J0cyYmKG1vZHVsZS5leHBvcnRzPWwpLGkuZGVmaW5lJiZpLmRlZmluZS5hbWQmJmkuZGVmaW5lKFtdLGZ1bmN0aW9uKCl7cmV0dXJuIGx9KSwoaS5ab3VzYW49bCkuc29vbj1hfShcInVuZGVmaW5lZFwiIT10eXBlb2YgZ2xvYmFsP2dsb2JhbDp0aGlzKTsiLCIvKipcclxuICogQ29tbW9uIHV0aWxpdGllc1xyXG4gKiBAbW9kdWxlIGdsTWF0cml4XHJcbiAqL1xyXG5cclxuLy8gQ29uZmlndXJhdGlvbiBDb25zdGFudHNcclxuZXhwb3J0IHZhciBFUFNJTE9OID0gMC4wMDAwMDE7XHJcbmV4cG9ydCB2YXIgQVJSQVlfVFlQRSA9IHR5cGVvZiBGbG9hdDMyQXJyYXkgIT09ICd1bmRlZmluZWQnID8gRmxvYXQzMkFycmF5IDogQXJyYXk7XHJcbmV4cG9ydCB2YXIgUkFORE9NID0gTWF0aC5yYW5kb207XHJcblxyXG4vKipcclxuICogU2V0cyB0aGUgdHlwZSBvZiBhcnJheSB1c2VkIHdoZW4gY3JlYXRpbmcgbmV3IHZlY3RvcnMgYW5kIG1hdHJpY2VzXHJcbiAqXHJcbiAqIEBwYXJhbSB7VHlwZX0gdHlwZSBBcnJheSB0eXBlLCBzdWNoIGFzIEZsb2F0MzJBcnJheSBvciBBcnJheVxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIHNldE1hdHJpeEFycmF5VHlwZSh0eXBlKSB7XHJcbiAgQVJSQVlfVFlQRSA9IHR5cGU7XHJcbn1cclxuXHJcbnZhciBkZWdyZWUgPSBNYXRoLlBJIC8gMTgwO1xyXG5cclxuLyoqXHJcbiAqIENvbnZlcnQgRGVncmVlIFRvIFJhZGlhblxyXG4gKlxyXG4gKiBAcGFyYW0ge051bWJlcn0gYSBBbmdsZSBpbiBEZWdyZWVzXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gdG9SYWRpYW4oYSkge1xyXG4gIHJldHVybiBhICogZGVncmVlO1xyXG59XHJcblxyXG4vKipcclxuICogVGVzdHMgd2hldGhlciBvciBub3QgdGhlIGFyZ3VtZW50cyBoYXZlIGFwcHJveGltYXRlbHkgdGhlIHNhbWUgdmFsdWUsIHdpdGhpbiBhbiBhYnNvbHV0ZVxyXG4gKiBvciByZWxhdGl2ZSB0b2xlcmFuY2Ugb2YgZ2xNYXRyaXguRVBTSUxPTiAoYW4gYWJzb2x1dGUgdG9sZXJhbmNlIGlzIHVzZWQgZm9yIHZhbHVlcyBsZXNzXHJcbiAqIHRoYW4gb3IgZXF1YWwgdG8gMS4wLCBhbmQgYSByZWxhdGl2ZSB0b2xlcmFuY2UgaXMgdXNlZCBmb3IgbGFyZ2VyIHZhbHVlcylcclxuICpcclxuICogQHBhcmFtIHtOdW1iZXJ9IGEgVGhlIGZpcnN0IG51bWJlciB0byB0ZXN0LlxyXG4gKiBAcGFyYW0ge051bWJlcn0gYiBUaGUgc2Vjb25kIG51bWJlciB0byB0ZXN0LlxyXG4gKiBAcmV0dXJucyB7Qm9vbGVhbn0gVHJ1ZSBpZiB0aGUgbnVtYmVycyBhcmUgYXBwcm94aW1hdGVseSBlcXVhbCwgZmFsc2Ugb3RoZXJ3aXNlLlxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGVxdWFscyhhLCBiKSB7XHJcbiAgcmV0dXJuIE1hdGguYWJzKGEgLSBiKSA8PSBFUFNJTE9OICogTWF0aC5tYXgoMS4wLCBNYXRoLmFicyhhKSwgTWF0aC5hYnMoYikpO1xyXG59IiwiaW1wb3J0ICogYXMgZ2xNYXRyaXggZnJvbSBcIi4vY29tbW9uLmpzXCI7XHJcblxyXG4vKipcclxuICogM3gzIE1hdHJpeFxyXG4gKiBAbW9kdWxlIG1hdDNcclxuICovXHJcblxyXG4vKipcclxuICogQ3JlYXRlcyBhIG5ldyBpZGVudGl0eSBtYXQzXHJcbiAqXHJcbiAqIEByZXR1cm5zIHttYXQzfSBhIG5ldyAzeDMgbWF0cml4XHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlKCkge1xyXG4gIHZhciBvdXQgPSBuZXcgZ2xNYXRyaXguQVJSQVlfVFlQRSg5KTtcclxuICBpZiAoZ2xNYXRyaXguQVJSQVlfVFlQRSAhPSBGbG9hdDMyQXJyYXkpIHtcclxuICAgIG91dFsxXSA9IDA7XHJcbiAgICBvdXRbMl0gPSAwO1xyXG4gICAgb3V0WzNdID0gMDtcclxuICAgIG91dFs1XSA9IDA7XHJcbiAgICBvdXRbNl0gPSAwO1xyXG4gICAgb3V0WzddID0gMDtcclxuICB9XHJcbiAgb3V0WzBdID0gMTtcclxuICBvdXRbNF0gPSAxO1xyXG4gIG91dFs4XSA9IDE7XHJcbiAgcmV0dXJuIG91dDtcclxufVxyXG5cclxuLyoqXHJcbiAqIENvcGllcyB0aGUgdXBwZXItbGVmdCAzeDMgdmFsdWVzIGludG8gdGhlIGdpdmVuIG1hdDMuXHJcbiAqXHJcbiAqIEBwYXJhbSB7bWF0M30gb3V0IHRoZSByZWNlaXZpbmcgM3gzIG1hdHJpeFxyXG4gKiBAcGFyYW0ge21hdDR9IGEgICB0aGUgc291cmNlIDR4NCBtYXRyaXhcclxuICogQHJldHVybnMge21hdDN9IG91dFxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGZyb21NYXQ0KG91dCwgYSkge1xyXG4gIG91dFswXSA9IGFbMF07XHJcbiAgb3V0WzFdID0gYVsxXTtcclxuICBvdXRbMl0gPSBhWzJdO1xyXG4gIG91dFszXSA9IGFbNF07XHJcbiAgb3V0WzRdID0gYVs1XTtcclxuICBvdXRbNV0gPSBhWzZdO1xyXG4gIG91dFs2XSA9IGFbOF07XHJcbiAgb3V0WzddID0gYVs5XTtcclxuICBvdXRbOF0gPSBhWzEwXTtcclxuICByZXR1cm4gb3V0O1xyXG59XHJcblxyXG4vKipcclxuICogQ3JlYXRlcyBhIG5ldyBtYXQzIGluaXRpYWxpemVkIHdpdGggdmFsdWVzIGZyb20gYW4gZXhpc3RpbmcgbWF0cml4XHJcbiAqXHJcbiAqIEBwYXJhbSB7bWF0M30gYSBtYXRyaXggdG8gY2xvbmVcclxuICogQHJldHVybnMge21hdDN9IGEgbmV3IDN4MyBtYXRyaXhcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBjbG9uZShhKSB7XHJcbiAgdmFyIG91dCA9IG5ldyBnbE1hdHJpeC5BUlJBWV9UWVBFKDkpO1xyXG4gIG91dFswXSA9IGFbMF07XHJcbiAgb3V0WzFdID0gYVsxXTtcclxuICBvdXRbMl0gPSBhWzJdO1xyXG4gIG91dFszXSA9IGFbM107XHJcbiAgb3V0WzRdID0gYVs0XTtcclxuICBvdXRbNV0gPSBhWzVdO1xyXG4gIG91dFs2XSA9IGFbNl07XHJcbiAgb3V0WzddID0gYVs3XTtcclxuICBvdXRbOF0gPSBhWzhdO1xyXG4gIHJldHVybiBvdXQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDb3B5IHRoZSB2YWx1ZXMgZnJvbSBvbmUgbWF0MyB0byBhbm90aGVyXHJcbiAqXHJcbiAqIEBwYXJhbSB7bWF0M30gb3V0IHRoZSByZWNlaXZpbmcgbWF0cml4XHJcbiAqIEBwYXJhbSB7bWF0M30gYSB0aGUgc291cmNlIG1hdHJpeFxyXG4gKiBAcmV0dXJucyB7bWF0M30gb3V0XHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gY29weShvdXQsIGEpIHtcclxuICBvdXRbMF0gPSBhWzBdO1xyXG4gIG91dFsxXSA9IGFbMV07XHJcbiAgb3V0WzJdID0gYVsyXTtcclxuICBvdXRbM10gPSBhWzNdO1xyXG4gIG91dFs0XSA9IGFbNF07XHJcbiAgb3V0WzVdID0gYVs1XTtcclxuICBvdXRbNl0gPSBhWzZdO1xyXG4gIG91dFs3XSA9IGFbN107XHJcbiAgb3V0WzhdID0gYVs4XTtcclxuICByZXR1cm4gb3V0O1xyXG59XHJcblxyXG4vKipcclxuICogQ3JlYXRlIGEgbmV3IG1hdDMgd2l0aCB0aGUgZ2l2ZW4gdmFsdWVzXHJcbiAqXHJcbiAqIEBwYXJhbSB7TnVtYmVyfSBtMDAgQ29tcG9uZW50IGluIGNvbHVtbiAwLCByb3cgMCBwb3NpdGlvbiAoaW5kZXggMClcclxuICogQHBhcmFtIHtOdW1iZXJ9IG0wMSBDb21wb25lbnQgaW4gY29sdW1uIDAsIHJvdyAxIHBvc2l0aW9uIChpbmRleCAxKVxyXG4gKiBAcGFyYW0ge051bWJlcn0gbTAyIENvbXBvbmVudCBpbiBjb2x1bW4gMCwgcm93IDIgcG9zaXRpb24gKGluZGV4IDIpXHJcbiAqIEBwYXJhbSB7TnVtYmVyfSBtMTAgQ29tcG9uZW50IGluIGNvbHVtbiAxLCByb3cgMCBwb3NpdGlvbiAoaW5kZXggMylcclxuICogQHBhcmFtIHtOdW1iZXJ9IG0xMSBDb21wb25lbnQgaW4gY29sdW1uIDEsIHJvdyAxIHBvc2l0aW9uIChpbmRleCA0KVxyXG4gKiBAcGFyYW0ge051bWJlcn0gbTEyIENvbXBvbmVudCBpbiBjb2x1bW4gMSwgcm93IDIgcG9zaXRpb24gKGluZGV4IDUpXHJcbiAqIEBwYXJhbSB7TnVtYmVyfSBtMjAgQ29tcG9uZW50IGluIGNvbHVtbiAyLCByb3cgMCBwb3NpdGlvbiAoaW5kZXggNilcclxuICogQHBhcmFtIHtOdW1iZXJ9IG0yMSBDb21wb25lbnQgaW4gY29sdW1uIDIsIHJvdyAxIHBvc2l0aW9uIChpbmRleCA3KVxyXG4gKiBAcGFyYW0ge051bWJlcn0gbTIyIENvbXBvbmVudCBpbiBjb2x1bW4gMiwgcm93IDIgcG9zaXRpb24gKGluZGV4IDgpXHJcbiAqIEByZXR1cm5zIHttYXQzfSBBIG5ldyBtYXQzXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gZnJvbVZhbHVlcyhtMDAsIG0wMSwgbTAyLCBtMTAsIG0xMSwgbTEyLCBtMjAsIG0yMSwgbTIyKSB7XHJcbiAgdmFyIG91dCA9IG5ldyBnbE1hdHJpeC5BUlJBWV9UWVBFKDkpO1xyXG4gIG91dFswXSA9IG0wMDtcclxuICBvdXRbMV0gPSBtMDE7XHJcbiAgb3V0WzJdID0gbTAyO1xyXG4gIG91dFszXSA9IG0xMDtcclxuICBvdXRbNF0gPSBtMTE7XHJcbiAgb3V0WzVdID0gbTEyO1xyXG4gIG91dFs2XSA9IG0yMDtcclxuICBvdXRbN10gPSBtMjE7XHJcbiAgb3V0WzhdID0gbTIyO1xyXG4gIHJldHVybiBvdXQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBTZXQgdGhlIGNvbXBvbmVudHMgb2YgYSBtYXQzIHRvIHRoZSBnaXZlbiB2YWx1ZXNcclxuICpcclxuICogQHBhcmFtIHttYXQzfSBvdXQgdGhlIHJlY2VpdmluZyBtYXRyaXhcclxuICogQHBhcmFtIHtOdW1iZXJ9IG0wMCBDb21wb25lbnQgaW4gY29sdW1uIDAsIHJvdyAwIHBvc2l0aW9uIChpbmRleCAwKVxyXG4gKiBAcGFyYW0ge051bWJlcn0gbTAxIENvbXBvbmVudCBpbiBjb2x1bW4gMCwgcm93IDEgcG9zaXRpb24gKGluZGV4IDEpXHJcbiAqIEBwYXJhbSB7TnVtYmVyfSBtMDIgQ29tcG9uZW50IGluIGNvbHVtbiAwLCByb3cgMiBwb3NpdGlvbiAoaW5kZXggMilcclxuICogQHBhcmFtIHtOdW1iZXJ9IG0xMCBDb21wb25lbnQgaW4gY29sdW1uIDEsIHJvdyAwIHBvc2l0aW9uIChpbmRleCAzKVxyXG4gKiBAcGFyYW0ge051bWJlcn0gbTExIENvbXBvbmVudCBpbiBjb2x1bW4gMSwgcm93IDEgcG9zaXRpb24gKGluZGV4IDQpXHJcbiAqIEBwYXJhbSB7TnVtYmVyfSBtMTIgQ29tcG9uZW50IGluIGNvbHVtbiAxLCByb3cgMiBwb3NpdGlvbiAoaW5kZXggNSlcclxuICogQHBhcmFtIHtOdW1iZXJ9IG0yMCBDb21wb25lbnQgaW4gY29sdW1uIDIsIHJvdyAwIHBvc2l0aW9uIChpbmRleCA2KVxyXG4gKiBAcGFyYW0ge051bWJlcn0gbTIxIENvbXBvbmVudCBpbiBjb2x1bW4gMiwgcm93IDEgcG9zaXRpb24gKGluZGV4IDcpXHJcbiAqIEBwYXJhbSB7TnVtYmVyfSBtMjIgQ29tcG9uZW50IGluIGNvbHVtbiAyLCByb3cgMiBwb3NpdGlvbiAoaW5kZXggOClcclxuICogQHJldHVybnMge21hdDN9IG91dFxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIHNldChvdXQsIG0wMCwgbTAxLCBtMDIsIG0xMCwgbTExLCBtMTIsIG0yMCwgbTIxLCBtMjIpIHtcclxuICBvdXRbMF0gPSBtMDA7XHJcbiAgb3V0WzFdID0gbTAxO1xyXG4gIG91dFsyXSA9IG0wMjtcclxuICBvdXRbM10gPSBtMTA7XHJcbiAgb3V0WzRdID0gbTExO1xyXG4gIG91dFs1XSA9IG0xMjtcclxuICBvdXRbNl0gPSBtMjA7XHJcbiAgb3V0WzddID0gbTIxO1xyXG4gIG91dFs4XSA9IG0yMjtcclxuICByZXR1cm4gb3V0O1xyXG59XHJcblxyXG4vKipcclxuICogU2V0IGEgbWF0MyB0byB0aGUgaWRlbnRpdHkgbWF0cml4XHJcbiAqXHJcbiAqIEBwYXJhbSB7bWF0M30gb3V0IHRoZSByZWNlaXZpbmcgbWF0cml4XHJcbiAqIEByZXR1cm5zIHttYXQzfSBvdXRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBpZGVudGl0eShvdXQpIHtcclxuICBvdXRbMF0gPSAxO1xyXG4gIG91dFsxXSA9IDA7XHJcbiAgb3V0WzJdID0gMDtcclxuICBvdXRbM10gPSAwO1xyXG4gIG91dFs0XSA9IDE7XHJcbiAgb3V0WzVdID0gMDtcclxuICBvdXRbNl0gPSAwO1xyXG4gIG91dFs3XSA9IDA7XHJcbiAgb3V0WzhdID0gMTtcclxuICByZXR1cm4gb3V0O1xyXG59XHJcblxyXG4vKipcclxuICogVHJhbnNwb3NlIHRoZSB2YWx1ZXMgb2YgYSBtYXQzXHJcbiAqXHJcbiAqIEBwYXJhbSB7bWF0M30gb3V0IHRoZSByZWNlaXZpbmcgbWF0cml4XHJcbiAqIEBwYXJhbSB7bWF0M30gYSB0aGUgc291cmNlIG1hdHJpeFxyXG4gKiBAcmV0dXJucyB7bWF0M30gb3V0XHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gdHJhbnNwb3NlKG91dCwgYSkge1xyXG4gIC8vIElmIHdlIGFyZSB0cmFuc3Bvc2luZyBvdXJzZWx2ZXMgd2UgY2FuIHNraXAgYSBmZXcgc3RlcHMgYnV0IGhhdmUgdG8gY2FjaGUgc29tZSB2YWx1ZXNcclxuICBpZiAob3V0ID09PSBhKSB7XHJcbiAgICB2YXIgYTAxID0gYVsxXSxcclxuICAgICAgICBhMDIgPSBhWzJdLFxyXG4gICAgICAgIGExMiA9IGFbNV07XHJcbiAgICBvdXRbMV0gPSBhWzNdO1xyXG4gICAgb3V0WzJdID0gYVs2XTtcclxuICAgIG91dFszXSA9IGEwMTtcclxuICAgIG91dFs1XSA9IGFbN107XHJcbiAgICBvdXRbNl0gPSBhMDI7XHJcbiAgICBvdXRbN10gPSBhMTI7XHJcbiAgfSBlbHNlIHtcclxuICAgIG91dFswXSA9IGFbMF07XHJcbiAgICBvdXRbMV0gPSBhWzNdO1xyXG4gICAgb3V0WzJdID0gYVs2XTtcclxuICAgIG91dFszXSA9IGFbMV07XHJcbiAgICBvdXRbNF0gPSBhWzRdO1xyXG4gICAgb3V0WzVdID0gYVs3XTtcclxuICAgIG91dFs2XSA9IGFbMl07XHJcbiAgICBvdXRbN10gPSBhWzVdO1xyXG4gICAgb3V0WzhdID0gYVs4XTtcclxuICB9XHJcblxyXG4gIHJldHVybiBvdXQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBJbnZlcnRzIGEgbWF0M1xyXG4gKlxyXG4gKiBAcGFyYW0ge21hdDN9IG91dCB0aGUgcmVjZWl2aW5nIG1hdHJpeFxyXG4gKiBAcGFyYW0ge21hdDN9IGEgdGhlIHNvdXJjZSBtYXRyaXhcclxuICogQHJldHVybnMge21hdDN9IG91dFxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGludmVydChvdXQsIGEpIHtcclxuICB2YXIgYTAwID0gYVswXSxcclxuICAgICAgYTAxID0gYVsxXSxcclxuICAgICAgYTAyID0gYVsyXTtcclxuICB2YXIgYTEwID0gYVszXSxcclxuICAgICAgYTExID0gYVs0XSxcclxuICAgICAgYTEyID0gYVs1XTtcclxuICB2YXIgYTIwID0gYVs2XSxcclxuICAgICAgYTIxID0gYVs3XSxcclxuICAgICAgYTIyID0gYVs4XTtcclxuXHJcbiAgdmFyIGIwMSA9IGEyMiAqIGExMSAtIGExMiAqIGEyMTtcclxuICB2YXIgYjExID0gLWEyMiAqIGExMCArIGExMiAqIGEyMDtcclxuICB2YXIgYjIxID0gYTIxICogYTEwIC0gYTExICogYTIwO1xyXG5cclxuICAvLyBDYWxjdWxhdGUgdGhlIGRldGVybWluYW50XHJcbiAgdmFyIGRldCA9IGEwMCAqIGIwMSArIGEwMSAqIGIxMSArIGEwMiAqIGIyMTtcclxuXHJcbiAgaWYgKCFkZXQpIHtcclxuICAgIHJldHVybiBudWxsO1xyXG4gIH1cclxuICBkZXQgPSAxLjAgLyBkZXQ7XHJcblxyXG4gIG91dFswXSA9IGIwMSAqIGRldDtcclxuICBvdXRbMV0gPSAoLWEyMiAqIGEwMSArIGEwMiAqIGEyMSkgKiBkZXQ7XHJcbiAgb3V0WzJdID0gKGExMiAqIGEwMSAtIGEwMiAqIGExMSkgKiBkZXQ7XHJcbiAgb3V0WzNdID0gYjExICogZGV0O1xyXG4gIG91dFs0XSA9IChhMjIgKiBhMDAgLSBhMDIgKiBhMjApICogZGV0O1xyXG4gIG91dFs1XSA9ICgtYTEyICogYTAwICsgYTAyICogYTEwKSAqIGRldDtcclxuICBvdXRbNl0gPSBiMjEgKiBkZXQ7XHJcbiAgb3V0WzddID0gKC1hMjEgKiBhMDAgKyBhMDEgKiBhMjApICogZGV0O1xyXG4gIG91dFs4XSA9IChhMTEgKiBhMDAgLSBhMDEgKiBhMTApICogZGV0O1xyXG4gIHJldHVybiBvdXQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDYWxjdWxhdGVzIHRoZSBhZGp1Z2F0ZSBvZiBhIG1hdDNcclxuICpcclxuICogQHBhcmFtIHttYXQzfSBvdXQgdGhlIHJlY2VpdmluZyBtYXRyaXhcclxuICogQHBhcmFtIHttYXQzfSBhIHRoZSBzb3VyY2UgbWF0cml4XHJcbiAqIEByZXR1cm5zIHttYXQzfSBvdXRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBhZGpvaW50KG91dCwgYSkge1xyXG4gIHZhciBhMDAgPSBhWzBdLFxyXG4gICAgICBhMDEgPSBhWzFdLFxyXG4gICAgICBhMDIgPSBhWzJdO1xyXG4gIHZhciBhMTAgPSBhWzNdLFxyXG4gICAgICBhMTEgPSBhWzRdLFxyXG4gICAgICBhMTIgPSBhWzVdO1xyXG4gIHZhciBhMjAgPSBhWzZdLFxyXG4gICAgICBhMjEgPSBhWzddLFxyXG4gICAgICBhMjIgPSBhWzhdO1xyXG5cclxuICBvdXRbMF0gPSBhMTEgKiBhMjIgLSBhMTIgKiBhMjE7XHJcbiAgb3V0WzFdID0gYTAyICogYTIxIC0gYTAxICogYTIyO1xyXG4gIG91dFsyXSA9IGEwMSAqIGExMiAtIGEwMiAqIGExMTtcclxuICBvdXRbM10gPSBhMTIgKiBhMjAgLSBhMTAgKiBhMjI7XHJcbiAgb3V0WzRdID0gYTAwICogYTIyIC0gYTAyICogYTIwO1xyXG4gIG91dFs1XSA9IGEwMiAqIGExMCAtIGEwMCAqIGExMjtcclxuICBvdXRbNl0gPSBhMTAgKiBhMjEgLSBhMTEgKiBhMjA7XHJcbiAgb3V0WzddID0gYTAxICogYTIwIC0gYTAwICogYTIxO1xyXG4gIG91dFs4XSA9IGEwMCAqIGExMSAtIGEwMSAqIGExMDtcclxuICByZXR1cm4gb3V0O1xyXG59XHJcblxyXG4vKipcclxuICogQ2FsY3VsYXRlcyB0aGUgZGV0ZXJtaW5hbnQgb2YgYSBtYXQzXHJcbiAqXHJcbiAqIEBwYXJhbSB7bWF0M30gYSB0aGUgc291cmNlIG1hdHJpeFxyXG4gKiBAcmV0dXJucyB7TnVtYmVyfSBkZXRlcm1pbmFudCBvZiBhXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gZGV0ZXJtaW5hbnQoYSkge1xyXG4gIHZhciBhMDAgPSBhWzBdLFxyXG4gICAgICBhMDEgPSBhWzFdLFxyXG4gICAgICBhMDIgPSBhWzJdO1xyXG4gIHZhciBhMTAgPSBhWzNdLFxyXG4gICAgICBhMTEgPSBhWzRdLFxyXG4gICAgICBhMTIgPSBhWzVdO1xyXG4gIHZhciBhMjAgPSBhWzZdLFxyXG4gICAgICBhMjEgPSBhWzddLFxyXG4gICAgICBhMjIgPSBhWzhdO1xyXG5cclxuICByZXR1cm4gYTAwICogKGEyMiAqIGExMSAtIGExMiAqIGEyMSkgKyBhMDEgKiAoLWEyMiAqIGExMCArIGExMiAqIGEyMCkgKyBhMDIgKiAoYTIxICogYTEwIC0gYTExICogYTIwKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIE11bHRpcGxpZXMgdHdvIG1hdDMnc1xyXG4gKlxyXG4gKiBAcGFyYW0ge21hdDN9IG91dCB0aGUgcmVjZWl2aW5nIG1hdHJpeFxyXG4gKiBAcGFyYW0ge21hdDN9IGEgdGhlIGZpcnN0IG9wZXJhbmRcclxuICogQHBhcmFtIHttYXQzfSBiIHRoZSBzZWNvbmQgb3BlcmFuZFxyXG4gKiBAcmV0dXJucyB7bWF0M30gb3V0XHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gbXVsdGlwbHkob3V0LCBhLCBiKSB7XHJcbiAgdmFyIGEwMCA9IGFbMF0sXHJcbiAgICAgIGEwMSA9IGFbMV0sXHJcbiAgICAgIGEwMiA9IGFbMl07XHJcbiAgdmFyIGExMCA9IGFbM10sXHJcbiAgICAgIGExMSA9IGFbNF0sXHJcbiAgICAgIGExMiA9IGFbNV07XHJcbiAgdmFyIGEyMCA9IGFbNl0sXHJcbiAgICAgIGEyMSA9IGFbN10sXHJcbiAgICAgIGEyMiA9IGFbOF07XHJcblxyXG4gIHZhciBiMDAgPSBiWzBdLFxyXG4gICAgICBiMDEgPSBiWzFdLFxyXG4gICAgICBiMDIgPSBiWzJdO1xyXG4gIHZhciBiMTAgPSBiWzNdLFxyXG4gICAgICBiMTEgPSBiWzRdLFxyXG4gICAgICBiMTIgPSBiWzVdO1xyXG4gIHZhciBiMjAgPSBiWzZdLFxyXG4gICAgICBiMjEgPSBiWzddLFxyXG4gICAgICBiMjIgPSBiWzhdO1xyXG5cclxuICBvdXRbMF0gPSBiMDAgKiBhMDAgKyBiMDEgKiBhMTAgKyBiMDIgKiBhMjA7XHJcbiAgb3V0WzFdID0gYjAwICogYTAxICsgYjAxICogYTExICsgYjAyICogYTIxO1xyXG4gIG91dFsyXSA9IGIwMCAqIGEwMiArIGIwMSAqIGExMiArIGIwMiAqIGEyMjtcclxuXHJcbiAgb3V0WzNdID0gYjEwICogYTAwICsgYjExICogYTEwICsgYjEyICogYTIwO1xyXG4gIG91dFs0XSA9IGIxMCAqIGEwMSArIGIxMSAqIGExMSArIGIxMiAqIGEyMTtcclxuICBvdXRbNV0gPSBiMTAgKiBhMDIgKyBiMTEgKiBhMTIgKyBiMTIgKiBhMjI7XHJcblxyXG4gIG91dFs2XSA9IGIyMCAqIGEwMCArIGIyMSAqIGExMCArIGIyMiAqIGEyMDtcclxuICBvdXRbN10gPSBiMjAgKiBhMDEgKyBiMjEgKiBhMTEgKyBiMjIgKiBhMjE7XHJcbiAgb3V0WzhdID0gYjIwICogYTAyICsgYjIxICogYTEyICsgYjIyICogYTIyO1xyXG4gIHJldHVybiBvdXQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBUcmFuc2xhdGUgYSBtYXQzIGJ5IHRoZSBnaXZlbiB2ZWN0b3JcclxuICpcclxuICogQHBhcmFtIHttYXQzfSBvdXQgdGhlIHJlY2VpdmluZyBtYXRyaXhcclxuICogQHBhcmFtIHttYXQzfSBhIHRoZSBtYXRyaXggdG8gdHJhbnNsYXRlXHJcbiAqIEBwYXJhbSB7dmVjMn0gdiB2ZWN0b3IgdG8gdHJhbnNsYXRlIGJ5XHJcbiAqIEByZXR1cm5zIHttYXQzfSBvdXRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiB0cmFuc2xhdGUob3V0LCBhLCB2KSB7XHJcbiAgdmFyIGEwMCA9IGFbMF0sXHJcbiAgICAgIGEwMSA9IGFbMV0sXHJcbiAgICAgIGEwMiA9IGFbMl0sXHJcbiAgICAgIGExMCA9IGFbM10sXHJcbiAgICAgIGExMSA9IGFbNF0sXHJcbiAgICAgIGExMiA9IGFbNV0sXHJcbiAgICAgIGEyMCA9IGFbNl0sXHJcbiAgICAgIGEyMSA9IGFbN10sXHJcbiAgICAgIGEyMiA9IGFbOF0sXHJcbiAgICAgIHggPSB2WzBdLFxyXG4gICAgICB5ID0gdlsxXTtcclxuXHJcbiAgb3V0WzBdID0gYTAwO1xyXG4gIG91dFsxXSA9IGEwMTtcclxuICBvdXRbMl0gPSBhMDI7XHJcblxyXG4gIG91dFszXSA9IGExMDtcclxuICBvdXRbNF0gPSBhMTE7XHJcbiAgb3V0WzVdID0gYTEyO1xyXG5cclxuICBvdXRbNl0gPSB4ICogYTAwICsgeSAqIGExMCArIGEyMDtcclxuICBvdXRbN10gPSB4ICogYTAxICsgeSAqIGExMSArIGEyMTtcclxuICBvdXRbOF0gPSB4ICogYTAyICsgeSAqIGExMiArIGEyMjtcclxuICByZXR1cm4gb3V0O1xyXG59XHJcblxyXG4vKipcclxuICogUm90YXRlcyBhIG1hdDMgYnkgdGhlIGdpdmVuIGFuZ2xlXHJcbiAqXHJcbiAqIEBwYXJhbSB7bWF0M30gb3V0IHRoZSByZWNlaXZpbmcgbWF0cml4XHJcbiAqIEBwYXJhbSB7bWF0M30gYSB0aGUgbWF0cml4IHRvIHJvdGF0ZVxyXG4gKiBAcGFyYW0ge051bWJlcn0gcmFkIHRoZSBhbmdsZSB0byByb3RhdGUgdGhlIG1hdHJpeCBieVxyXG4gKiBAcmV0dXJucyB7bWF0M30gb3V0XHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gcm90YXRlKG91dCwgYSwgcmFkKSB7XHJcbiAgdmFyIGEwMCA9IGFbMF0sXHJcbiAgICAgIGEwMSA9IGFbMV0sXHJcbiAgICAgIGEwMiA9IGFbMl0sXHJcbiAgICAgIGExMCA9IGFbM10sXHJcbiAgICAgIGExMSA9IGFbNF0sXHJcbiAgICAgIGExMiA9IGFbNV0sXHJcbiAgICAgIGEyMCA9IGFbNl0sXHJcbiAgICAgIGEyMSA9IGFbN10sXHJcbiAgICAgIGEyMiA9IGFbOF0sXHJcbiAgICAgIHMgPSBNYXRoLnNpbihyYWQpLFxyXG4gICAgICBjID0gTWF0aC5jb3MocmFkKTtcclxuXHJcbiAgb3V0WzBdID0gYyAqIGEwMCArIHMgKiBhMTA7XHJcbiAgb3V0WzFdID0gYyAqIGEwMSArIHMgKiBhMTE7XHJcbiAgb3V0WzJdID0gYyAqIGEwMiArIHMgKiBhMTI7XHJcblxyXG4gIG91dFszXSA9IGMgKiBhMTAgLSBzICogYTAwO1xyXG4gIG91dFs0XSA9IGMgKiBhMTEgLSBzICogYTAxO1xyXG4gIG91dFs1XSA9IGMgKiBhMTIgLSBzICogYTAyO1xyXG5cclxuICBvdXRbNl0gPSBhMjA7XHJcbiAgb3V0WzddID0gYTIxO1xyXG4gIG91dFs4XSA9IGEyMjtcclxuICByZXR1cm4gb3V0O1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIFNjYWxlcyB0aGUgbWF0MyBieSB0aGUgZGltZW5zaW9ucyBpbiB0aGUgZ2l2ZW4gdmVjMlxyXG4gKlxyXG4gKiBAcGFyYW0ge21hdDN9IG91dCB0aGUgcmVjZWl2aW5nIG1hdHJpeFxyXG4gKiBAcGFyYW0ge21hdDN9IGEgdGhlIG1hdHJpeCB0byByb3RhdGVcclxuICogQHBhcmFtIHt2ZWMyfSB2IHRoZSB2ZWMyIHRvIHNjYWxlIHRoZSBtYXRyaXggYnlcclxuICogQHJldHVybnMge21hdDN9IG91dFxyXG4gKiovXHJcbmV4cG9ydCBmdW5jdGlvbiBzY2FsZShvdXQsIGEsIHYpIHtcclxuICB2YXIgeCA9IHZbMF0sXHJcbiAgICAgIHkgPSB2WzFdO1xyXG5cclxuICBvdXRbMF0gPSB4ICogYVswXTtcclxuICBvdXRbMV0gPSB4ICogYVsxXTtcclxuICBvdXRbMl0gPSB4ICogYVsyXTtcclxuXHJcbiAgb3V0WzNdID0geSAqIGFbM107XHJcbiAgb3V0WzRdID0geSAqIGFbNF07XHJcbiAgb3V0WzVdID0geSAqIGFbNV07XHJcblxyXG4gIG91dFs2XSA9IGFbNl07XHJcbiAgb3V0WzddID0gYVs3XTtcclxuICBvdXRbOF0gPSBhWzhdO1xyXG4gIHJldHVybiBvdXQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDcmVhdGVzIGEgbWF0cml4IGZyb20gYSB2ZWN0b3IgdHJhbnNsYXRpb25cclxuICogVGhpcyBpcyBlcXVpdmFsZW50IHRvIChidXQgbXVjaCBmYXN0ZXIgdGhhbik6XHJcbiAqXHJcbiAqICAgICBtYXQzLmlkZW50aXR5KGRlc3QpO1xyXG4gKiAgICAgbWF0My50cmFuc2xhdGUoZGVzdCwgZGVzdCwgdmVjKTtcclxuICpcclxuICogQHBhcmFtIHttYXQzfSBvdXQgbWF0MyByZWNlaXZpbmcgb3BlcmF0aW9uIHJlc3VsdFxyXG4gKiBAcGFyYW0ge3ZlYzJ9IHYgVHJhbnNsYXRpb24gdmVjdG9yXHJcbiAqIEByZXR1cm5zIHttYXQzfSBvdXRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBmcm9tVHJhbnNsYXRpb24ob3V0LCB2KSB7XHJcbiAgb3V0WzBdID0gMTtcclxuICBvdXRbMV0gPSAwO1xyXG4gIG91dFsyXSA9IDA7XHJcbiAgb3V0WzNdID0gMDtcclxuICBvdXRbNF0gPSAxO1xyXG4gIG91dFs1XSA9IDA7XHJcbiAgb3V0WzZdID0gdlswXTtcclxuICBvdXRbN10gPSB2WzFdO1xyXG4gIG91dFs4XSA9IDE7XHJcbiAgcmV0dXJuIG91dDtcclxufVxyXG5cclxuLyoqXHJcbiAqIENyZWF0ZXMgYSBtYXRyaXggZnJvbSBhIGdpdmVuIGFuZ2xlXHJcbiAqIFRoaXMgaXMgZXF1aXZhbGVudCB0byAoYnV0IG11Y2ggZmFzdGVyIHRoYW4pOlxyXG4gKlxyXG4gKiAgICAgbWF0My5pZGVudGl0eShkZXN0KTtcclxuICogICAgIG1hdDMucm90YXRlKGRlc3QsIGRlc3QsIHJhZCk7XHJcbiAqXHJcbiAqIEBwYXJhbSB7bWF0M30gb3V0IG1hdDMgcmVjZWl2aW5nIG9wZXJhdGlvbiByZXN1bHRcclxuICogQHBhcmFtIHtOdW1iZXJ9IHJhZCB0aGUgYW5nbGUgdG8gcm90YXRlIHRoZSBtYXRyaXggYnlcclxuICogQHJldHVybnMge21hdDN9IG91dFxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGZyb21Sb3RhdGlvbihvdXQsIHJhZCkge1xyXG4gIHZhciBzID0gTWF0aC5zaW4ocmFkKSxcclxuICAgICAgYyA9IE1hdGguY29zKHJhZCk7XHJcblxyXG4gIG91dFswXSA9IGM7XHJcbiAgb3V0WzFdID0gcztcclxuICBvdXRbMl0gPSAwO1xyXG5cclxuICBvdXRbM10gPSAtcztcclxuICBvdXRbNF0gPSBjO1xyXG4gIG91dFs1XSA9IDA7XHJcblxyXG4gIG91dFs2XSA9IDA7XHJcbiAgb3V0WzddID0gMDtcclxuICBvdXRbOF0gPSAxO1xyXG4gIHJldHVybiBvdXQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDcmVhdGVzIGEgbWF0cml4IGZyb20gYSB2ZWN0b3Igc2NhbGluZ1xyXG4gKiBUaGlzIGlzIGVxdWl2YWxlbnQgdG8gKGJ1dCBtdWNoIGZhc3RlciB0aGFuKTpcclxuICpcclxuICogICAgIG1hdDMuaWRlbnRpdHkoZGVzdCk7XHJcbiAqICAgICBtYXQzLnNjYWxlKGRlc3QsIGRlc3QsIHZlYyk7XHJcbiAqXHJcbiAqIEBwYXJhbSB7bWF0M30gb3V0IG1hdDMgcmVjZWl2aW5nIG9wZXJhdGlvbiByZXN1bHRcclxuICogQHBhcmFtIHt2ZWMyfSB2IFNjYWxpbmcgdmVjdG9yXHJcbiAqIEByZXR1cm5zIHttYXQzfSBvdXRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBmcm9tU2NhbGluZyhvdXQsIHYpIHtcclxuICBvdXRbMF0gPSB2WzBdO1xyXG4gIG91dFsxXSA9IDA7XHJcbiAgb3V0WzJdID0gMDtcclxuXHJcbiAgb3V0WzNdID0gMDtcclxuICBvdXRbNF0gPSB2WzFdO1xyXG4gIG91dFs1XSA9IDA7XHJcblxyXG4gIG91dFs2XSA9IDA7XHJcbiAgb3V0WzddID0gMDtcclxuICBvdXRbOF0gPSAxO1xyXG4gIHJldHVybiBvdXQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDb3BpZXMgdGhlIHZhbHVlcyBmcm9tIGEgbWF0MmQgaW50byBhIG1hdDNcclxuICpcclxuICogQHBhcmFtIHttYXQzfSBvdXQgdGhlIHJlY2VpdmluZyBtYXRyaXhcclxuICogQHBhcmFtIHttYXQyZH0gYSB0aGUgbWF0cml4IHRvIGNvcHlcclxuICogQHJldHVybnMge21hdDN9IG91dFxyXG4gKiovXHJcbmV4cG9ydCBmdW5jdGlvbiBmcm9tTWF0MmQob3V0LCBhKSB7XHJcbiAgb3V0WzBdID0gYVswXTtcclxuICBvdXRbMV0gPSBhWzFdO1xyXG4gIG91dFsyXSA9IDA7XHJcblxyXG4gIG91dFszXSA9IGFbMl07XHJcbiAgb3V0WzRdID0gYVszXTtcclxuICBvdXRbNV0gPSAwO1xyXG5cclxuICBvdXRbNl0gPSBhWzRdO1xyXG4gIG91dFs3XSA9IGFbNV07XHJcbiAgb3V0WzhdID0gMTtcclxuICByZXR1cm4gb3V0O1xyXG59XHJcblxyXG4vKipcclxuKiBDYWxjdWxhdGVzIGEgM3gzIG1hdHJpeCBmcm9tIHRoZSBnaXZlbiBxdWF0ZXJuaW9uXHJcbipcclxuKiBAcGFyYW0ge21hdDN9IG91dCBtYXQzIHJlY2VpdmluZyBvcGVyYXRpb24gcmVzdWx0XHJcbiogQHBhcmFtIHtxdWF0fSBxIFF1YXRlcm5pb24gdG8gY3JlYXRlIG1hdHJpeCBmcm9tXHJcbipcclxuKiBAcmV0dXJucyB7bWF0M30gb3V0XHJcbiovXHJcbmV4cG9ydCBmdW5jdGlvbiBmcm9tUXVhdChvdXQsIHEpIHtcclxuICB2YXIgeCA9IHFbMF0sXHJcbiAgICAgIHkgPSBxWzFdLFxyXG4gICAgICB6ID0gcVsyXSxcclxuICAgICAgdyA9IHFbM107XHJcbiAgdmFyIHgyID0geCArIHg7XHJcbiAgdmFyIHkyID0geSArIHk7XHJcbiAgdmFyIHoyID0geiArIHo7XHJcblxyXG4gIHZhciB4eCA9IHggKiB4MjtcclxuICB2YXIgeXggPSB5ICogeDI7XHJcbiAgdmFyIHl5ID0geSAqIHkyO1xyXG4gIHZhciB6eCA9IHogKiB4MjtcclxuICB2YXIgenkgPSB6ICogeTI7XHJcbiAgdmFyIHp6ID0geiAqIHoyO1xyXG4gIHZhciB3eCA9IHcgKiB4MjtcclxuICB2YXIgd3kgPSB3ICogeTI7XHJcbiAgdmFyIHd6ID0gdyAqIHoyO1xyXG5cclxuICBvdXRbMF0gPSAxIC0geXkgLSB6ejtcclxuICBvdXRbM10gPSB5eCAtIHd6O1xyXG4gIG91dFs2XSA9IHp4ICsgd3k7XHJcblxyXG4gIG91dFsxXSA9IHl4ICsgd3o7XHJcbiAgb3V0WzRdID0gMSAtIHh4IC0geno7XHJcbiAgb3V0WzddID0genkgLSB3eDtcclxuXHJcbiAgb3V0WzJdID0genggLSB3eTtcclxuICBvdXRbNV0gPSB6eSArIHd4O1xyXG4gIG91dFs4XSA9IDEgLSB4eCAtIHl5O1xyXG5cclxuICByZXR1cm4gb3V0O1xyXG59XHJcblxyXG4vKipcclxuKiBDYWxjdWxhdGVzIGEgM3gzIG5vcm1hbCBtYXRyaXggKHRyYW5zcG9zZSBpbnZlcnNlKSBmcm9tIHRoZSA0eDQgbWF0cml4XHJcbipcclxuKiBAcGFyYW0ge21hdDN9IG91dCBtYXQzIHJlY2VpdmluZyBvcGVyYXRpb24gcmVzdWx0XHJcbiogQHBhcmFtIHttYXQ0fSBhIE1hdDQgdG8gZGVyaXZlIHRoZSBub3JtYWwgbWF0cml4IGZyb21cclxuKlxyXG4qIEByZXR1cm5zIHttYXQzfSBvdXRcclxuKi9cclxuZXhwb3J0IGZ1bmN0aW9uIG5vcm1hbEZyb21NYXQ0KG91dCwgYSkge1xyXG4gIHZhciBhMDAgPSBhWzBdLFxyXG4gICAgICBhMDEgPSBhWzFdLFxyXG4gICAgICBhMDIgPSBhWzJdLFxyXG4gICAgICBhMDMgPSBhWzNdO1xyXG4gIHZhciBhMTAgPSBhWzRdLFxyXG4gICAgICBhMTEgPSBhWzVdLFxyXG4gICAgICBhMTIgPSBhWzZdLFxyXG4gICAgICBhMTMgPSBhWzddO1xyXG4gIHZhciBhMjAgPSBhWzhdLFxyXG4gICAgICBhMjEgPSBhWzldLFxyXG4gICAgICBhMjIgPSBhWzEwXSxcclxuICAgICAgYTIzID0gYVsxMV07XHJcbiAgdmFyIGEzMCA9IGFbMTJdLFxyXG4gICAgICBhMzEgPSBhWzEzXSxcclxuICAgICAgYTMyID0gYVsxNF0sXHJcbiAgICAgIGEzMyA9IGFbMTVdO1xyXG5cclxuICB2YXIgYjAwID0gYTAwICogYTExIC0gYTAxICogYTEwO1xyXG4gIHZhciBiMDEgPSBhMDAgKiBhMTIgLSBhMDIgKiBhMTA7XHJcbiAgdmFyIGIwMiA9IGEwMCAqIGExMyAtIGEwMyAqIGExMDtcclxuICB2YXIgYjAzID0gYTAxICogYTEyIC0gYTAyICogYTExO1xyXG4gIHZhciBiMDQgPSBhMDEgKiBhMTMgLSBhMDMgKiBhMTE7XHJcbiAgdmFyIGIwNSA9IGEwMiAqIGExMyAtIGEwMyAqIGExMjtcclxuICB2YXIgYjA2ID0gYTIwICogYTMxIC0gYTIxICogYTMwO1xyXG4gIHZhciBiMDcgPSBhMjAgKiBhMzIgLSBhMjIgKiBhMzA7XHJcbiAgdmFyIGIwOCA9IGEyMCAqIGEzMyAtIGEyMyAqIGEzMDtcclxuICB2YXIgYjA5ID0gYTIxICogYTMyIC0gYTIyICogYTMxO1xyXG4gIHZhciBiMTAgPSBhMjEgKiBhMzMgLSBhMjMgKiBhMzE7XHJcbiAgdmFyIGIxMSA9IGEyMiAqIGEzMyAtIGEyMyAqIGEzMjtcclxuXHJcbiAgLy8gQ2FsY3VsYXRlIHRoZSBkZXRlcm1pbmFudFxyXG4gIHZhciBkZXQgPSBiMDAgKiBiMTEgLSBiMDEgKiBiMTAgKyBiMDIgKiBiMDkgKyBiMDMgKiBiMDggLSBiMDQgKiBiMDcgKyBiMDUgKiBiMDY7XHJcblxyXG4gIGlmICghZGV0KSB7XHJcbiAgICByZXR1cm4gbnVsbDtcclxuICB9XHJcbiAgZGV0ID0gMS4wIC8gZGV0O1xyXG5cclxuICBvdXRbMF0gPSAoYTExICogYjExIC0gYTEyICogYjEwICsgYTEzICogYjA5KSAqIGRldDtcclxuICBvdXRbMV0gPSAoYTEyICogYjA4IC0gYTEwICogYjExIC0gYTEzICogYjA3KSAqIGRldDtcclxuICBvdXRbMl0gPSAoYTEwICogYjEwIC0gYTExICogYjA4ICsgYTEzICogYjA2KSAqIGRldDtcclxuXHJcbiAgb3V0WzNdID0gKGEwMiAqIGIxMCAtIGEwMSAqIGIxMSAtIGEwMyAqIGIwOSkgKiBkZXQ7XHJcbiAgb3V0WzRdID0gKGEwMCAqIGIxMSAtIGEwMiAqIGIwOCArIGEwMyAqIGIwNykgKiBkZXQ7XHJcbiAgb3V0WzVdID0gKGEwMSAqIGIwOCAtIGEwMCAqIGIxMCAtIGEwMyAqIGIwNikgKiBkZXQ7XHJcblxyXG4gIG91dFs2XSA9IChhMzEgKiBiMDUgLSBhMzIgKiBiMDQgKyBhMzMgKiBiMDMpICogZGV0O1xyXG4gIG91dFs3XSA9IChhMzIgKiBiMDIgLSBhMzAgKiBiMDUgLSBhMzMgKiBiMDEpICogZGV0O1xyXG4gIG91dFs4XSA9IChhMzAgKiBiMDQgLSBhMzEgKiBiMDIgKyBhMzMgKiBiMDApICogZGV0O1xyXG5cclxuICByZXR1cm4gb3V0O1xyXG59XHJcblxyXG4vKipcclxuICogR2VuZXJhdGVzIGEgMkQgcHJvamVjdGlvbiBtYXRyaXggd2l0aCB0aGUgZ2l2ZW4gYm91bmRzXHJcbiAqXHJcbiAqIEBwYXJhbSB7bWF0M30gb3V0IG1hdDMgZnJ1c3R1bSBtYXRyaXggd2lsbCBiZSB3cml0dGVuIGludG9cclxuICogQHBhcmFtIHtudW1iZXJ9IHdpZHRoIFdpZHRoIG9mIHlvdXIgZ2wgY29udGV4dFxyXG4gKiBAcGFyYW0ge251bWJlcn0gaGVpZ2h0IEhlaWdodCBvZiBnbCBjb250ZXh0XHJcbiAqIEByZXR1cm5zIHttYXQzfSBvdXRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBwcm9qZWN0aW9uKG91dCwgd2lkdGgsIGhlaWdodCkge1xyXG4gIG91dFswXSA9IDIgLyB3aWR0aDtcclxuICBvdXRbMV0gPSAwO1xyXG4gIG91dFsyXSA9IDA7XHJcbiAgb3V0WzNdID0gMDtcclxuICBvdXRbNF0gPSAtMiAvIGhlaWdodDtcclxuICBvdXRbNV0gPSAwO1xyXG4gIG91dFs2XSA9IC0xO1xyXG4gIG91dFs3XSA9IDE7XHJcbiAgb3V0WzhdID0gMTtcclxuICByZXR1cm4gb3V0O1xyXG59XHJcblxyXG4vKipcclxuICogUmV0dXJucyBhIHN0cmluZyByZXByZXNlbnRhdGlvbiBvZiBhIG1hdDNcclxuICpcclxuICogQHBhcmFtIHttYXQzfSBhIG1hdHJpeCB0byByZXByZXNlbnQgYXMgYSBzdHJpbmdcclxuICogQHJldHVybnMge1N0cmluZ30gc3RyaW5nIHJlcHJlc2VudGF0aW9uIG9mIHRoZSBtYXRyaXhcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBzdHIoYSkge1xyXG4gIHJldHVybiAnbWF0MygnICsgYVswXSArICcsICcgKyBhWzFdICsgJywgJyArIGFbMl0gKyAnLCAnICsgYVszXSArICcsICcgKyBhWzRdICsgJywgJyArIGFbNV0gKyAnLCAnICsgYVs2XSArICcsICcgKyBhWzddICsgJywgJyArIGFbOF0gKyAnKSc7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBSZXR1cm5zIEZyb2Jlbml1cyBub3JtIG9mIGEgbWF0M1xyXG4gKlxyXG4gKiBAcGFyYW0ge21hdDN9IGEgdGhlIG1hdHJpeCB0byBjYWxjdWxhdGUgRnJvYmVuaXVzIG5vcm0gb2ZcclxuICogQHJldHVybnMge051bWJlcn0gRnJvYmVuaXVzIG5vcm1cclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBmcm9iKGEpIHtcclxuICByZXR1cm4gTWF0aC5zcXJ0KE1hdGgucG93KGFbMF0sIDIpICsgTWF0aC5wb3coYVsxXSwgMikgKyBNYXRoLnBvdyhhWzJdLCAyKSArIE1hdGgucG93KGFbM10sIDIpICsgTWF0aC5wb3coYVs0XSwgMikgKyBNYXRoLnBvdyhhWzVdLCAyKSArIE1hdGgucG93KGFbNl0sIDIpICsgTWF0aC5wb3coYVs3XSwgMikgKyBNYXRoLnBvdyhhWzhdLCAyKSk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBBZGRzIHR3byBtYXQzJ3NcclxuICpcclxuICogQHBhcmFtIHttYXQzfSBvdXQgdGhlIHJlY2VpdmluZyBtYXRyaXhcclxuICogQHBhcmFtIHttYXQzfSBhIHRoZSBmaXJzdCBvcGVyYW5kXHJcbiAqIEBwYXJhbSB7bWF0M30gYiB0aGUgc2Vjb25kIG9wZXJhbmRcclxuICogQHJldHVybnMge21hdDN9IG91dFxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGFkZChvdXQsIGEsIGIpIHtcclxuICBvdXRbMF0gPSBhWzBdICsgYlswXTtcclxuICBvdXRbMV0gPSBhWzFdICsgYlsxXTtcclxuICBvdXRbMl0gPSBhWzJdICsgYlsyXTtcclxuICBvdXRbM10gPSBhWzNdICsgYlszXTtcclxuICBvdXRbNF0gPSBhWzRdICsgYls0XTtcclxuICBvdXRbNV0gPSBhWzVdICsgYls1XTtcclxuICBvdXRbNl0gPSBhWzZdICsgYls2XTtcclxuICBvdXRbN10gPSBhWzddICsgYls3XTtcclxuICBvdXRbOF0gPSBhWzhdICsgYls4XTtcclxuICByZXR1cm4gb3V0O1xyXG59XHJcblxyXG4vKipcclxuICogU3VidHJhY3RzIG1hdHJpeCBiIGZyb20gbWF0cml4IGFcclxuICpcclxuICogQHBhcmFtIHttYXQzfSBvdXQgdGhlIHJlY2VpdmluZyBtYXRyaXhcclxuICogQHBhcmFtIHttYXQzfSBhIHRoZSBmaXJzdCBvcGVyYW5kXHJcbiAqIEBwYXJhbSB7bWF0M30gYiB0aGUgc2Vjb25kIG9wZXJhbmRcclxuICogQHJldHVybnMge21hdDN9IG91dFxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIHN1YnRyYWN0KG91dCwgYSwgYikge1xyXG4gIG91dFswXSA9IGFbMF0gLSBiWzBdO1xyXG4gIG91dFsxXSA9IGFbMV0gLSBiWzFdO1xyXG4gIG91dFsyXSA9IGFbMl0gLSBiWzJdO1xyXG4gIG91dFszXSA9IGFbM10gLSBiWzNdO1xyXG4gIG91dFs0XSA9IGFbNF0gLSBiWzRdO1xyXG4gIG91dFs1XSA9IGFbNV0gLSBiWzVdO1xyXG4gIG91dFs2XSA9IGFbNl0gLSBiWzZdO1xyXG4gIG91dFs3XSA9IGFbN10gLSBiWzddO1xyXG4gIG91dFs4XSA9IGFbOF0gLSBiWzhdO1xyXG4gIHJldHVybiBvdXQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBNdWx0aXBseSBlYWNoIGVsZW1lbnQgb2YgdGhlIG1hdHJpeCBieSBhIHNjYWxhci5cclxuICpcclxuICogQHBhcmFtIHttYXQzfSBvdXQgdGhlIHJlY2VpdmluZyBtYXRyaXhcclxuICogQHBhcmFtIHttYXQzfSBhIHRoZSBtYXRyaXggdG8gc2NhbGVcclxuICogQHBhcmFtIHtOdW1iZXJ9IGIgYW1vdW50IHRvIHNjYWxlIHRoZSBtYXRyaXgncyBlbGVtZW50cyBieVxyXG4gKiBAcmV0dXJucyB7bWF0M30gb3V0XHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gbXVsdGlwbHlTY2FsYXIob3V0LCBhLCBiKSB7XHJcbiAgb3V0WzBdID0gYVswXSAqIGI7XHJcbiAgb3V0WzFdID0gYVsxXSAqIGI7XHJcbiAgb3V0WzJdID0gYVsyXSAqIGI7XHJcbiAgb3V0WzNdID0gYVszXSAqIGI7XHJcbiAgb3V0WzRdID0gYVs0XSAqIGI7XHJcbiAgb3V0WzVdID0gYVs1XSAqIGI7XHJcbiAgb3V0WzZdID0gYVs2XSAqIGI7XHJcbiAgb3V0WzddID0gYVs3XSAqIGI7XHJcbiAgb3V0WzhdID0gYVs4XSAqIGI7XHJcbiAgcmV0dXJuIG91dDtcclxufVxyXG5cclxuLyoqXHJcbiAqIEFkZHMgdHdvIG1hdDMncyBhZnRlciBtdWx0aXBseWluZyBlYWNoIGVsZW1lbnQgb2YgdGhlIHNlY29uZCBvcGVyYW5kIGJ5IGEgc2NhbGFyIHZhbHVlLlxyXG4gKlxyXG4gKiBAcGFyYW0ge21hdDN9IG91dCB0aGUgcmVjZWl2aW5nIHZlY3RvclxyXG4gKiBAcGFyYW0ge21hdDN9IGEgdGhlIGZpcnN0IG9wZXJhbmRcclxuICogQHBhcmFtIHttYXQzfSBiIHRoZSBzZWNvbmQgb3BlcmFuZFxyXG4gKiBAcGFyYW0ge051bWJlcn0gc2NhbGUgdGhlIGFtb3VudCB0byBzY2FsZSBiJ3MgZWxlbWVudHMgYnkgYmVmb3JlIGFkZGluZ1xyXG4gKiBAcmV0dXJucyB7bWF0M30gb3V0XHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gbXVsdGlwbHlTY2FsYXJBbmRBZGQob3V0LCBhLCBiLCBzY2FsZSkge1xyXG4gIG91dFswXSA9IGFbMF0gKyBiWzBdICogc2NhbGU7XHJcbiAgb3V0WzFdID0gYVsxXSArIGJbMV0gKiBzY2FsZTtcclxuICBvdXRbMl0gPSBhWzJdICsgYlsyXSAqIHNjYWxlO1xyXG4gIG91dFszXSA9IGFbM10gKyBiWzNdICogc2NhbGU7XHJcbiAgb3V0WzRdID0gYVs0XSArIGJbNF0gKiBzY2FsZTtcclxuICBvdXRbNV0gPSBhWzVdICsgYls1XSAqIHNjYWxlO1xyXG4gIG91dFs2XSA9IGFbNl0gKyBiWzZdICogc2NhbGU7XHJcbiAgb3V0WzddID0gYVs3XSArIGJbN10gKiBzY2FsZTtcclxuICBvdXRbOF0gPSBhWzhdICsgYls4XSAqIHNjYWxlO1xyXG4gIHJldHVybiBvdXQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBSZXR1cm5zIHdoZXRoZXIgb3Igbm90IHRoZSBtYXRyaWNlcyBoYXZlIGV4YWN0bHkgdGhlIHNhbWUgZWxlbWVudHMgaW4gdGhlIHNhbWUgcG9zaXRpb24gKHdoZW4gY29tcGFyZWQgd2l0aCA9PT0pXHJcbiAqXHJcbiAqIEBwYXJhbSB7bWF0M30gYSBUaGUgZmlyc3QgbWF0cml4LlxyXG4gKiBAcGFyYW0ge21hdDN9IGIgVGhlIHNlY29uZCBtYXRyaXguXHJcbiAqIEByZXR1cm5zIHtCb29sZWFufSBUcnVlIGlmIHRoZSBtYXRyaWNlcyBhcmUgZXF1YWwsIGZhbHNlIG90aGVyd2lzZS5cclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBleGFjdEVxdWFscyhhLCBiKSB7XHJcbiAgcmV0dXJuIGFbMF0gPT09IGJbMF0gJiYgYVsxXSA9PT0gYlsxXSAmJiBhWzJdID09PSBiWzJdICYmIGFbM10gPT09IGJbM10gJiYgYVs0XSA9PT0gYls0XSAmJiBhWzVdID09PSBiWzVdICYmIGFbNl0gPT09IGJbNl0gJiYgYVs3XSA9PT0gYls3XSAmJiBhWzhdID09PSBiWzhdO1xyXG59XHJcblxyXG4vKipcclxuICogUmV0dXJucyB3aGV0aGVyIG9yIG5vdCB0aGUgbWF0cmljZXMgaGF2ZSBhcHByb3hpbWF0ZWx5IHRoZSBzYW1lIGVsZW1lbnRzIGluIHRoZSBzYW1lIHBvc2l0aW9uLlxyXG4gKlxyXG4gKiBAcGFyYW0ge21hdDN9IGEgVGhlIGZpcnN0IG1hdHJpeC5cclxuICogQHBhcmFtIHttYXQzfSBiIFRoZSBzZWNvbmQgbWF0cml4LlxyXG4gKiBAcmV0dXJucyB7Qm9vbGVhbn0gVHJ1ZSBpZiB0aGUgbWF0cmljZXMgYXJlIGVxdWFsLCBmYWxzZSBvdGhlcndpc2UuXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gZXF1YWxzKGEsIGIpIHtcclxuICB2YXIgYTAgPSBhWzBdLFxyXG4gICAgICBhMSA9IGFbMV0sXHJcbiAgICAgIGEyID0gYVsyXSxcclxuICAgICAgYTMgPSBhWzNdLFxyXG4gICAgICBhNCA9IGFbNF0sXHJcbiAgICAgIGE1ID0gYVs1XSxcclxuICAgICAgYTYgPSBhWzZdLFxyXG4gICAgICBhNyA9IGFbN10sXHJcbiAgICAgIGE4ID0gYVs4XTtcclxuICB2YXIgYjAgPSBiWzBdLFxyXG4gICAgICBiMSA9IGJbMV0sXHJcbiAgICAgIGIyID0gYlsyXSxcclxuICAgICAgYjMgPSBiWzNdLFxyXG4gICAgICBiNCA9IGJbNF0sXHJcbiAgICAgIGI1ID0gYls1XSxcclxuICAgICAgYjYgPSBiWzZdLFxyXG4gICAgICBiNyA9IGJbN10sXHJcbiAgICAgIGI4ID0gYls4XTtcclxuICByZXR1cm4gTWF0aC5hYnMoYTAgLSBiMCkgPD0gZ2xNYXRyaXguRVBTSUxPTiAqIE1hdGgubWF4KDEuMCwgTWF0aC5hYnMoYTApLCBNYXRoLmFicyhiMCkpICYmIE1hdGguYWJzKGExIC0gYjEpIDw9IGdsTWF0cml4LkVQU0lMT04gKiBNYXRoLm1heCgxLjAsIE1hdGguYWJzKGExKSwgTWF0aC5hYnMoYjEpKSAmJiBNYXRoLmFicyhhMiAtIGIyKSA8PSBnbE1hdHJpeC5FUFNJTE9OICogTWF0aC5tYXgoMS4wLCBNYXRoLmFicyhhMiksIE1hdGguYWJzKGIyKSkgJiYgTWF0aC5hYnMoYTMgLSBiMykgPD0gZ2xNYXRyaXguRVBTSUxPTiAqIE1hdGgubWF4KDEuMCwgTWF0aC5hYnMoYTMpLCBNYXRoLmFicyhiMykpICYmIE1hdGguYWJzKGE0IC0gYjQpIDw9IGdsTWF0cml4LkVQU0lMT04gKiBNYXRoLm1heCgxLjAsIE1hdGguYWJzKGE0KSwgTWF0aC5hYnMoYjQpKSAmJiBNYXRoLmFicyhhNSAtIGI1KSA8PSBnbE1hdHJpeC5FUFNJTE9OICogTWF0aC5tYXgoMS4wLCBNYXRoLmFicyhhNSksIE1hdGguYWJzKGI1KSkgJiYgTWF0aC5hYnMoYTYgLSBiNikgPD0gZ2xNYXRyaXguRVBTSUxPTiAqIE1hdGgubWF4KDEuMCwgTWF0aC5hYnMoYTYpLCBNYXRoLmFicyhiNikpICYmIE1hdGguYWJzKGE3IC0gYjcpIDw9IGdsTWF0cml4LkVQU0lMT04gKiBNYXRoLm1heCgxLjAsIE1hdGguYWJzKGE3KSwgTWF0aC5hYnMoYjcpKSAmJiBNYXRoLmFicyhhOCAtIGI4KSA8PSBnbE1hdHJpeC5FUFNJTE9OICogTWF0aC5tYXgoMS4wLCBNYXRoLmFicyhhOCksIE1hdGguYWJzKGI4KSk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBBbGlhcyBmb3Ige0BsaW5rIG1hdDMubXVsdGlwbHl9XHJcbiAqIEBmdW5jdGlvblxyXG4gKi9cclxuZXhwb3J0IHZhciBtdWwgPSBtdWx0aXBseTtcclxuXHJcbi8qKlxyXG4gKiBBbGlhcyBmb3Ige0BsaW5rIG1hdDMuc3VidHJhY3R9XHJcbiAqIEBmdW5jdGlvblxyXG4gKi9cclxuZXhwb3J0IHZhciBzdWIgPSBzdWJ0cmFjdDsiLCJpbXBvcnQgKiBhcyBnbE1hdHJpeCBmcm9tIFwiLi9jb21tb24uanNcIjtcclxuXHJcbi8qKlxyXG4gKiA0eDQgTWF0cml4PGJyPkZvcm1hdDogY29sdW1uLW1ham9yLCB3aGVuIHR5cGVkIG91dCBpdCBsb29rcyBsaWtlIHJvdy1tYWpvcjxicj5UaGUgbWF0cmljZXMgYXJlIGJlaW5nIHBvc3QgbXVsdGlwbGllZC5cclxuICogQG1vZHVsZSBtYXQ0XHJcbiAqL1xyXG5cclxuLyoqXHJcbiAqIENyZWF0ZXMgYSBuZXcgaWRlbnRpdHkgbWF0NFxyXG4gKlxyXG4gKiBAcmV0dXJucyB7bWF0NH0gYSBuZXcgNHg0IG1hdHJpeFxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZSgpIHtcclxuICB2YXIgb3V0ID0gbmV3IGdsTWF0cml4LkFSUkFZX1RZUEUoMTYpO1xyXG4gIGlmIChnbE1hdHJpeC5BUlJBWV9UWVBFICE9IEZsb2F0MzJBcnJheSkge1xyXG4gICAgb3V0WzFdID0gMDtcclxuICAgIG91dFsyXSA9IDA7XHJcbiAgICBvdXRbM10gPSAwO1xyXG4gICAgb3V0WzRdID0gMDtcclxuICAgIG91dFs2XSA9IDA7XHJcbiAgICBvdXRbN10gPSAwO1xyXG4gICAgb3V0WzhdID0gMDtcclxuICAgIG91dFs5XSA9IDA7XHJcbiAgICBvdXRbMTFdID0gMDtcclxuICAgIG91dFsxMl0gPSAwO1xyXG4gICAgb3V0WzEzXSA9IDA7XHJcbiAgICBvdXRbMTRdID0gMDtcclxuICB9XHJcbiAgb3V0WzBdID0gMTtcclxuICBvdXRbNV0gPSAxO1xyXG4gIG91dFsxMF0gPSAxO1xyXG4gIG91dFsxNV0gPSAxO1xyXG4gIHJldHVybiBvdXQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDcmVhdGVzIGEgbmV3IG1hdDQgaW5pdGlhbGl6ZWQgd2l0aCB2YWx1ZXMgZnJvbSBhbiBleGlzdGluZyBtYXRyaXhcclxuICpcclxuICogQHBhcmFtIHttYXQ0fSBhIG1hdHJpeCB0byBjbG9uZVxyXG4gKiBAcmV0dXJucyB7bWF0NH0gYSBuZXcgNHg0IG1hdHJpeFxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGNsb25lKGEpIHtcclxuICB2YXIgb3V0ID0gbmV3IGdsTWF0cml4LkFSUkFZX1RZUEUoMTYpO1xyXG4gIG91dFswXSA9IGFbMF07XHJcbiAgb3V0WzFdID0gYVsxXTtcclxuICBvdXRbMl0gPSBhWzJdO1xyXG4gIG91dFszXSA9IGFbM107XHJcbiAgb3V0WzRdID0gYVs0XTtcclxuICBvdXRbNV0gPSBhWzVdO1xyXG4gIG91dFs2XSA9IGFbNl07XHJcbiAgb3V0WzddID0gYVs3XTtcclxuICBvdXRbOF0gPSBhWzhdO1xyXG4gIG91dFs5XSA9IGFbOV07XHJcbiAgb3V0WzEwXSA9IGFbMTBdO1xyXG4gIG91dFsxMV0gPSBhWzExXTtcclxuICBvdXRbMTJdID0gYVsxMl07XHJcbiAgb3V0WzEzXSA9IGFbMTNdO1xyXG4gIG91dFsxNF0gPSBhWzE0XTtcclxuICBvdXRbMTVdID0gYVsxNV07XHJcbiAgcmV0dXJuIG91dDtcclxufVxyXG5cclxuLyoqXHJcbiAqIENvcHkgdGhlIHZhbHVlcyBmcm9tIG9uZSBtYXQ0IHRvIGFub3RoZXJcclxuICpcclxuICogQHBhcmFtIHttYXQ0fSBvdXQgdGhlIHJlY2VpdmluZyBtYXRyaXhcclxuICogQHBhcmFtIHttYXQ0fSBhIHRoZSBzb3VyY2UgbWF0cml4XHJcbiAqIEByZXR1cm5zIHttYXQ0fSBvdXRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBjb3B5KG91dCwgYSkge1xyXG4gIG91dFswXSA9IGFbMF07XHJcbiAgb3V0WzFdID0gYVsxXTtcclxuICBvdXRbMl0gPSBhWzJdO1xyXG4gIG91dFszXSA9IGFbM107XHJcbiAgb3V0WzRdID0gYVs0XTtcclxuICBvdXRbNV0gPSBhWzVdO1xyXG4gIG91dFs2XSA9IGFbNl07XHJcbiAgb3V0WzddID0gYVs3XTtcclxuICBvdXRbOF0gPSBhWzhdO1xyXG4gIG91dFs5XSA9IGFbOV07XHJcbiAgb3V0WzEwXSA9IGFbMTBdO1xyXG4gIG91dFsxMV0gPSBhWzExXTtcclxuICBvdXRbMTJdID0gYVsxMl07XHJcbiAgb3V0WzEzXSA9IGFbMTNdO1xyXG4gIG91dFsxNF0gPSBhWzE0XTtcclxuICBvdXRbMTVdID0gYVsxNV07XHJcbiAgcmV0dXJuIG91dDtcclxufVxyXG5cclxuLyoqXHJcbiAqIENyZWF0ZSBhIG5ldyBtYXQ0IHdpdGggdGhlIGdpdmVuIHZhbHVlc1xyXG4gKlxyXG4gKiBAcGFyYW0ge051bWJlcn0gbTAwIENvbXBvbmVudCBpbiBjb2x1bW4gMCwgcm93IDAgcG9zaXRpb24gKGluZGV4IDApXHJcbiAqIEBwYXJhbSB7TnVtYmVyfSBtMDEgQ29tcG9uZW50IGluIGNvbHVtbiAwLCByb3cgMSBwb3NpdGlvbiAoaW5kZXggMSlcclxuICogQHBhcmFtIHtOdW1iZXJ9IG0wMiBDb21wb25lbnQgaW4gY29sdW1uIDAsIHJvdyAyIHBvc2l0aW9uIChpbmRleCAyKVxyXG4gKiBAcGFyYW0ge051bWJlcn0gbTAzIENvbXBvbmVudCBpbiBjb2x1bW4gMCwgcm93IDMgcG9zaXRpb24gKGluZGV4IDMpXHJcbiAqIEBwYXJhbSB7TnVtYmVyfSBtMTAgQ29tcG9uZW50IGluIGNvbHVtbiAxLCByb3cgMCBwb3NpdGlvbiAoaW5kZXggNClcclxuICogQHBhcmFtIHtOdW1iZXJ9IG0xMSBDb21wb25lbnQgaW4gY29sdW1uIDEsIHJvdyAxIHBvc2l0aW9uIChpbmRleCA1KVxyXG4gKiBAcGFyYW0ge051bWJlcn0gbTEyIENvbXBvbmVudCBpbiBjb2x1bW4gMSwgcm93IDIgcG9zaXRpb24gKGluZGV4IDYpXHJcbiAqIEBwYXJhbSB7TnVtYmVyfSBtMTMgQ29tcG9uZW50IGluIGNvbHVtbiAxLCByb3cgMyBwb3NpdGlvbiAoaW5kZXggNylcclxuICogQHBhcmFtIHtOdW1iZXJ9IG0yMCBDb21wb25lbnQgaW4gY29sdW1uIDIsIHJvdyAwIHBvc2l0aW9uIChpbmRleCA4KVxyXG4gKiBAcGFyYW0ge051bWJlcn0gbTIxIENvbXBvbmVudCBpbiBjb2x1bW4gMiwgcm93IDEgcG9zaXRpb24gKGluZGV4IDkpXHJcbiAqIEBwYXJhbSB7TnVtYmVyfSBtMjIgQ29tcG9uZW50IGluIGNvbHVtbiAyLCByb3cgMiBwb3NpdGlvbiAoaW5kZXggMTApXHJcbiAqIEBwYXJhbSB7TnVtYmVyfSBtMjMgQ29tcG9uZW50IGluIGNvbHVtbiAyLCByb3cgMyBwb3NpdGlvbiAoaW5kZXggMTEpXHJcbiAqIEBwYXJhbSB7TnVtYmVyfSBtMzAgQ29tcG9uZW50IGluIGNvbHVtbiAzLCByb3cgMCBwb3NpdGlvbiAoaW5kZXggMTIpXHJcbiAqIEBwYXJhbSB7TnVtYmVyfSBtMzEgQ29tcG9uZW50IGluIGNvbHVtbiAzLCByb3cgMSBwb3NpdGlvbiAoaW5kZXggMTMpXHJcbiAqIEBwYXJhbSB7TnVtYmVyfSBtMzIgQ29tcG9uZW50IGluIGNvbHVtbiAzLCByb3cgMiBwb3NpdGlvbiAoaW5kZXggMTQpXHJcbiAqIEBwYXJhbSB7TnVtYmVyfSBtMzMgQ29tcG9uZW50IGluIGNvbHVtbiAzLCByb3cgMyBwb3NpdGlvbiAoaW5kZXggMTUpXHJcbiAqIEByZXR1cm5zIHttYXQ0fSBBIG5ldyBtYXQ0XHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gZnJvbVZhbHVlcyhtMDAsIG0wMSwgbTAyLCBtMDMsIG0xMCwgbTExLCBtMTIsIG0xMywgbTIwLCBtMjEsIG0yMiwgbTIzLCBtMzAsIG0zMSwgbTMyLCBtMzMpIHtcclxuICB2YXIgb3V0ID0gbmV3IGdsTWF0cml4LkFSUkFZX1RZUEUoMTYpO1xyXG4gIG91dFswXSA9IG0wMDtcclxuICBvdXRbMV0gPSBtMDE7XHJcbiAgb3V0WzJdID0gbTAyO1xyXG4gIG91dFszXSA9IG0wMztcclxuICBvdXRbNF0gPSBtMTA7XHJcbiAgb3V0WzVdID0gbTExO1xyXG4gIG91dFs2XSA9IG0xMjtcclxuICBvdXRbN10gPSBtMTM7XHJcbiAgb3V0WzhdID0gbTIwO1xyXG4gIG91dFs5XSA9IG0yMTtcclxuICBvdXRbMTBdID0gbTIyO1xyXG4gIG91dFsxMV0gPSBtMjM7XHJcbiAgb3V0WzEyXSA9IG0zMDtcclxuICBvdXRbMTNdID0gbTMxO1xyXG4gIG91dFsxNF0gPSBtMzI7XHJcbiAgb3V0WzE1XSA9IG0zMztcclxuICByZXR1cm4gb3V0O1xyXG59XHJcblxyXG4vKipcclxuICogU2V0IHRoZSBjb21wb25lbnRzIG9mIGEgbWF0NCB0byB0aGUgZ2l2ZW4gdmFsdWVzXHJcbiAqXHJcbiAqIEBwYXJhbSB7bWF0NH0gb3V0IHRoZSByZWNlaXZpbmcgbWF0cml4XHJcbiAqIEBwYXJhbSB7TnVtYmVyfSBtMDAgQ29tcG9uZW50IGluIGNvbHVtbiAwLCByb3cgMCBwb3NpdGlvbiAoaW5kZXggMClcclxuICogQHBhcmFtIHtOdW1iZXJ9IG0wMSBDb21wb25lbnQgaW4gY29sdW1uIDAsIHJvdyAxIHBvc2l0aW9uIChpbmRleCAxKVxyXG4gKiBAcGFyYW0ge051bWJlcn0gbTAyIENvbXBvbmVudCBpbiBjb2x1bW4gMCwgcm93IDIgcG9zaXRpb24gKGluZGV4IDIpXHJcbiAqIEBwYXJhbSB7TnVtYmVyfSBtMDMgQ29tcG9uZW50IGluIGNvbHVtbiAwLCByb3cgMyBwb3NpdGlvbiAoaW5kZXggMylcclxuICogQHBhcmFtIHtOdW1iZXJ9IG0xMCBDb21wb25lbnQgaW4gY29sdW1uIDEsIHJvdyAwIHBvc2l0aW9uIChpbmRleCA0KVxyXG4gKiBAcGFyYW0ge051bWJlcn0gbTExIENvbXBvbmVudCBpbiBjb2x1bW4gMSwgcm93IDEgcG9zaXRpb24gKGluZGV4IDUpXHJcbiAqIEBwYXJhbSB7TnVtYmVyfSBtMTIgQ29tcG9uZW50IGluIGNvbHVtbiAxLCByb3cgMiBwb3NpdGlvbiAoaW5kZXggNilcclxuICogQHBhcmFtIHtOdW1iZXJ9IG0xMyBDb21wb25lbnQgaW4gY29sdW1uIDEsIHJvdyAzIHBvc2l0aW9uIChpbmRleCA3KVxyXG4gKiBAcGFyYW0ge051bWJlcn0gbTIwIENvbXBvbmVudCBpbiBjb2x1bW4gMiwgcm93IDAgcG9zaXRpb24gKGluZGV4IDgpXHJcbiAqIEBwYXJhbSB7TnVtYmVyfSBtMjEgQ29tcG9uZW50IGluIGNvbHVtbiAyLCByb3cgMSBwb3NpdGlvbiAoaW5kZXggOSlcclxuICogQHBhcmFtIHtOdW1iZXJ9IG0yMiBDb21wb25lbnQgaW4gY29sdW1uIDIsIHJvdyAyIHBvc2l0aW9uIChpbmRleCAxMClcclxuICogQHBhcmFtIHtOdW1iZXJ9IG0yMyBDb21wb25lbnQgaW4gY29sdW1uIDIsIHJvdyAzIHBvc2l0aW9uIChpbmRleCAxMSlcclxuICogQHBhcmFtIHtOdW1iZXJ9IG0zMCBDb21wb25lbnQgaW4gY29sdW1uIDMsIHJvdyAwIHBvc2l0aW9uIChpbmRleCAxMilcclxuICogQHBhcmFtIHtOdW1iZXJ9IG0zMSBDb21wb25lbnQgaW4gY29sdW1uIDMsIHJvdyAxIHBvc2l0aW9uIChpbmRleCAxMylcclxuICogQHBhcmFtIHtOdW1iZXJ9IG0zMiBDb21wb25lbnQgaW4gY29sdW1uIDMsIHJvdyAyIHBvc2l0aW9uIChpbmRleCAxNClcclxuICogQHBhcmFtIHtOdW1iZXJ9IG0zMyBDb21wb25lbnQgaW4gY29sdW1uIDMsIHJvdyAzIHBvc2l0aW9uIChpbmRleCAxNSlcclxuICogQHJldHVybnMge21hdDR9IG91dFxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIHNldChvdXQsIG0wMCwgbTAxLCBtMDIsIG0wMywgbTEwLCBtMTEsIG0xMiwgbTEzLCBtMjAsIG0yMSwgbTIyLCBtMjMsIG0zMCwgbTMxLCBtMzIsIG0zMykge1xyXG4gIG91dFswXSA9IG0wMDtcclxuICBvdXRbMV0gPSBtMDE7XHJcbiAgb3V0WzJdID0gbTAyO1xyXG4gIG91dFszXSA9IG0wMztcclxuICBvdXRbNF0gPSBtMTA7XHJcbiAgb3V0WzVdID0gbTExO1xyXG4gIG91dFs2XSA9IG0xMjtcclxuICBvdXRbN10gPSBtMTM7XHJcbiAgb3V0WzhdID0gbTIwO1xyXG4gIG91dFs5XSA9IG0yMTtcclxuICBvdXRbMTBdID0gbTIyO1xyXG4gIG91dFsxMV0gPSBtMjM7XHJcbiAgb3V0WzEyXSA9IG0zMDtcclxuICBvdXRbMTNdID0gbTMxO1xyXG4gIG91dFsxNF0gPSBtMzI7XHJcbiAgb3V0WzE1XSA9IG0zMztcclxuICByZXR1cm4gb3V0O1xyXG59XHJcblxyXG4vKipcclxuICogU2V0IGEgbWF0NCB0byB0aGUgaWRlbnRpdHkgbWF0cml4XHJcbiAqXHJcbiAqIEBwYXJhbSB7bWF0NH0gb3V0IHRoZSByZWNlaXZpbmcgbWF0cml4XHJcbiAqIEByZXR1cm5zIHttYXQ0fSBvdXRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBpZGVudGl0eShvdXQpIHtcclxuICBvdXRbMF0gPSAxO1xyXG4gIG91dFsxXSA9IDA7XHJcbiAgb3V0WzJdID0gMDtcclxuICBvdXRbM10gPSAwO1xyXG4gIG91dFs0XSA9IDA7XHJcbiAgb3V0WzVdID0gMTtcclxuICBvdXRbNl0gPSAwO1xyXG4gIG91dFs3XSA9IDA7XHJcbiAgb3V0WzhdID0gMDtcclxuICBvdXRbOV0gPSAwO1xyXG4gIG91dFsxMF0gPSAxO1xyXG4gIG91dFsxMV0gPSAwO1xyXG4gIG91dFsxMl0gPSAwO1xyXG4gIG91dFsxM10gPSAwO1xyXG4gIG91dFsxNF0gPSAwO1xyXG4gIG91dFsxNV0gPSAxO1xyXG4gIHJldHVybiBvdXQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBUcmFuc3Bvc2UgdGhlIHZhbHVlcyBvZiBhIG1hdDRcclxuICpcclxuICogQHBhcmFtIHttYXQ0fSBvdXQgdGhlIHJlY2VpdmluZyBtYXRyaXhcclxuICogQHBhcmFtIHttYXQ0fSBhIHRoZSBzb3VyY2UgbWF0cml4XHJcbiAqIEByZXR1cm5zIHttYXQ0fSBvdXRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiB0cmFuc3Bvc2Uob3V0LCBhKSB7XHJcbiAgLy8gSWYgd2UgYXJlIHRyYW5zcG9zaW5nIG91cnNlbHZlcyB3ZSBjYW4gc2tpcCBhIGZldyBzdGVwcyBidXQgaGF2ZSB0byBjYWNoZSBzb21lIHZhbHVlc1xyXG4gIGlmIChvdXQgPT09IGEpIHtcclxuICAgIHZhciBhMDEgPSBhWzFdLFxyXG4gICAgICAgIGEwMiA9IGFbMl0sXHJcbiAgICAgICAgYTAzID0gYVszXTtcclxuICAgIHZhciBhMTIgPSBhWzZdLFxyXG4gICAgICAgIGExMyA9IGFbN107XHJcbiAgICB2YXIgYTIzID0gYVsxMV07XHJcblxyXG4gICAgb3V0WzFdID0gYVs0XTtcclxuICAgIG91dFsyXSA9IGFbOF07XHJcbiAgICBvdXRbM10gPSBhWzEyXTtcclxuICAgIG91dFs0XSA9IGEwMTtcclxuICAgIG91dFs2XSA9IGFbOV07XHJcbiAgICBvdXRbN10gPSBhWzEzXTtcclxuICAgIG91dFs4XSA9IGEwMjtcclxuICAgIG91dFs5XSA9IGExMjtcclxuICAgIG91dFsxMV0gPSBhWzE0XTtcclxuICAgIG91dFsxMl0gPSBhMDM7XHJcbiAgICBvdXRbMTNdID0gYTEzO1xyXG4gICAgb3V0WzE0XSA9IGEyMztcclxuICB9IGVsc2Uge1xyXG4gICAgb3V0WzBdID0gYVswXTtcclxuICAgIG91dFsxXSA9IGFbNF07XHJcbiAgICBvdXRbMl0gPSBhWzhdO1xyXG4gICAgb3V0WzNdID0gYVsxMl07XHJcbiAgICBvdXRbNF0gPSBhWzFdO1xyXG4gICAgb3V0WzVdID0gYVs1XTtcclxuICAgIG91dFs2XSA9IGFbOV07XHJcbiAgICBvdXRbN10gPSBhWzEzXTtcclxuICAgIG91dFs4XSA9IGFbMl07XHJcbiAgICBvdXRbOV0gPSBhWzZdO1xyXG4gICAgb3V0WzEwXSA9IGFbMTBdO1xyXG4gICAgb3V0WzExXSA9IGFbMTRdO1xyXG4gICAgb3V0WzEyXSA9IGFbM107XHJcbiAgICBvdXRbMTNdID0gYVs3XTtcclxuICAgIG91dFsxNF0gPSBhWzExXTtcclxuICAgIG91dFsxNV0gPSBhWzE1XTtcclxuICB9XHJcblxyXG4gIHJldHVybiBvdXQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBJbnZlcnRzIGEgbWF0NFxyXG4gKlxyXG4gKiBAcGFyYW0ge21hdDR9IG91dCB0aGUgcmVjZWl2aW5nIG1hdHJpeFxyXG4gKiBAcGFyYW0ge21hdDR9IGEgdGhlIHNvdXJjZSBtYXRyaXhcclxuICogQHJldHVybnMge21hdDR9IG91dFxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGludmVydChvdXQsIGEpIHtcclxuICB2YXIgYTAwID0gYVswXSxcclxuICAgICAgYTAxID0gYVsxXSxcclxuICAgICAgYTAyID0gYVsyXSxcclxuICAgICAgYTAzID0gYVszXTtcclxuICB2YXIgYTEwID0gYVs0XSxcclxuICAgICAgYTExID0gYVs1XSxcclxuICAgICAgYTEyID0gYVs2XSxcclxuICAgICAgYTEzID0gYVs3XTtcclxuICB2YXIgYTIwID0gYVs4XSxcclxuICAgICAgYTIxID0gYVs5XSxcclxuICAgICAgYTIyID0gYVsxMF0sXHJcbiAgICAgIGEyMyA9IGFbMTFdO1xyXG4gIHZhciBhMzAgPSBhWzEyXSxcclxuICAgICAgYTMxID0gYVsxM10sXHJcbiAgICAgIGEzMiA9IGFbMTRdLFxyXG4gICAgICBhMzMgPSBhWzE1XTtcclxuXHJcbiAgdmFyIGIwMCA9IGEwMCAqIGExMSAtIGEwMSAqIGExMDtcclxuICB2YXIgYjAxID0gYTAwICogYTEyIC0gYTAyICogYTEwO1xyXG4gIHZhciBiMDIgPSBhMDAgKiBhMTMgLSBhMDMgKiBhMTA7XHJcbiAgdmFyIGIwMyA9IGEwMSAqIGExMiAtIGEwMiAqIGExMTtcclxuICB2YXIgYjA0ID0gYTAxICogYTEzIC0gYTAzICogYTExO1xyXG4gIHZhciBiMDUgPSBhMDIgKiBhMTMgLSBhMDMgKiBhMTI7XHJcbiAgdmFyIGIwNiA9IGEyMCAqIGEzMSAtIGEyMSAqIGEzMDtcclxuICB2YXIgYjA3ID0gYTIwICogYTMyIC0gYTIyICogYTMwO1xyXG4gIHZhciBiMDggPSBhMjAgKiBhMzMgLSBhMjMgKiBhMzA7XHJcbiAgdmFyIGIwOSA9IGEyMSAqIGEzMiAtIGEyMiAqIGEzMTtcclxuICB2YXIgYjEwID0gYTIxICogYTMzIC0gYTIzICogYTMxO1xyXG4gIHZhciBiMTEgPSBhMjIgKiBhMzMgLSBhMjMgKiBhMzI7XHJcblxyXG4gIC8vIENhbGN1bGF0ZSB0aGUgZGV0ZXJtaW5hbnRcclxuICB2YXIgZGV0ID0gYjAwICogYjExIC0gYjAxICogYjEwICsgYjAyICogYjA5ICsgYjAzICogYjA4IC0gYjA0ICogYjA3ICsgYjA1ICogYjA2O1xyXG5cclxuICBpZiAoIWRldCkge1xyXG4gICAgcmV0dXJuIG51bGw7XHJcbiAgfVxyXG4gIGRldCA9IDEuMCAvIGRldDtcclxuXHJcbiAgb3V0WzBdID0gKGExMSAqIGIxMSAtIGExMiAqIGIxMCArIGExMyAqIGIwOSkgKiBkZXQ7XHJcbiAgb3V0WzFdID0gKGEwMiAqIGIxMCAtIGEwMSAqIGIxMSAtIGEwMyAqIGIwOSkgKiBkZXQ7XHJcbiAgb3V0WzJdID0gKGEzMSAqIGIwNSAtIGEzMiAqIGIwNCArIGEzMyAqIGIwMykgKiBkZXQ7XHJcbiAgb3V0WzNdID0gKGEyMiAqIGIwNCAtIGEyMSAqIGIwNSAtIGEyMyAqIGIwMykgKiBkZXQ7XHJcbiAgb3V0WzRdID0gKGExMiAqIGIwOCAtIGExMCAqIGIxMSAtIGExMyAqIGIwNykgKiBkZXQ7XHJcbiAgb3V0WzVdID0gKGEwMCAqIGIxMSAtIGEwMiAqIGIwOCArIGEwMyAqIGIwNykgKiBkZXQ7XHJcbiAgb3V0WzZdID0gKGEzMiAqIGIwMiAtIGEzMCAqIGIwNSAtIGEzMyAqIGIwMSkgKiBkZXQ7XHJcbiAgb3V0WzddID0gKGEyMCAqIGIwNSAtIGEyMiAqIGIwMiArIGEyMyAqIGIwMSkgKiBkZXQ7XHJcbiAgb3V0WzhdID0gKGExMCAqIGIxMCAtIGExMSAqIGIwOCArIGExMyAqIGIwNikgKiBkZXQ7XHJcbiAgb3V0WzldID0gKGEwMSAqIGIwOCAtIGEwMCAqIGIxMCAtIGEwMyAqIGIwNikgKiBkZXQ7XHJcbiAgb3V0WzEwXSA9IChhMzAgKiBiMDQgLSBhMzEgKiBiMDIgKyBhMzMgKiBiMDApICogZGV0O1xyXG4gIG91dFsxMV0gPSAoYTIxICogYjAyIC0gYTIwICogYjA0IC0gYTIzICogYjAwKSAqIGRldDtcclxuICBvdXRbMTJdID0gKGExMSAqIGIwNyAtIGExMCAqIGIwOSAtIGExMiAqIGIwNikgKiBkZXQ7XHJcbiAgb3V0WzEzXSA9IChhMDAgKiBiMDkgLSBhMDEgKiBiMDcgKyBhMDIgKiBiMDYpICogZGV0O1xyXG4gIG91dFsxNF0gPSAoYTMxICogYjAxIC0gYTMwICogYjAzIC0gYTMyICogYjAwKSAqIGRldDtcclxuICBvdXRbMTVdID0gKGEyMCAqIGIwMyAtIGEyMSAqIGIwMSArIGEyMiAqIGIwMCkgKiBkZXQ7XHJcblxyXG4gIHJldHVybiBvdXQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDYWxjdWxhdGVzIHRoZSBhZGp1Z2F0ZSBvZiBhIG1hdDRcclxuICpcclxuICogQHBhcmFtIHttYXQ0fSBvdXQgdGhlIHJlY2VpdmluZyBtYXRyaXhcclxuICogQHBhcmFtIHttYXQ0fSBhIHRoZSBzb3VyY2UgbWF0cml4XHJcbiAqIEByZXR1cm5zIHttYXQ0fSBvdXRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBhZGpvaW50KG91dCwgYSkge1xyXG4gIHZhciBhMDAgPSBhWzBdLFxyXG4gICAgICBhMDEgPSBhWzFdLFxyXG4gICAgICBhMDIgPSBhWzJdLFxyXG4gICAgICBhMDMgPSBhWzNdO1xyXG4gIHZhciBhMTAgPSBhWzRdLFxyXG4gICAgICBhMTEgPSBhWzVdLFxyXG4gICAgICBhMTIgPSBhWzZdLFxyXG4gICAgICBhMTMgPSBhWzddO1xyXG4gIHZhciBhMjAgPSBhWzhdLFxyXG4gICAgICBhMjEgPSBhWzldLFxyXG4gICAgICBhMjIgPSBhWzEwXSxcclxuICAgICAgYTIzID0gYVsxMV07XHJcbiAgdmFyIGEzMCA9IGFbMTJdLFxyXG4gICAgICBhMzEgPSBhWzEzXSxcclxuICAgICAgYTMyID0gYVsxNF0sXHJcbiAgICAgIGEzMyA9IGFbMTVdO1xyXG5cclxuICBvdXRbMF0gPSBhMTEgKiAoYTIyICogYTMzIC0gYTIzICogYTMyKSAtIGEyMSAqIChhMTIgKiBhMzMgLSBhMTMgKiBhMzIpICsgYTMxICogKGExMiAqIGEyMyAtIGExMyAqIGEyMik7XHJcbiAgb3V0WzFdID0gLShhMDEgKiAoYTIyICogYTMzIC0gYTIzICogYTMyKSAtIGEyMSAqIChhMDIgKiBhMzMgLSBhMDMgKiBhMzIpICsgYTMxICogKGEwMiAqIGEyMyAtIGEwMyAqIGEyMikpO1xyXG4gIG91dFsyXSA9IGEwMSAqIChhMTIgKiBhMzMgLSBhMTMgKiBhMzIpIC0gYTExICogKGEwMiAqIGEzMyAtIGEwMyAqIGEzMikgKyBhMzEgKiAoYTAyICogYTEzIC0gYTAzICogYTEyKTtcclxuICBvdXRbM10gPSAtKGEwMSAqIChhMTIgKiBhMjMgLSBhMTMgKiBhMjIpIC0gYTExICogKGEwMiAqIGEyMyAtIGEwMyAqIGEyMikgKyBhMjEgKiAoYTAyICogYTEzIC0gYTAzICogYTEyKSk7XHJcbiAgb3V0WzRdID0gLShhMTAgKiAoYTIyICogYTMzIC0gYTIzICogYTMyKSAtIGEyMCAqIChhMTIgKiBhMzMgLSBhMTMgKiBhMzIpICsgYTMwICogKGExMiAqIGEyMyAtIGExMyAqIGEyMikpO1xyXG4gIG91dFs1XSA9IGEwMCAqIChhMjIgKiBhMzMgLSBhMjMgKiBhMzIpIC0gYTIwICogKGEwMiAqIGEzMyAtIGEwMyAqIGEzMikgKyBhMzAgKiAoYTAyICogYTIzIC0gYTAzICogYTIyKTtcclxuICBvdXRbNl0gPSAtKGEwMCAqIChhMTIgKiBhMzMgLSBhMTMgKiBhMzIpIC0gYTEwICogKGEwMiAqIGEzMyAtIGEwMyAqIGEzMikgKyBhMzAgKiAoYTAyICogYTEzIC0gYTAzICogYTEyKSk7XHJcbiAgb3V0WzddID0gYTAwICogKGExMiAqIGEyMyAtIGExMyAqIGEyMikgLSBhMTAgKiAoYTAyICogYTIzIC0gYTAzICogYTIyKSArIGEyMCAqIChhMDIgKiBhMTMgLSBhMDMgKiBhMTIpO1xyXG4gIG91dFs4XSA9IGExMCAqIChhMjEgKiBhMzMgLSBhMjMgKiBhMzEpIC0gYTIwICogKGExMSAqIGEzMyAtIGExMyAqIGEzMSkgKyBhMzAgKiAoYTExICogYTIzIC0gYTEzICogYTIxKTtcclxuICBvdXRbOV0gPSAtKGEwMCAqIChhMjEgKiBhMzMgLSBhMjMgKiBhMzEpIC0gYTIwICogKGEwMSAqIGEzMyAtIGEwMyAqIGEzMSkgKyBhMzAgKiAoYTAxICogYTIzIC0gYTAzICogYTIxKSk7XHJcbiAgb3V0WzEwXSA9IGEwMCAqIChhMTEgKiBhMzMgLSBhMTMgKiBhMzEpIC0gYTEwICogKGEwMSAqIGEzMyAtIGEwMyAqIGEzMSkgKyBhMzAgKiAoYTAxICogYTEzIC0gYTAzICogYTExKTtcclxuICBvdXRbMTFdID0gLShhMDAgKiAoYTExICogYTIzIC0gYTEzICogYTIxKSAtIGExMCAqIChhMDEgKiBhMjMgLSBhMDMgKiBhMjEpICsgYTIwICogKGEwMSAqIGExMyAtIGEwMyAqIGExMSkpO1xyXG4gIG91dFsxMl0gPSAtKGExMCAqIChhMjEgKiBhMzIgLSBhMjIgKiBhMzEpIC0gYTIwICogKGExMSAqIGEzMiAtIGExMiAqIGEzMSkgKyBhMzAgKiAoYTExICogYTIyIC0gYTEyICogYTIxKSk7XHJcbiAgb3V0WzEzXSA9IGEwMCAqIChhMjEgKiBhMzIgLSBhMjIgKiBhMzEpIC0gYTIwICogKGEwMSAqIGEzMiAtIGEwMiAqIGEzMSkgKyBhMzAgKiAoYTAxICogYTIyIC0gYTAyICogYTIxKTtcclxuICBvdXRbMTRdID0gLShhMDAgKiAoYTExICogYTMyIC0gYTEyICogYTMxKSAtIGExMCAqIChhMDEgKiBhMzIgLSBhMDIgKiBhMzEpICsgYTMwICogKGEwMSAqIGExMiAtIGEwMiAqIGExMSkpO1xyXG4gIG91dFsxNV0gPSBhMDAgKiAoYTExICogYTIyIC0gYTEyICogYTIxKSAtIGExMCAqIChhMDEgKiBhMjIgLSBhMDIgKiBhMjEpICsgYTIwICogKGEwMSAqIGExMiAtIGEwMiAqIGExMSk7XHJcbiAgcmV0dXJuIG91dDtcclxufVxyXG5cclxuLyoqXHJcbiAqIENhbGN1bGF0ZXMgdGhlIGRldGVybWluYW50IG9mIGEgbWF0NFxyXG4gKlxyXG4gKiBAcGFyYW0ge21hdDR9IGEgdGhlIHNvdXJjZSBtYXRyaXhcclxuICogQHJldHVybnMge051bWJlcn0gZGV0ZXJtaW5hbnQgb2YgYVxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGRldGVybWluYW50KGEpIHtcclxuICB2YXIgYTAwID0gYVswXSxcclxuICAgICAgYTAxID0gYVsxXSxcclxuICAgICAgYTAyID0gYVsyXSxcclxuICAgICAgYTAzID0gYVszXTtcclxuICB2YXIgYTEwID0gYVs0XSxcclxuICAgICAgYTExID0gYVs1XSxcclxuICAgICAgYTEyID0gYVs2XSxcclxuICAgICAgYTEzID0gYVs3XTtcclxuICB2YXIgYTIwID0gYVs4XSxcclxuICAgICAgYTIxID0gYVs5XSxcclxuICAgICAgYTIyID0gYVsxMF0sXHJcbiAgICAgIGEyMyA9IGFbMTFdO1xyXG4gIHZhciBhMzAgPSBhWzEyXSxcclxuICAgICAgYTMxID0gYVsxM10sXHJcbiAgICAgIGEzMiA9IGFbMTRdLFxyXG4gICAgICBhMzMgPSBhWzE1XTtcclxuXHJcbiAgdmFyIGIwMCA9IGEwMCAqIGExMSAtIGEwMSAqIGExMDtcclxuICB2YXIgYjAxID0gYTAwICogYTEyIC0gYTAyICogYTEwO1xyXG4gIHZhciBiMDIgPSBhMDAgKiBhMTMgLSBhMDMgKiBhMTA7XHJcbiAgdmFyIGIwMyA9IGEwMSAqIGExMiAtIGEwMiAqIGExMTtcclxuICB2YXIgYjA0ID0gYTAxICogYTEzIC0gYTAzICogYTExO1xyXG4gIHZhciBiMDUgPSBhMDIgKiBhMTMgLSBhMDMgKiBhMTI7XHJcbiAgdmFyIGIwNiA9IGEyMCAqIGEzMSAtIGEyMSAqIGEzMDtcclxuICB2YXIgYjA3ID0gYTIwICogYTMyIC0gYTIyICogYTMwO1xyXG4gIHZhciBiMDggPSBhMjAgKiBhMzMgLSBhMjMgKiBhMzA7XHJcbiAgdmFyIGIwOSA9IGEyMSAqIGEzMiAtIGEyMiAqIGEzMTtcclxuICB2YXIgYjEwID0gYTIxICogYTMzIC0gYTIzICogYTMxO1xyXG4gIHZhciBiMTEgPSBhMjIgKiBhMzMgLSBhMjMgKiBhMzI7XHJcblxyXG4gIC8vIENhbGN1bGF0ZSB0aGUgZGV0ZXJtaW5hbnRcclxuICByZXR1cm4gYjAwICogYjExIC0gYjAxICogYjEwICsgYjAyICogYjA5ICsgYjAzICogYjA4IC0gYjA0ICogYjA3ICsgYjA1ICogYjA2O1xyXG59XHJcblxyXG4vKipcclxuICogTXVsdGlwbGllcyB0d28gbWF0NHNcclxuICpcclxuICogQHBhcmFtIHttYXQ0fSBvdXQgdGhlIHJlY2VpdmluZyBtYXRyaXhcclxuICogQHBhcmFtIHttYXQ0fSBhIHRoZSBmaXJzdCBvcGVyYW5kXHJcbiAqIEBwYXJhbSB7bWF0NH0gYiB0aGUgc2Vjb25kIG9wZXJhbmRcclxuICogQHJldHVybnMge21hdDR9IG91dFxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIG11bHRpcGx5KG91dCwgYSwgYikge1xyXG4gIHZhciBhMDAgPSBhWzBdLFxyXG4gICAgICBhMDEgPSBhWzFdLFxyXG4gICAgICBhMDIgPSBhWzJdLFxyXG4gICAgICBhMDMgPSBhWzNdO1xyXG4gIHZhciBhMTAgPSBhWzRdLFxyXG4gICAgICBhMTEgPSBhWzVdLFxyXG4gICAgICBhMTIgPSBhWzZdLFxyXG4gICAgICBhMTMgPSBhWzddO1xyXG4gIHZhciBhMjAgPSBhWzhdLFxyXG4gICAgICBhMjEgPSBhWzldLFxyXG4gICAgICBhMjIgPSBhWzEwXSxcclxuICAgICAgYTIzID0gYVsxMV07XHJcbiAgdmFyIGEzMCA9IGFbMTJdLFxyXG4gICAgICBhMzEgPSBhWzEzXSxcclxuICAgICAgYTMyID0gYVsxNF0sXHJcbiAgICAgIGEzMyA9IGFbMTVdO1xyXG5cclxuICAvLyBDYWNoZSBvbmx5IHRoZSBjdXJyZW50IGxpbmUgb2YgdGhlIHNlY29uZCBtYXRyaXhcclxuICB2YXIgYjAgPSBiWzBdLFxyXG4gICAgICBiMSA9IGJbMV0sXHJcbiAgICAgIGIyID0gYlsyXSxcclxuICAgICAgYjMgPSBiWzNdO1xyXG4gIG91dFswXSA9IGIwICogYTAwICsgYjEgKiBhMTAgKyBiMiAqIGEyMCArIGIzICogYTMwO1xyXG4gIG91dFsxXSA9IGIwICogYTAxICsgYjEgKiBhMTEgKyBiMiAqIGEyMSArIGIzICogYTMxO1xyXG4gIG91dFsyXSA9IGIwICogYTAyICsgYjEgKiBhMTIgKyBiMiAqIGEyMiArIGIzICogYTMyO1xyXG4gIG91dFszXSA9IGIwICogYTAzICsgYjEgKiBhMTMgKyBiMiAqIGEyMyArIGIzICogYTMzO1xyXG5cclxuICBiMCA9IGJbNF07YjEgPSBiWzVdO2IyID0gYls2XTtiMyA9IGJbN107XHJcbiAgb3V0WzRdID0gYjAgKiBhMDAgKyBiMSAqIGExMCArIGIyICogYTIwICsgYjMgKiBhMzA7XHJcbiAgb3V0WzVdID0gYjAgKiBhMDEgKyBiMSAqIGExMSArIGIyICogYTIxICsgYjMgKiBhMzE7XHJcbiAgb3V0WzZdID0gYjAgKiBhMDIgKyBiMSAqIGExMiArIGIyICogYTIyICsgYjMgKiBhMzI7XHJcbiAgb3V0WzddID0gYjAgKiBhMDMgKyBiMSAqIGExMyArIGIyICogYTIzICsgYjMgKiBhMzM7XHJcblxyXG4gIGIwID0gYls4XTtiMSA9IGJbOV07YjIgPSBiWzEwXTtiMyA9IGJbMTFdO1xyXG4gIG91dFs4XSA9IGIwICogYTAwICsgYjEgKiBhMTAgKyBiMiAqIGEyMCArIGIzICogYTMwO1xyXG4gIG91dFs5XSA9IGIwICogYTAxICsgYjEgKiBhMTEgKyBiMiAqIGEyMSArIGIzICogYTMxO1xyXG4gIG91dFsxMF0gPSBiMCAqIGEwMiArIGIxICogYTEyICsgYjIgKiBhMjIgKyBiMyAqIGEzMjtcclxuICBvdXRbMTFdID0gYjAgKiBhMDMgKyBiMSAqIGExMyArIGIyICogYTIzICsgYjMgKiBhMzM7XHJcblxyXG4gIGIwID0gYlsxMl07YjEgPSBiWzEzXTtiMiA9IGJbMTRdO2IzID0gYlsxNV07XHJcbiAgb3V0WzEyXSA9IGIwICogYTAwICsgYjEgKiBhMTAgKyBiMiAqIGEyMCArIGIzICogYTMwO1xyXG4gIG91dFsxM10gPSBiMCAqIGEwMSArIGIxICogYTExICsgYjIgKiBhMjEgKyBiMyAqIGEzMTtcclxuICBvdXRbMTRdID0gYjAgKiBhMDIgKyBiMSAqIGExMiArIGIyICogYTIyICsgYjMgKiBhMzI7XHJcbiAgb3V0WzE1XSA9IGIwICogYTAzICsgYjEgKiBhMTMgKyBiMiAqIGEyMyArIGIzICogYTMzO1xyXG4gIHJldHVybiBvdXQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBUcmFuc2xhdGUgYSBtYXQ0IGJ5IHRoZSBnaXZlbiB2ZWN0b3JcclxuICpcclxuICogQHBhcmFtIHttYXQ0fSBvdXQgdGhlIHJlY2VpdmluZyBtYXRyaXhcclxuICogQHBhcmFtIHttYXQ0fSBhIHRoZSBtYXRyaXggdG8gdHJhbnNsYXRlXHJcbiAqIEBwYXJhbSB7dmVjM30gdiB2ZWN0b3IgdG8gdHJhbnNsYXRlIGJ5XHJcbiAqIEByZXR1cm5zIHttYXQ0fSBvdXRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiB0cmFuc2xhdGUob3V0LCBhLCB2KSB7XHJcbiAgdmFyIHggPSB2WzBdLFxyXG4gICAgICB5ID0gdlsxXSxcclxuICAgICAgeiA9IHZbMl07XHJcbiAgdmFyIGEwMCA9IHZvaWQgMCxcclxuICAgICAgYTAxID0gdm9pZCAwLFxyXG4gICAgICBhMDIgPSB2b2lkIDAsXHJcbiAgICAgIGEwMyA9IHZvaWQgMDtcclxuICB2YXIgYTEwID0gdm9pZCAwLFxyXG4gICAgICBhMTEgPSB2b2lkIDAsXHJcbiAgICAgIGExMiA9IHZvaWQgMCxcclxuICAgICAgYTEzID0gdm9pZCAwO1xyXG4gIHZhciBhMjAgPSB2b2lkIDAsXHJcbiAgICAgIGEyMSA9IHZvaWQgMCxcclxuICAgICAgYTIyID0gdm9pZCAwLFxyXG4gICAgICBhMjMgPSB2b2lkIDA7XHJcblxyXG4gIGlmIChhID09PSBvdXQpIHtcclxuICAgIG91dFsxMl0gPSBhWzBdICogeCArIGFbNF0gKiB5ICsgYVs4XSAqIHogKyBhWzEyXTtcclxuICAgIG91dFsxM10gPSBhWzFdICogeCArIGFbNV0gKiB5ICsgYVs5XSAqIHogKyBhWzEzXTtcclxuICAgIG91dFsxNF0gPSBhWzJdICogeCArIGFbNl0gKiB5ICsgYVsxMF0gKiB6ICsgYVsxNF07XHJcbiAgICBvdXRbMTVdID0gYVszXSAqIHggKyBhWzddICogeSArIGFbMTFdICogeiArIGFbMTVdO1xyXG4gIH0gZWxzZSB7XHJcbiAgICBhMDAgPSBhWzBdO2EwMSA9IGFbMV07YTAyID0gYVsyXTthMDMgPSBhWzNdO1xyXG4gICAgYTEwID0gYVs0XTthMTEgPSBhWzVdO2ExMiA9IGFbNl07YTEzID0gYVs3XTtcclxuICAgIGEyMCA9IGFbOF07YTIxID0gYVs5XTthMjIgPSBhWzEwXTthMjMgPSBhWzExXTtcclxuXHJcbiAgICBvdXRbMF0gPSBhMDA7b3V0WzFdID0gYTAxO291dFsyXSA9IGEwMjtvdXRbM10gPSBhMDM7XHJcbiAgICBvdXRbNF0gPSBhMTA7b3V0WzVdID0gYTExO291dFs2XSA9IGExMjtvdXRbN10gPSBhMTM7XHJcbiAgICBvdXRbOF0gPSBhMjA7b3V0WzldID0gYTIxO291dFsxMF0gPSBhMjI7b3V0WzExXSA9IGEyMztcclxuXHJcbiAgICBvdXRbMTJdID0gYTAwICogeCArIGExMCAqIHkgKyBhMjAgKiB6ICsgYVsxMl07XHJcbiAgICBvdXRbMTNdID0gYTAxICogeCArIGExMSAqIHkgKyBhMjEgKiB6ICsgYVsxM107XHJcbiAgICBvdXRbMTRdID0gYTAyICogeCArIGExMiAqIHkgKyBhMjIgKiB6ICsgYVsxNF07XHJcbiAgICBvdXRbMTVdID0gYTAzICogeCArIGExMyAqIHkgKyBhMjMgKiB6ICsgYVsxNV07XHJcbiAgfVxyXG5cclxuICByZXR1cm4gb3V0O1xyXG59XHJcblxyXG4vKipcclxuICogU2NhbGVzIHRoZSBtYXQ0IGJ5IHRoZSBkaW1lbnNpb25zIGluIHRoZSBnaXZlbiB2ZWMzIG5vdCB1c2luZyB2ZWN0b3JpemF0aW9uXHJcbiAqXHJcbiAqIEBwYXJhbSB7bWF0NH0gb3V0IHRoZSByZWNlaXZpbmcgbWF0cml4XHJcbiAqIEBwYXJhbSB7bWF0NH0gYSB0aGUgbWF0cml4IHRvIHNjYWxlXHJcbiAqIEBwYXJhbSB7dmVjM30gdiB0aGUgdmVjMyB0byBzY2FsZSB0aGUgbWF0cml4IGJ5XHJcbiAqIEByZXR1cm5zIHttYXQ0fSBvdXRcclxuICoqL1xyXG5leHBvcnQgZnVuY3Rpb24gc2NhbGUob3V0LCBhLCB2KSB7XHJcbiAgdmFyIHggPSB2WzBdLFxyXG4gICAgICB5ID0gdlsxXSxcclxuICAgICAgeiA9IHZbMl07XHJcblxyXG4gIG91dFswXSA9IGFbMF0gKiB4O1xyXG4gIG91dFsxXSA9IGFbMV0gKiB4O1xyXG4gIG91dFsyXSA9IGFbMl0gKiB4O1xyXG4gIG91dFszXSA9IGFbM10gKiB4O1xyXG4gIG91dFs0XSA9IGFbNF0gKiB5O1xyXG4gIG91dFs1XSA9IGFbNV0gKiB5O1xyXG4gIG91dFs2XSA9IGFbNl0gKiB5O1xyXG4gIG91dFs3XSA9IGFbN10gKiB5O1xyXG4gIG91dFs4XSA9IGFbOF0gKiB6O1xyXG4gIG91dFs5XSA9IGFbOV0gKiB6O1xyXG4gIG91dFsxMF0gPSBhWzEwXSAqIHo7XHJcbiAgb3V0WzExXSA9IGFbMTFdICogejtcclxuICBvdXRbMTJdID0gYVsxMl07XHJcbiAgb3V0WzEzXSA9IGFbMTNdO1xyXG4gIG91dFsxNF0gPSBhWzE0XTtcclxuICBvdXRbMTVdID0gYVsxNV07XHJcbiAgcmV0dXJuIG91dDtcclxufVxyXG5cclxuLyoqXHJcbiAqIFJvdGF0ZXMgYSBtYXQ0IGJ5IHRoZSBnaXZlbiBhbmdsZSBhcm91bmQgdGhlIGdpdmVuIGF4aXNcclxuICpcclxuICogQHBhcmFtIHttYXQ0fSBvdXQgdGhlIHJlY2VpdmluZyBtYXRyaXhcclxuICogQHBhcmFtIHttYXQ0fSBhIHRoZSBtYXRyaXggdG8gcm90YXRlXHJcbiAqIEBwYXJhbSB7TnVtYmVyfSByYWQgdGhlIGFuZ2xlIHRvIHJvdGF0ZSB0aGUgbWF0cml4IGJ5XHJcbiAqIEBwYXJhbSB7dmVjM30gYXhpcyB0aGUgYXhpcyB0byByb3RhdGUgYXJvdW5kXHJcbiAqIEByZXR1cm5zIHttYXQ0fSBvdXRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiByb3RhdGUob3V0LCBhLCByYWQsIGF4aXMpIHtcclxuICB2YXIgeCA9IGF4aXNbMF0sXHJcbiAgICAgIHkgPSBheGlzWzFdLFxyXG4gICAgICB6ID0gYXhpc1syXTtcclxuICB2YXIgbGVuID0gTWF0aC5zcXJ0KHggKiB4ICsgeSAqIHkgKyB6ICogeik7XHJcbiAgdmFyIHMgPSB2b2lkIDAsXHJcbiAgICAgIGMgPSB2b2lkIDAsXHJcbiAgICAgIHQgPSB2b2lkIDA7XHJcbiAgdmFyIGEwMCA9IHZvaWQgMCxcclxuICAgICAgYTAxID0gdm9pZCAwLFxyXG4gICAgICBhMDIgPSB2b2lkIDAsXHJcbiAgICAgIGEwMyA9IHZvaWQgMDtcclxuICB2YXIgYTEwID0gdm9pZCAwLFxyXG4gICAgICBhMTEgPSB2b2lkIDAsXHJcbiAgICAgIGExMiA9IHZvaWQgMCxcclxuICAgICAgYTEzID0gdm9pZCAwO1xyXG4gIHZhciBhMjAgPSB2b2lkIDAsXHJcbiAgICAgIGEyMSA9IHZvaWQgMCxcclxuICAgICAgYTIyID0gdm9pZCAwLFxyXG4gICAgICBhMjMgPSB2b2lkIDA7XHJcbiAgdmFyIGIwMCA9IHZvaWQgMCxcclxuICAgICAgYjAxID0gdm9pZCAwLFxyXG4gICAgICBiMDIgPSB2b2lkIDA7XHJcbiAgdmFyIGIxMCA9IHZvaWQgMCxcclxuICAgICAgYjExID0gdm9pZCAwLFxyXG4gICAgICBiMTIgPSB2b2lkIDA7XHJcbiAgdmFyIGIyMCA9IHZvaWQgMCxcclxuICAgICAgYjIxID0gdm9pZCAwLFxyXG4gICAgICBiMjIgPSB2b2lkIDA7XHJcblxyXG4gIGlmIChsZW4gPCBnbE1hdHJpeC5FUFNJTE9OKSB7XHJcbiAgICByZXR1cm4gbnVsbDtcclxuICB9XHJcblxyXG4gIGxlbiA9IDEgLyBsZW47XHJcbiAgeCAqPSBsZW47XHJcbiAgeSAqPSBsZW47XHJcbiAgeiAqPSBsZW47XHJcblxyXG4gIHMgPSBNYXRoLnNpbihyYWQpO1xyXG4gIGMgPSBNYXRoLmNvcyhyYWQpO1xyXG4gIHQgPSAxIC0gYztcclxuXHJcbiAgYTAwID0gYVswXTthMDEgPSBhWzFdO2EwMiA9IGFbMl07YTAzID0gYVszXTtcclxuICBhMTAgPSBhWzRdO2ExMSA9IGFbNV07YTEyID0gYVs2XTthMTMgPSBhWzddO1xyXG4gIGEyMCA9IGFbOF07YTIxID0gYVs5XTthMjIgPSBhWzEwXTthMjMgPSBhWzExXTtcclxuXHJcbiAgLy8gQ29uc3RydWN0IHRoZSBlbGVtZW50cyBvZiB0aGUgcm90YXRpb24gbWF0cml4XHJcbiAgYjAwID0geCAqIHggKiB0ICsgYztiMDEgPSB5ICogeCAqIHQgKyB6ICogcztiMDIgPSB6ICogeCAqIHQgLSB5ICogcztcclxuICBiMTAgPSB4ICogeSAqIHQgLSB6ICogcztiMTEgPSB5ICogeSAqIHQgKyBjO2IxMiA9IHogKiB5ICogdCArIHggKiBzO1xyXG4gIGIyMCA9IHggKiB6ICogdCArIHkgKiBzO2IyMSA9IHkgKiB6ICogdCAtIHggKiBzO2IyMiA9IHogKiB6ICogdCArIGM7XHJcblxyXG4gIC8vIFBlcmZvcm0gcm90YXRpb24tc3BlY2lmaWMgbWF0cml4IG11bHRpcGxpY2F0aW9uXHJcbiAgb3V0WzBdID0gYTAwICogYjAwICsgYTEwICogYjAxICsgYTIwICogYjAyO1xyXG4gIG91dFsxXSA9IGEwMSAqIGIwMCArIGExMSAqIGIwMSArIGEyMSAqIGIwMjtcclxuICBvdXRbMl0gPSBhMDIgKiBiMDAgKyBhMTIgKiBiMDEgKyBhMjIgKiBiMDI7XHJcbiAgb3V0WzNdID0gYTAzICogYjAwICsgYTEzICogYjAxICsgYTIzICogYjAyO1xyXG4gIG91dFs0XSA9IGEwMCAqIGIxMCArIGExMCAqIGIxMSArIGEyMCAqIGIxMjtcclxuICBvdXRbNV0gPSBhMDEgKiBiMTAgKyBhMTEgKiBiMTEgKyBhMjEgKiBiMTI7XHJcbiAgb3V0WzZdID0gYTAyICogYjEwICsgYTEyICogYjExICsgYTIyICogYjEyO1xyXG4gIG91dFs3XSA9IGEwMyAqIGIxMCArIGExMyAqIGIxMSArIGEyMyAqIGIxMjtcclxuICBvdXRbOF0gPSBhMDAgKiBiMjAgKyBhMTAgKiBiMjEgKyBhMjAgKiBiMjI7XHJcbiAgb3V0WzldID0gYTAxICogYjIwICsgYTExICogYjIxICsgYTIxICogYjIyO1xyXG4gIG91dFsxMF0gPSBhMDIgKiBiMjAgKyBhMTIgKiBiMjEgKyBhMjIgKiBiMjI7XHJcbiAgb3V0WzExXSA9IGEwMyAqIGIyMCArIGExMyAqIGIyMSArIGEyMyAqIGIyMjtcclxuXHJcbiAgaWYgKGEgIT09IG91dCkge1xyXG4gICAgLy8gSWYgdGhlIHNvdXJjZSBhbmQgZGVzdGluYXRpb24gZGlmZmVyLCBjb3B5IHRoZSB1bmNoYW5nZWQgbGFzdCByb3dcclxuICAgIG91dFsxMl0gPSBhWzEyXTtcclxuICAgIG91dFsxM10gPSBhWzEzXTtcclxuICAgIG91dFsxNF0gPSBhWzE0XTtcclxuICAgIG91dFsxNV0gPSBhWzE1XTtcclxuICB9XHJcbiAgcmV0dXJuIG91dDtcclxufVxyXG5cclxuLyoqXHJcbiAqIFJvdGF0ZXMgYSBtYXRyaXggYnkgdGhlIGdpdmVuIGFuZ2xlIGFyb3VuZCB0aGUgWCBheGlzXHJcbiAqXHJcbiAqIEBwYXJhbSB7bWF0NH0gb3V0IHRoZSByZWNlaXZpbmcgbWF0cml4XHJcbiAqIEBwYXJhbSB7bWF0NH0gYSB0aGUgbWF0cml4IHRvIHJvdGF0ZVxyXG4gKiBAcGFyYW0ge051bWJlcn0gcmFkIHRoZSBhbmdsZSB0byByb3RhdGUgdGhlIG1hdHJpeCBieVxyXG4gKiBAcmV0dXJucyB7bWF0NH0gb3V0XHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gcm90YXRlWChvdXQsIGEsIHJhZCkge1xyXG4gIHZhciBzID0gTWF0aC5zaW4ocmFkKTtcclxuICB2YXIgYyA9IE1hdGguY29zKHJhZCk7XHJcbiAgdmFyIGExMCA9IGFbNF07XHJcbiAgdmFyIGExMSA9IGFbNV07XHJcbiAgdmFyIGExMiA9IGFbNl07XHJcbiAgdmFyIGExMyA9IGFbN107XHJcbiAgdmFyIGEyMCA9IGFbOF07XHJcbiAgdmFyIGEyMSA9IGFbOV07XHJcbiAgdmFyIGEyMiA9IGFbMTBdO1xyXG4gIHZhciBhMjMgPSBhWzExXTtcclxuXHJcbiAgaWYgKGEgIT09IG91dCkge1xyXG4gICAgLy8gSWYgdGhlIHNvdXJjZSBhbmQgZGVzdGluYXRpb24gZGlmZmVyLCBjb3B5IHRoZSB1bmNoYW5nZWQgcm93c1xyXG4gICAgb3V0WzBdID0gYVswXTtcclxuICAgIG91dFsxXSA9IGFbMV07XHJcbiAgICBvdXRbMl0gPSBhWzJdO1xyXG4gICAgb3V0WzNdID0gYVszXTtcclxuICAgIG91dFsxMl0gPSBhWzEyXTtcclxuICAgIG91dFsxM10gPSBhWzEzXTtcclxuICAgIG91dFsxNF0gPSBhWzE0XTtcclxuICAgIG91dFsxNV0gPSBhWzE1XTtcclxuICB9XHJcblxyXG4gIC8vIFBlcmZvcm0gYXhpcy1zcGVjaWZpYyBtYXRyaXggbXVsdGlwbGljYXRpb25cclxuICBvdXRbNF0gPSBhMTAgKiBjICsgYTIwICogcztcclxuICBvdXRbNV0gPSBhMTEgKiBjICsgYTIxICogcztcclxuICBvdXRbNl0gPSBhMTIgKiBjICsgYTIyICogcztcclxuICBvdXRbN10gPSBhMTMgKiBjICsgYTIzICogcztcclxuICBvdXRbOF0gPSBhMjAgKiBjIC0gYTEwICogcztcclxuICBvdXRbOV0gPSBhMjEgKiBjIC0gYTExICogcztcclxuICBvdXRbMTBdID0gYTIyICogYyAtIGExMiAqIHM7XHJcbiAgb3V0WzExXSA9IGEyMyAqIGMgLSBhMTMgKiBzO1xyXG4gIHJldHVybiBvdXQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBSb3RhdGVzIGEgbWF0cml4IGJ5IHRoZSBnaXZlbiBhbmdsZSBhcm91bmQgdGhlIFkgYXhpc1xyXG4gKlxyXG4gKiBAcGFyYW0ge21hdDR9IG91dCB0aGUgcmVjZWl2aW5nIG1hdHJpeFxyXG4gKiBAcGFyYW0ge21hdDR9IGEgdGhlIG1hdHJpeCB0byByb3RhdGVcclxuICogQHBhcmFtIHtOdW1iZXJ9IHJhZCB0aGUgYW5nbGUgdG8gcm90YXRlIHRoZSBtYXRyaXggYnlcclxuICogQHJldHVybnMge21hdDR9IG91dFxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIHJvdGF0ZVkob3V0LCBhLCByYWQpIHtcclxuICB2YXIgcyA9IE1hdGguc2luKHJhZCk7XHJcbiAgdmFyIGMgPSBNYXRoLmNvcyhyYWQpO1xyXG4gIHZhciBhMDAgPSBhWzBdO1xyXG4gIHZhciBhMDEgPSBhWzFdO1xyXG4gIHZhciBhMDIgPSBhWzJdO1xyXG4gIHZhciBhMDMgPSBhWzNdO1xyXG4gIHZhciBhMjAgPSBhWzhdO1xyXG4gIHZhciBhMjEgPSBhWzldO1xyXG4gIHZhciBhMjIgPSBhWzEwXTtcclxuICB2YXIgYTIzID0gYVsxMV07XHJcblxyXG4gIGlmIChhICE9PSBvdXQpIHtcclxuICAgIC8vIElmIHRoZSBzb3VyY2UgYW5kIGRlc3RpbmF0aW9uIGRpZmZlciwgY29weSB0aGUgdW5jaGFuZ2VkIHJvd3NcclxuICAgIG91dFs0XSA9IGFbNF07XHJcbiAgICBvdXRbNV0gPSBhWzVdO1xyXG4gICAgb3V0WzZdID0gYVs2XTtcclxuICAgIG91dFs3XSA9IGFbN107XHJcbiAgICBvdXRbMTJdID0gYVsxMl07XHJcbiAgICBvdXRbMTNdID0gYVsxM107XHJcbiAgICBvdXRbMTRdID0gYVsxNF07XHJcbiAgICBvdXRbMTVdID0gYVsxNV07XHJcbiAgfVxyXG5cclxuICAvLyBQZXJmb3JtIGF4aXMtc3BlY2lmaWMgbWF0cml4IG11bHRpcGxpY2F0aW9uXHJcbiAgb3V0WzBdID0gYTAwICogYyAtIGEyMCAqIHM7XHJcbiAgb3V0WzFdID0gYTAxICogYyAtIGEyMSAqIHM7XHJcbiAgb3V0WzJdID0gYTAyICogYyAtIGEyMiAqIHM7XHJcbiAgb3V0WzNdID0gYTAzICogYyAtIGEyMyAqIHM7XHJcbiAgb3V0WzhdID0gYTAwICogcyArIGEyMCAqIGM7XHJcbiAgb3V0WzldID0gYTAxICogcyArIGEyMSAqIGM7XHJcbiAgb3V0WzEwXSA9IGEwMiAqIHMgKyBhMjIgKiBjO1xyXG4gIG91dFsxMV0gPSBhMDMgKiBzICsgYTIzICogYztcclxuICByZXR1cm4gb3V0O1xyXG59XHJcblxyXG4vKipcclxuICogUm90YXRlcyBhIG1hdHJpeCBieSB0aGUgZ2l2ZW4gYW5nbGUgYXJvdW5kIHRoZSBaIGF4aXNcclxuICpcclxuICogQHBhcmFtIHttYXQ0fSBvdXQgdGhlIHJlY2VpdmluZyBtYXRyaXhcclxuICogQHBhcmFtIHttYXQ0fSBhIHRoZSBtYXRyaXggdG8gcm90YXRlXHJcbiAqIEBwYXJhbSB7TnVtYmVyfSByYWQgdGhlIGFuZ2xlIHRvIHJvdGF0ZSB0aGUgbWF0cml4IGJ5XHJcbiAqIEByZXR1cm5zIHttYXQ0fSBvdXRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiByb3RhdGVaKG91dCwgYSwgcmFkKSB7XHJcbiAgdmFyIHMgPSBNYXRoLnNpbihyYWQpO1xyXG4gIHZhciBjID0gTWF0aC5jb3MocmFkKTtcclxuICB2YXIgYTAwID0gYVswXTtcclxuICB2YXIgYTAxID0gYVsxXTtcclxuICB2YXIgYTAyID0gYVsyXTtcclxuICB2YXIgYTAzID0gYVszXTtcclxuICB2YXIgYTEwID0gYVs0XTtcclxuICB2YXIgYTExID0gYVs1XTtcclxuICB2YXIgYTEyID0gYVs2XTtcclxuICB2YXIgYTEzID0gYVs3XTtcclxuXHJcbiAgaWYgKGEgIT09IG91dCkge1xyXG4gICAgLy8gSWYgdGhlIHNvdXJjZSBhbmQgZGVzdGluYXRpb24gZGlmZmVyLCBjb3B5IHRoZSB1bmNoYW5nZWQgbGFzdCByb3dcclxuICAgIG91dFs4XSA9IGFbOF07XHJcbiAgICBvdXRbOV0gPSBhWzldO1xyXG4gICAgb3V0WzEwXSA9IGFbMTBdO1xyXG4gICAgb3V0WzExXSA9IGFbMTFdO1xyXG4gICAgb3V0WzEyXSA9IGFbMTJdO1xyXG4gICAgb3V0WzEzXSA9IGFbMTNdO1xyXG4gICAgb3V0WzE0XSA9IGFbMTRdO1xyXG4gICAgb3V0WzE1XSA9IGFbMTVdO1xyXG4gIH1cclxuXHJcbiAgLy8gUGVyZm9ybSBheGlzLXNwZWNpZmljIG1hdHJpeCBtdWx0aXBsaWNhdGlvblxyXG4gIG91dFswXSA9IGEwMCAqIGMgKyBhMTAgKiBzO1xyXG4gIG91dFsxXSA9IGEwMSAqIGMgKyBhMTEgKiBzO1xyXG4gIG91dFsyXSA9IGEwMiAqIGMgKyBhMTIgKiBzO1xyXG4gIG91dFszXSA9IGEwMyAqIGMgKyBhMTMgKiBzO1xyXG4gIG91dFs0XSA9IGExMCAqIGMgLSBhMDAgKiBzO1xyXG4gIG91dFs1XSA9IGExMSAqIGMgLSBhMDEgKiBzO1xyXG4gIG91dFs2XSA9IGExMiAqIGMgLSBhMDIgKiBzO1xyXG4gIG91dFs3XSA9IGExMyAqIGMgLSBhMDMgKiBzO1xyXG4gIHJldHVybiBvdXQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDcmVhdGVzIGEgbWF0cml4IGZyb20gYSB2ZWN0b3IgdHJhbnNsYXRpb25cclxuICogVGhpcyBpcyBlcXVpdmFsZW50IHRvIChidXQgbXVjaCBmYXN0ZXIgdGhhbik6XHJcbiAqXHJcbiAqICAgICBtYXQ0LmlkZW50aXR5KGRlc3QpO1xyXG4gKiAgICAgbWF0NC50cmFuc2xhdGUoZGVzdCwgZGVzdCwgdmVjKTtcclxuICpcclxuICogQHBhcmFtIHttYXQ0fSBvdXQgbWF0NCByZWNlaXZpbmcgb3BlcmF0aW9uIHJlc3VsdFxyXG4gKiBAcGFyYW0ge3ZlYzN9IHYgVHJhbnNsYXRpb24gdmVjdG9yXHJcbiAqIEByZXR1cm5zIHttYXQ0fSBvdXRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBmcm9tVHJhbnNsYXRpb24ob3V0LCB2KSB7XHJcbiAgb3V0WzBdID0gMTtcclxuICBvdXRbMV0gPSAwO1xyXG4gIG91dFsyXSA9IDA7XHJcbiAgb3V0WzNdID0gMDtcclxuICBvdXRbNF0gPSAwO1xyXG4gIG91dFs1XSA9IDE7XHJcbiAgb3V0WzZdID0gMDtcclxuICBvdXRbN10gPSAwO1xyXG4gIG91dFs4XSA9IDA7XHJcbiAgb3V0WzldID0gMDtcclxuICBvdXRbMTBdID0gMTtcclxuICBvdXRbMTFdID0gMDtcclxuICBvdXRbMTJdID0gdlswXTtcclxuICBvdXRbMTNdID0gdlsxXTtcclxuICBvdXRbMTRdID0gdlsyXTtcclxuICBvdXRbMTVdID0gMTtcclxuICByZXR1cm4gb3V0O1xyXG59XHJcblxyXG4vKipcclxuICogQ3JlYXRlcyBhIG1hdHJpeCBmcm9tIGEgdmVjdG9yIHNjYWxpbmdcclxuICogVGhpcyBpcyBlcXVpdmFsZW50IHRvIChidXQgbXVjaCBmYXN0ZXIgdGhhbik6XHJcbiAqXHJcbiAqICAgICBtYXQ0LmlkZW50aXR5KGRlc3QpO1xyXG4gKiAgICAgbWF0NC5zY2FsZShkZXN0LCBkZXN0LCB2ZWMpO1xyXG4gKlxyXG4gKiBAcGFyYW0ge21hdDR9IG91dCBtYXQ0IHJlY2VpdmluZyBvcGVyYXRpb24gcmVzdWx0XHJcbiAqIEBwYXJhbSB7dmVjM30gdiBTY2FsaW5nIHZlY3RvclxyXG4gKiBAcmV0dXJucyB7bWF0NH0gb3V0XHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gZnJvbVNjYWxpbmcob3V0LCB2KSB7XHJcbiAgb3V0WzBdID0gdlswXTtcclxuICBvdXRbMV0gPSAwO1xyXG4gIG91dFsyXSA9IDA7XHJcbiAgb3V0WzNdID0gMDtcclxuICBvdXRbNF0gPSAwO1xyXG4gIG91dFs1XSA9IHZbMV07XHJcbiAgb3V0WzZdID0gMDtcclxuICBvdXRbN10gPSAwO1xyXG4gIG91dFs4XSA9IDA7XHJcbiAgb3V0WzldID0gMDtcclxuICBvdXRbMTBdID0gdlsyXTtcclxuICBvdXRbMTFdID0gMDtcclxuICBvdXRbMTJdID0gMDtcclxuICBvdXRbMTNdID0gMDtcclxuICBvdXRbMTRdID0gMDtcclxuICBvdXRbMTVdID0gMTtcclxuICByZXR1cm4gb3V0O1xyXG59XHJcblxyXG4vKipcclxuICogQ3JlYXRlcyBhIG1hdHJpeCBmcm9tIGEgZ2l2ZW4gYW5nbGUgYXJvdW5kIGEgZ2l2ZW4gYXhpc1xyXG4gKiBUaGlzIGlzIGVxdWl2YWxlbnQgdG8gKGJ1dCBtdWNoIGZhc3RlciB0aGFuKTpcclxuICpcclxuICogICAgIG1hdDQuaWRlbnRpdHkoZGVzdCk7XHJcbiAqICAgICBtYXQ0LnJvdGF0ZShkZXN0LCBkZXN0LCByYWQsIGF4aXMpO1xyXG4gKlxyXG4gKiBAcGFyYW0ge21hdDR9IG91dCBtYXQ0IHJlY2VpdmluZyBvcGVyYXRpb24gcmVzdWx0XHJcbiAqIEBwYXJhbSB7TnVtYmVyfSByYWQgdGhlIGFuZ2xlIHRvIHJvdGF0ZSB0aGUgbWF0cml4IGJ5XHJcbiAqIEBwYXJhbSB7dmVjM30gYXhpcyB0aGUgYXhpcyB0byByb3RhdGUgYXJvdW5kXHJcbiAqIEByZXR1cm5zIHttYXQ0fSBvdXRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBmcm9tUm90YXRpb24ob3V0LCByYWQsIGF4aXMpIHtcclxuICB2YXIgeCA9IGF4aXNbMF0sXHJcbiAgICAgIHkgPSBheGlzWzFdLFxyXG4gICAgICB6ID0gYXhpc1syXTtcclxuICB2YXIgbGVuID0gTWF0aC5zcXJ0KHggKiB4ICsgeSAqIHkgKyB6ICogeik7XHJcbiAgdmFyIHMgPSB2b2lkIDAsXHJcbiAgICAgIGMgPSB2b2lkIDAsXHJcbiAgICAgIHQgPSB2b2lkIDA7XHJcblxyXG4gIGlmIChsZW4gPCBnbE1hdHJpeC5FUFNJTE9OKSB7XHJcbiAgICByZXR1cm4gbnVsbDtcclxuICB9XHJcblxyXG4gIGxlbiA9IDEgLyBsZW47XHJcbiAgeCAqPSBsZW47XHJcbiAgeSAqPSBsZW47XHJcbiAgeiAqPSBsZW47XHJcblxyXG4gIHMgPSBNYXRoLnNpbihyYWQpO1xyXG4gIGMgPSBNYXRoLmNvcyhyYWQpO1xyXG4gIHQgPSAxIC0gYztcclxuXHJcbiAgLy8gUGVyZm9ybSByb3RhdGlvbi1zcGVjaWZpYyBtYXRyaXggbXVsdGlwbGljYXRpb25cclxuICBvdXRbMF0gPSB4ICogeCAqIHQgKyBjO1xyXG4gIG91dFsxXSA9IHkgKiB4ICogdCArIHogKiBzO1xyXG4gIG91dFsyXSA9IHogKiB4ICogdCAtIHkgKiBzO1xyXG4gIG91dFszXSA9IDA7XHJcbiAgb3V0WzRdID0geCAqIHkgKiB0IC0geiAqIHM7XHJcbiAgb3V0WzVdID0geSAqIHkgKiB0ICsgYztcclxuICBvdXRbNl0gPSB6ICogeSAqIHQgKyB4ICogcztcclxuICBvdXRbN10gPSAwO1xyXG4gIG91dFs4XSA9IHggKiB6ICogdCArIHkgKiBzO1xyXG4gIG91dFs5XSA9IHkgKiB6ICogdCAtIHggKiBzO1xyXG4gIG91dFsxMF0gPSB6ICogeiAqIHQgKyBjO1xyXG4gIG91dFsxMV0gPSAwO1xyXG4gIG91dFsxMl0gPSAwO1xyXG4gIG91dFsxM10gPSAwO1xyXG4gIG91dFsxNF0gPSAwO1xyXG4gIG91dFsxNV0gPSAxO1xyXG4gIHJldHVybiBvdXQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDcmVhdGVzIGEgbWF0cml4IGZyb20gdGhlIGdpdmVuIGFuZ2xlIGFyb3VuZCB0aGUgWCBheGlzXHJcbiAqIFRoaXMgaXMgZXF1aXZhbGVudCB0byAoYnV0IG11Y2ggZmFzdGVyIHRoYW4pOlxyXG4gKlxyXG4gKiAgICAgbWF0NC5pZGVudGl0eShkZXN0KTtcclxuICogICAgIG1hdDQucm90YXRlWChkZXN0LCBkZXN0LCByYWQpO1xyXG4gKlxyXG4gKiBAcGFyYW0ge21hdDR9IG91dCBtYXQ0IHJlY2VpdmluZyBvcGVyYXRpb24gcmVzdWx0XHJcbiAqIEBwYXJhbSB7TnVtYmVyfSByYWQgdGhlIGFuZ2xlIHRvIHJvdGF0ZSB0aGUgbWF0cml4IGJ5XHJcbiAqIEByZXR1cm5zIHttYXQ0fSBvdXRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBmcm9tWFJvdGF0aW9uKG91dCwgcmFkKSB7XHJcbiAgdmFyIHMgPSBNYXRoLnNpbihyYWQpO1xyXG4gIHZhciBjID0gTWF0aC5jb3MocmFkKTtcclxuXHJcbiAgLy8gUGVyZm9ybSBheGlzLXNwZWNpZmljIG1hdHJpeCBtdWx0aXBsaWNhdGlvblxyXG4gIG91dFswXSA9IDE7XHJcbiAgb3V0WzFdID0gMDtcclxuICBvdXRbMl0gPSAwO1xyXG4gIG91dFszXSA9IDA7XHJcbiAgb3V0WzRdID0gMDtcclxuICBvdXRbNV0gPSBjO1xyXG4gIG91dFs2XSA9IHM7XHJcbiAgb3V0WzddID0gMDtcclxuICBvdXRbOF0gPSAwO1xyXG4gIG91dFs5XSA9IC1zO1xyXG4gIG91dFsxMF0gPSBjO1xyXG4gIG91dFsxMV0gPSAwO1xyXG4gIG91dFsxMl0gPSAwO1xyXG4gIG91dFsxM10gPSAwO1xyXG4gIG91dFsxNF0gPSAwO1xyXG4gIG91dFsxNV0gPSAxO1xyXG4gIHJldHVybiBvdXQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDcmVhdGVzIGEgbWF0cml4IGZyb20gdGhlIGdpdmVuIGFuZ2xlIGFyb3VuZCB0aGUgWSBheGlzXHJcbiAqIFRoaXMgaXMgZXF1aXZhbGVudCB0byAoYnV0IG11Y2ggZmFzdGVyIHRoYW4pOlxyXG4gKlxyXG4gKiAgICAgbWF0NC5pZGVudGl0eShkZXN0KTtcclxuICogICAgIG1hdDQucm90YXRlWShkZXN0LCBkZXN0LCByYWQpO1xyXG4gKlxyXG4gKiBAcGFyYW0ge21hdDR9IG91dCBtYXQ0IHJlY2VpdmluZyBvcGVyYXRpb24gcmVzdWx0XHJcbiAqIEBwYXJhbSB7TnVtYmVyfSByYWQgdGhlIGFuZ2xlIHRvIHJvdGF0ZSB0aGUgbWF0cml4IGJ5XHJcbiAqIEByZXR1cm5zIHttYXQ0fSBvdXRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBmcm9tWVJvdGF0aW9uKG91dCwgcmFkKSB7XHJcbiAgdmFyIHMgPSBNYXRoLnNpbihyYWQpO1xyXG4gIHZhciBjID0gTWF0aC5jb3MocmFkKTtcclxuXHJcbiAgLy8gUGVyZm9ybSBheGlzLXNwZWNpZmljIG1hdHJpeCBtdWx0aXBsaWNhdGlvblxyXG4gIG91dFswXSA9IGM7XHJcbiAgb3V0WzFdID0gMDtcclxuICBvdXRbMl0gPSAtcztcclxuICBvdXRbM10gPSAwO1xyXG4gIG91dFs0XSA9IDA7XHJcbiAgb3V0WzVdID0gMTtcclxuICBvdXRbNl0gPSAwO1xyXG4gIG91dFs3XSA9IDA7XHJcbiAgb3V0WzhdID0gcztcclxuICBvdXRbOV0gPSAwO1xyXG4gIG91dFsxMF0gPSBjO1xyXG4gIG91dFsxMV0gPSAwO1xyXG4gIG91dFsxMl0gPSAwO1xyXG4gIG91dFsxM10gPSAwO1xyXG4gIG91dFsxNF0gPSAwO1xyXG4gIG91dFsxNV0gPSAxO1xyXG4gIHJldHVybiBvdXQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDcmVhdGVzIGEgbWF0cml4IGZyb20gdGhlIGdpdmVuIGFuZ2xlIGFyb3VuZCB0aGUgWiBheGlzXHJcbiAqIFRoaXMgaXMgZXF1aXZhbGVudCB0byAoYnV0IG11Y2ggZmFzdGVyIHRoYW4pOlxyXG4gKlxyXG4gKiAgICAgbWF0NC5pZGVudGl0eShkZXN0KTtcclxuICogICAgIG1hdDQucm90YXRlWihkZXN0LCBkZXN0LCByYWQpO1xyXG4gKlxyXG4gKiBAcGFyYW0ge21hdDR9IG91dCBtYXQ0IHJlY2VpdmluZyBvcGVyYXRpb24gcmVzdWx0XHJcbiAqIEBwYXJhbSB7TnVtYmVyfSByYWQgdGhlIGFuZ2xlIHRvIHJvdGF0ZSB0aGUgbWF0cml4IGJ5XHJcbiAqIEByZXR1cm5zIHttYXQ0fSBvdXRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBmcm9tWlJvdGF0aW9uKG91dCwgcmFkKSB7XHJcbiAgdmFyIHMgPSBNYXRoLnNpbihyYWQpO1xyXG4gIHZhciBjID0gTWF0aC5jb3MocmFkKTtcclxuXHJcbiAgLy8gUGVyZm9ybSBheGlzLXNwZWNpZmljIG1hdHJpeCBtdWx0aXBsaWNhdGlvblxyXG4gIG91dFswXSA9IGM7XHJcbiAgb3V0WzFdID0gcztcclxuICBvdXRbMl0gPSAwO1xyXG4gIG91dFszXSA9IDA7XHJcbiAgb3V0WzRdID0gLXM7XHJcbiAgb3V0WzVdID0gYztcclxuICBvdXRbNl0gPSAwO1xyXG4gIG91dFs3XSA9IDA7XHJcbiAgb3V0WzhdID0gMDtcclxuICBvdXRbOV0gPSAwO1xyXG4gIG91dFsxMF0gPSAxO1xyXG4gIG91dFsxMV0gPSAwO1xyXG4gIG91dFsxMl0gPSAwO1xyXG4gIG91dFsxM10gPSAwO1xyXG4gIG91dFsxNF0gPSAwO1xyXG4gIG91dFsxNV0gPSAxO1xyXG4gIHJldHVybiBvdXQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDcmVhdGVzIGEgbWF0cml4IGZyb20gYSBxdWF0ZXJuaW9uIHJvdGF0aW9uIGFuZCB2ZWN0b3IgdHJhbnNsYXRpb25cclxuICogVGhpcyBpcyBlcXVpdmFsZW50IHRvIChidXQgbXVjaCBmYXN0ZXIgdGhhbik6XHJcbiAqXHJcbiAqICAgICBtYXQ0LmlkZW50aXR5KGRlc3QpO1xyXG4gKiAgICAgbWF0NC50cmFuc2xhdGUoZGVzdCwgdmVjKTtcclxuICogICAgIGxldCBxdWF0TWF0ID0gbWF0NC5jcmVhdGUoKTtcclxuICogICAgIHF1YXQ0LnRvTWF0NChxdWF0LCBxdWF0TWF0KTtcclxuICogICAgIG1hdDQubXVsdGlwbHkoZGVzdCwgcXVhdE1hdCk7XHJcbiAqXHJcbiAqIEBwYXJhbSB7bWF0NH0gb3V0IG1hdDQgcmVjZWl2aW5nIG9wZXJhdGlvbiByZXN1bHRcclxuICogQHBhcmFtIHtxdWF0NH0gcSBSb3RhdGlvbiBxdWF0ZXJuaW9uXHJcbiAqIEBwYXJhbSB7dmVjM30gdiBUcmFuc2xhdGlvbiB2ZWN0b3JcclxuICogQHJldHVybnMge21hdDR9IG91dFxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGZyb21Sb3RhdGlvblRyYW5zbGF0aW9uKG91dCwgcSwgdikge1xyXG4gIC8vIFF1YXRlcm5pb24gbWF0aFxyXG4gIHZhciB4ID0gcVswXSxcclxuICAgICAgeSA9IHFbMV0sXHJcbiAgICAgIHogPSBxWzJdLFxyXG4gICAgICB3ID0gcVszXTtcclxuICB2YXIgeDIgPSB4ICsgeDtcclxuICB2YXIgeTIgPSB5ICsgeTtcclxuICB2YXIgejIgPSB6ICsgejtcclxuXHJcbiAgdmFyIHh4ID0geCAqIHgyO1xyXG4gIHZhciB4eSA9IHggKiB5MjtcclxuICB2YXIgeHogPSB4ICogejI7XHJcbiAgdmFyIHl5ID0geSAqIHkyO1xyXG4gIHZhciB5eiA9IHkgKiB6MjtcclxuICB2YXIgenogPSB6ICogejI7XHJcbiAgdmFyIHd4ID0gdyAqIHgyO1xyXG4gIHZhciB3eSA9IHcgKiB5MjtcclxuICB2YXIgd3ogPSB3ICogejI7XHJcblxyXG4gIG91dFswXSA9IDEgLSAoeXkgKyB6eik7XHJcbiAgb3V0WzFdID0geHkgKyB3ejtcclxuICBvdXRbMl0gPSB4eiAtIHd5O1xyXG4gIG91dFszXSA9IDA7XHJcbiAgb3V0WzRdID0geHkgLSB3ejtcclxuICBvdXRbNV0gPSAxIC0gKHh4ICsgenopO1xyXG4gIG91dFs2XSA9IHl6ICsgd3g7XHJcbiAgb3V0WzddID0gMDtcclxuICBvdXRbOF0gPSB4eiArIHd5O1xyXG4gIG91dFs5XSA9IHl6IC0gd3g7XHJcbiAgb3V0WzEwXSA9IDEgLSAoeHggKyB5eSk7XHJcbiAgb3V0WzExXSA9IDA7XHJcbiAgb3V0WzEyXSA9IHZbMF07XHJcbiAgb3V0WzEzXSA9IHZbMV07XHJcbiAgb3V0WzE0XSA9IHZbMl07XHJcbiAgb3V0WzE1XSA9IDE7XHJcblxyXG4gIHJldHVybiBvdXQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDcmVhdGVzIGEgbmV3IG1hdDQgZnJvbSBhIGR1YWwgcXVhdC5cclxuICpcclxuICogQHBhcmFtIHttYXQ0fSBvdXQgTWF0cml4XHJcbiAqIEBwYXJhbSB7cXVhdDJ9IGEgRHVhbCBRdWF0ZXJuaW9uXHJcbiAqIEByZXR1cm5zIHttYXQ0fSBtYXQ0IHJlY2VpdmluZyBvcGVyYXRpb24gcmVzdWx0XHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gZnJvbVF1YXQyKG91dCwgYSkge1xyXG4gIHZhciB0cmFuc2xhdGlvbiA9IG5ldyBnbE1hdHJpeC5BUlJBWV9UWVBFKDMpO1xyXG4gIHZhciBieCA9IC1hWzBdLFxyXG4gICAgICBieSA9IC1hWzFdLFxyXG4gICAgICBieiA9IC1hWzJdLFxyXG4gICAgICBidyA9IGFbM10sXHJcbiAgICAgIGF4ID0gYVs0XSxcclxuICAgICAgYXkgPSBhWzVdLFxyXG4gICAgICBheiA9IGFbNl0sXHJcbiAgICAgIGF3ID0gYVs3XTtcclxuXHJcbiAgdmFyIG1hZ25pdHVkZSA9IGJ4ICogYnggKyBieSAqIGJ5ICsgYnogKiBieiArIGJ3ICogYnc7XHJcbiAgLy9Pbmx5IHNjYWxlIGlmIGl0IG1ha2VzIHNlbnNlXHJcbiAgaWYgKG1hZ25pdHVkZSA+IDApIHtcclxuICAgIHRyYW5zbGF0aW9uWzBdID0gKGF4ICogYncgKyBhdyAqIGJ4ICsgYXkgKiBieiAtIGF6ICogYnkpICogMiAvIG1hZ25pdHVkZTtcclxuICAgIHRyYW5zbGF0aW9uWzFdID0gKGF5ICogYncgKyBhdyAqIGJ5ICsgYXogKiBieCAtIGF4ICogYnopICogMiAvIG1hZ25pdHVkZTtcclxuICAgIHRyYW5zbGF0aW9uWzJdID0gKGF6ICogYncgKyBhdyAqIGJ6ICsgYXggKiBieSAtIGF5ICogYngpICogMiAvIG1hZ25pdHVkZTtcclxuICB9IGVsc2Uge1xyXG4gICAgdHJhbnNsYXRpb25bMF0gPSAoYXggKiBidyArIGF3ICogYnggKyBheSAqIGJ6IC0gYXogKiBieSkgKiAyO1xyXG4gICAgdHJhbnNsYXRpb25bMV0gPSAoYXkgKiBidyArIGF3ICogYnkgKyBheiAqIGJ4IC0gYXggKiBieikgKiAyO1xyXG4gICAgdHJhbnNsYXRpb25bMl0gPSAoYXogKiBidyArIGF3ICogYnogKyBheCAqIGJ5IC0gYXkgKiBieCkgKiAyO1xyXG4gIH1cclxuICBmcm9tUm90YXRpb25UcmFuc2xhdGlvbihvdXQsIGEsIHRyYW5zbGF0aW9uKTtcclxuICByZXR1cm4gb3V0O1xyXG59XHJcblxyXG4vKipcclxuICogUmV0dXJucyB0aGUgdHJhbnNsYXRpb24gdmVjdG9yIGNvbXBvbmVudCBvZiBhIHRyYW5zZm9ybWF0aW9uXHJcbiAqICBtYXRyaXguIElmIGEgbWF0cml4IGlzIGJ1aWx0IHdpdGggZnJvbVJvdGF0aW9uVHJhbnNsYXRpb24sXHJcbiAqICB0aGUgcmV0dXJuZWQgdmVjdG9yIHdpbGwgYmUgdGhlIHNhbWUgYXMgdGhlIHRyYW5zbGF0aW9uIHZlY3RvclxyXG4gKiAgb3JpZ2luYWxseSBzdXBwbGllZC5cclxuICogQHBhcmFtICB7dmVjM30gb3V0IFZlY3RvciB0byByZWNlaXZlIHRyYW5zbGF0aW9uIGNvbXBvbmVudFxyXG4gKiBAcGFyYW0gIHttYXQ0fSBtYXQgTWF0cml4IHRvIGJlIGRlY29tcG9zZWQgKGlucHV0KVxyXG4gKiBAcmV0dXJuIHt2ZWMzfSBvdXRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBnZXRUcmFuc2xhdGlvbihvdXQsIG1hdCkge1xyXG4gIG91dFswXSA9IG1hdFsxMl07XHJcbiAgb3V0WzFdID0gbWF0WzEzXTtcclxuICBvdXRbMl0gPSBtYXRbMTRdO1xyXG5cclxuICByZXR1cm4gb3V0O1xyXG59XHJcblxyXG4vKipcclxuICogUmV0dXJucyB0aGUgc2NhbGluZyBmYWN0b3IgY29tcG9uZW50IG9mIGEgdHJhbnNmb3JtYXRpb25cclxuICogIG1hdHJpeC4gSWYgYSBtYXRyaXggaXMgYnVpbHQgd2l0aCBmcm9tUm90YXRpb25UcmFuc2xhdGlvblNjYWxlXHJcbiAqICB3aXRoIGEgbm9ybWFsaXplZCBRdWF0ZXJuaW9uIHBhcmFtdGVyLCB0aGUgcmV0dXJuZWQgdmVjdG9yIHdpbGwgYmVcclxuICogIHRoZSBzYW1lIGFzIHRoZSBzY2FsaW5nIHZlY3RvclxyXG4gKiAgb3JpZ2luYWxseSBzdXBwbGllZC5cclxuICogQHBhcmFtICB7dmVjM30gb3V0IFZlY3RvciB0byByZWNlaXZlIHNjYWxpbmcgZmFjdG9yIGNvbXBvbmVudFxyXG4gKiBAcGFyYW0gIHttYXQ0fSBtYXQgTWF0cml4IHRvIGJlIGRlY29tcG9zZWQgKGlucHV0KVxyXG4gKiBAcmV0dXJuIHt2ZWMzfSBvdXRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBnZXRTY2FsaW5nKG91dCwgbWF0KSB7XHJcbiAgdmFyIG0xMSA9IG1hdFswXTtcclxuICB2YXIgbTEyID0gbWF0WzFdO1xyXG4gIHZhciBtMTMgPSBtYXRbMl07XHJcbiAgdmFyIG0yMSA9IG1hdFs0XTtcclxuICB2YXIgbTIyID0gbWF0WzVdO1xyXG4gIHZhciBtMjMgPSBtYXRbNl07XHJcbiAgdmFyIG0zMSA9IG1hdFs4XTtcclxuICB2YXIgbTMyID0gbWF0WzldO1xyXG4gIHZhciBtMzMgPSBtYXRbMTBdO1xyXG5cclxuICBvdXRbMF0gPSBNYXRoLnNxcnQobTExICogbTExICsgbTEyICogbTEyICsgbTEzICogbTEzKTtcclxuICBvdXRbMV0gPSBNYXRoLnNxcnQobTIxICogbTIxICsgbTIyICogbTIyICsgbTIzICogbTIzKTtcclxuICBvdXRbMl0gPSBNYXRoLnNxcnQobTMxICogbTMxICsgbTMyICogbTMyICsgbTMzICogbTMzKTtcclxuXHJcbiAgcmV0dXJuIG91dDtcclxufVxyXG5cclxuLyoqXHJcbiAqIFJldHVybnMgYSBxdWF0ZXJuaW9uIHJlcHJlc2VudGluZyB0aGUgcm90YXRpb25hbCBjb21wb25lbnRcclxuICogIG9mIGEgdHJhbnNmb3JtYXRpb24gbWF0cml4LiBJZiBhIG1hdHJpeCBpcyBidWlsdCB3aXRoXHJcbiAqICBmcm9tUm90YXRpb25UcmFuc2xhdGlvbiwgdGhlIHJldHVybmVkIHF1YXRlcm5pb24gd2lsbCBiZSB0aGVcclxuICogIHNhbWUgYXMgdGhlIHF1YXRlcm5pb24gb3JpZ2luYWxseSBzdXBwbGllZC5cclxuICogQHBhcmFtIHtxdWF0fSBvdXQgUXVhdGVybmlvbiB0byByZWNlaXZlIHRoZSByb3RhdGlvbiBjb21wb25lbnRcclxuICogQHBhcmFtIHttYXQ0fSBtYXQgTWF0cml4IHRvIGJlIGRlY29tcG9zZWQgKGlucHV0KVxyXG4gKiBAcmV0dXJuIHtxdWF0fSBvdXRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBnZXRSb3RhdGlvbihvdXQsIG1hdCkge1xyXG4gIC8vIEFsZ29yaXRobSB0YWtlbiBmcm9tIGh0dHA6Ly93d3cuZXVjbGlkZWFuc3BhY2UuY29tL21hdGhzL2dlb21ldHJ5L3JvdGF0aW9ucy9jb252ZXJzaW9ucy9tYXRyaXhUb1F1YXRlcm5pb24vaW5kZXguaHRtXHJcbiAgdmFyIHRyYWNlID0gbWF0WzBdICsgbWF0WzVdICsgbWF0WzEwXTtcclxuICB2YXIgUyA9IDA7XHJcblxyXG4gIGlmICh0cmFjZSA+IDApIHtcclxuICAgIFMgPSBNYXRoLnNxcnQodHJhY2UgKyAxLjApICogMjtcclxuICAgIG91dFszXSA9IDAuMjUgKiBTO1xyXG4gICAgb3V0WzBdID0gKG1hdFs2XSAtIG1hdFs5XSkgLyBTO1xyXG4gICAgb3V0WzFdID0gKG1hdFs4XSAtIG1hdFsyXSkgLyBTO1xyXG4gICAgb3V0WzJdID0gKG1hdFsxXSAtIG1hdFs0XSkgLyBTO1xyXG4gIH0gZWxzZSBpZiAobWF0WzBdID4gbWF0WzVdICYmIG1hdFswXSA+IG1hdFsxMF0pIHtcclxuICAgIFMgPSBNYXRoLnNxcnQoMS4wICsgbWF0WzBdIC0gbWF0WzVdIC0gbWF0WzEwXSkgKiAyO1xyXG4gICAgb3V0WzNdID0gKG1hdFs2XSAtIG1hdFs5XSkgLyBTO1xyXG4gICAgb3V0WzBdID0gMC4yNSAqIFM7XHJcbiAgICBvdXRbMV0gPSAobWF0WzFdICsgbWF0WzRdKSAvIFM7XHJcbiAgICBvdXRbMl0gPSAobWF0WzhdICsgbWF0WzJdKSAvIFM7XHJcbiAgfSBlbHNlIGlmIChtYXRbNV0gPiBtYXRbMTBdKSB7XHJcbiAgICBTID0gTWF0aC5zcXJ0KDEuMCArIG1hdFs1XSAtIG1hdFswXSAtIG1hdFsxMF0pICogMjtcclxuICAgIG91dFszXSA9IChtYXRbOF0gLSBtYXRbMl0pIC8gUztcclxuICAgIG91dFswXSA9IChtYXRbMV0gKyBtYXRbNF0pIC8gUztcclxuICAgIG91dFsxXSA9IDAuMjUgKiBTO1xyXG4gICAgb3V0WzJdID0gKG1hdFs2XSArIG1hdFs5XSkgLyBTO1xyXG4gIH0gZWxzZSB7XHJcbiAgICBTID0gTWF0aC5zcXJ0KDEuMCArIG1hdFsxMF0gLSBtYXRbMF0gLSBtYXRbNV0pICogMjtcclxuICAgIG91dFszXSA9IChtYXRbMV0gLSBtYXRbNF0pIC8gUztcclxuICAgIG91dFswXSA9IChtYXRbOF0gKyBtYXRbMl0pIC8gUztcclxuICAgIG91dFsxXSA9IChtYXRbNl0gKyBtYXRbOV0pIC8gUztcclxuICAgIG91dFsyXSA9IDAuMjUgKiBTO1xyXG4gIH1cclxuXHJcbiAgcmV0dXJuIG91dDtcclxufVxyXG5cclxuLyoqXHJcbiAqIENyZWF0ZXMgYSBtYXRyaXggZnJvbSBhIHF1YXRlcm5pb24gcm90YXRpb24sIHZlY3RvciB0cmFuc2xhdGlvbiBhbmQgdmVjdG9yIHNjYWxlXHJcbiAqIFRoaXMgaXMgZXF1aXZhbGVudCB0byAoYnV0IG11Y2ggZmFzdGVyIHRoYW4pOlxyXG4gKlxyXG4gKiAgICAgbWF0NC5pZGVudGl0eShkZXN0KTtcclxuICogICAgIG1hdDQudHJhbnNsYXRlKGRlc3QsIHZlYyk7XHJcbiAqICAgICBsZXQgcXVhdE1hdCA9IG1hdDQuY3JlYXRlKCk7XHJcbiAqICAgICBxdWF0NC50b01hdDQocXVhdCwgcXVhdE1hdCk7XHJcbiAqICAgICBtYXQ0Lm11bHRpcGx5KGRlc3QsIHF1YXRNYXQpO1xyXG4gKiAgICAgbWF0NC5zY2FsZShkZXN0LCBzY2FsZSlcclxuICpcclxuICogQHBhcmFtIHttYXQ0fSBvdXQgbWF0NCByZWNlaXZpbmcgb3BlcmF0aW9uIHJlc3VsdFxyXG4gKiBAcGFyYW0ge3F1YXQ0fSBxIFJvdGF0aW9uIHF1YXRlcm5pb25cclxuICogQHBhcmFtIHt2ZWMzfSB2IFRyYW5zbGF0aW9uIHZlY3RvclxyXG4gKiBAcGFyYW0ge3ZlYzN9IHMgU2NhbGluZyB2ZWN0b3JcclxuICogQHJldHVybnMge21hdDR9IG91dFxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGZyb21Sb3RhdGlvblRyYW5zbGF0aW9uU2NhbGUob3V0LCBxLCB2LCBzKSB7XHJcbiAgLy8gUXVhdGVybmlvbiBtYXRoXHJcbiAgdmFyIHggPSBxWzBdLFxyXG4gICAgICB5ID0gcVsxXSxcclxuICAgICAgeiA9IHFbMl0sXHJcbiAgICAgIHcgPSBxWzNdO1xyXG4gIHZhciB4MiA9IHggKyB4O1xyXG4gIHZhciB5MiA9IHkgKyB5O1xyXG4gIHZhciB6MiA9IHogKyB6O1xyXG5cclxuICB2YXIgeHggPSB4ICogeDI7XHJcbiAgdmFyIHh5ID0geCAqIHkyO1xyXG4gIHZhciB4eiA9IHggKiB6MjtcclxuICB2YXIgeXkgPSB5ICogeTI7XHJcbiAgdmFyIHl6ID0geSAqIHoyO1xyXG4gIHZhciB6eiA9IHogKiB6MjtcclxuICB2YXIgd3ggPSB3ICogeDI7XHJcbiAgdmFyIHd5ID0gdyAqIHkyO1xyXG4gIHZhciB3eiA9IHcgKiB6MjtcclxuICB2YXIgc3ggPSBzWzBdO1xyXG4gIHZhciBzeSA9IHNbMV07XHJcbiAgdmFyIHN6ID0gc1syXTtcclxuXHJcbiAgb3V0WzBdID0gKDEgLSAoeXkgKyB6eikpICogc3g7XHJcbiAgb3V0WzFdID0gKHh5ICsgd3opICogc3g7XHJcbiAgb3V0WzJdID0gKHh6IC0gd3kpICogc3g7XHJcbiAgb3V0WzNdID0gMDtcclxuICBvdXRbNF0gPSAoeHkgLSB3eikgKiBzeTtcclxuICBvdXRbNV0gPSAoMSAtICh4eCArIHp6KSkgKiBzeTtcclxuICBvdXRbNl0gPSAoeXogKyB3eCkgKiBzeTtcclxuICBvdXRbN10gPSAwO1xyXG4gIG91dFs4XSA9ICh4eiArIHd5KSAqIHN6O1xyXG4gIG91dFs5XSA9ICh5eiAtIHd4KSAqIHN6O1xyXG4gIG91dFsxMF0gPSAoMSAtICh4eCArIHl5KSkgKiBzejtcclxuICBvdXRbMTFdID0gMDtcclxuICBvdXRbMTJdID0gdlswXTtcclxuICBvdXRbMTNdID0gdlsxXTtcclxuICBvdXRbMTRdID0gdlsyXTtcclxuICBvdXRbMTVdID0gMTtcclxuXHJcbiAgcmV0dXJuIG91dDtcclxufVxyXG5cclxuLyoqXHJcbiAqIENyZWF0ZXMgYSBtYXRyaXggZnJvbSBhIHF1YXRlcm5pb24gcm90YXRpb24sIHZlY3RvciB0cmFuc2xhdGlvbiBhbmQgdmVjdG9yIHNjYWxlLCByb3RhdGluZyBhbmQgc2NhbGluZyBhcm91bmQgdGhlIGdpdmVuIG9yaWdpblxyXG4gKiBUaGlzIGlzIGVxdWl2YWxlbnQgdG8gKGJ1dCBtdWNoIGZhc3RlciB0aGFuKTpcclxuICpcclxuICogICAgIG1hdDQuaWRlbnRpdHkoZGVzdCk7XHJcbiAqICAgICBtYXQ0LnRyYW5zbGF0ZShkZXN0LCB2ZWMpO1xyXG4gKiAgICAgbWF0NC50cmFuc2xhdGUoZGVzdCwgb3JpZ2luKTtcclxuICogICAgIGxldCBxdWF0TWF0ID0gbWF0NC5jcmVhdGUoKTtcclxuICogICAgIHF1YXQ0LnRvTWF0NChxdWF0LCBxdWF0TWF0KTtcclxuICogICAgIG1hdDQubXVsdGlwbHkoZGVzdCwgcXVhdE1hdCk7XHJcbiAqICAgICBtYXQ0LnNjYWxlKGRlc3QsIHNjYWxlKVxyXG4gKiAgICAgbWF0NC50cmFuc2xhdGUoZGVzdCwgbmVnYXRpdmVPcmlnaW4pO1xyXG4gKlxyXG4gKiBAcGFyYW0ge21hdDR9IG91dCBtYXQ0IHJlY2VpdmluZyBvcGVyYXRpb24gcmVzdWx0XHJcbiAqIEBwYXJhbSB7cXVhdDR9IHEgUm90YXRpb24gcXVhdGVybmlvblxyXG4gKiBAcGFyYW0ge3ZlYzN9IHYgVHJhbnNsYXRpb24gdmVjdG9yXHJcbiAqIEBwYXJhbSB7dmVjM30gcyBTY2FsaW5nIHZlY3RvclxyXG4gKiBAcGFyYW0ge3ZlYzN9IG8gVGhlIG9yaWdpbiB2ZWN0b3IgYXJvdW5kIHdoaWNoIHRvIHNjYWxlIGFuZCByb3RhdGVcclxuICogQHJldHVybnMge21hdDR9IG91dFxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGZyb21Sb3RhdGlvblRyYW5zbGF0aW9uU2NhbGVPcmlnaW4ob3V0LCBxLCB2LCBzLCBvKSB7XHJcbiAgLy8gUXVhdGVybmlvbiBtYXRoXHJcbiAgdmFyIHggPSBxWzBdLFxyXG4gICAgICB5ID0gcVsxXSxcclxuICAgICAgeiA9IHFbMl0sXHJcbiAgICAgIHcgPSBxWzNdO1xyXG4gIHZhciB4MiA9IHggKyB4O1xyXG4gIHZhciB5MiA9IHkgKyB5O1xyXG4gIHZhciB6MiA9IHogKyB6O1xyXG5cclxuICB2YXIgeHggPSB4ICogeDI7XHJcbiAgdmFyIHh5ID0geCAqIHkyO1xyXG4gIHZhciB4eiA9IHggKiB6MjtcclxuICB2YXIgeXkgPSB5ICogeTI7XHJcbiAgdmFyIHl6ID0geSAqIHoyO1xyXG4gIHZhciB6eiA9IHogKiB6MjtcclxuICB2YXIgd3ggPSB3ICogeDI7XHJcbiAgdmFyIHd5ID0gdyAqIHkyO1xyXG4gIHZhciB3eiA9IHcgKiB6MjtcclxuXHJcbiAgdmFyIHN4ID0gc1swXTtcclxuICB2YXIgc3kgPSBzWzFdO1xyXG4gIHZhciBzeiA9IHNbMl07XHJcblxyXG4gIHZhciBveCA9IG9bMF07XHJcbiAgdmFyIG95ID0gb1sxXTtcclxuICB2YXIgb3ogPSBvWzJdO1xyXG5cclxuICB2YXIgb3V0MCA9ICgxIC0gKHl5ICsgenopKSAqIHN4O1xyXG4gIHZhciBvdXQxID0gKHh5ICsgd3opICogc3g7XHJcbiAgdmFyIG91dDIgPSAoeHogLSB3eSkgKiBzeDtcclxuICB2YXIgb3V0NCA9ICh4eSAtIHd6KSAqIHN5O1xyXG4gIHZhciBvdXQ1ID0gKDEgLSAoeHggKyB6eikpICogc3k7XHJcbiAgdmFyIG91dDYgPSAoeXogKyB3eCkgKiBzeTtcclxuICB2YXIgb3V0OCA9ICh4eiArIHd5KSAqIHN6O1xyXG4gIHZhciBvdXQ5ID0gKHl6IC0gd3gpICogc3o7XHJcbiAgdmFyIG91dDEwID0gKDEgLSAoeHggKyB5eSkpICogc3o7XHJcblxyXG4gIG91dFswXSA9IG91dDA7XHJcbiAgb3V0WzFdID0gb3V0MTtcclxuICBvdXRbMl0gPSBvdXQyO1xyXG4gIG91dFszXSA9IDA7XHJcbiAgb3V0WzRdID0gb3V0NDtcclxuICBvdXRbNV0gPSBvdXQ1O1xyXG4gIG91dFs2XSA9IG91dDY7XHJcbiAgb3V0WzddID0gMDtcclxuICBvdXRbOF0gPSBvdXQ4O1xyXG4gIG91dFs5XSA9IG91dDk7XHJcbiAgb3V0WzEwXSA9IG91dDEwO1xyXG4gIG91dFsxMV0gPSAwO1xyXG4gIG91dFsxMl0gPSB2WzBdICsgb3ggLSAob3V0MCAqIG94ICsgb3V0NCAqIG95ICsgb3V0OCAqIG96KTtcclxuICBvdXRbMTNdID0gdlsxXSArIG95IC0gKG91dDEgKiBveCArIG91dDUgKiBveSArIG91dDkgKiBveik7XHJcbiAgb3V0WzE0XSA9IHZbMl0gKyBveiAtIChvdXQyICogb3ggKyBvdXQ2ICogb3kgKyBvdXQxMCAqIG96KTtcclxuICBvdXRbMTVdID0gMTtcclxuXHJcbiAgcmV0dXJuIG91dDtcclxufVxyXG5cclxuLyoqXHJcbiAqIENhbGN1bGF0ZXMgYSA0eDQgbWF0cml4IGZyb20gdGhlIGdpdmVuIHF1YXRlcm5pb25cclxuICpcclxuICogQHBhcmFtIHttYXQ0fSBvdXQgbWF0NCByZWNlaXZpbmcgb3BlcmF0aW9uIHJlc3VsdFxyXG4gKiBAcGFyYW0ge3F1YXR9IHEgUXVhdGVybmlvbiB0byBjcmVhdGUgbWF0cml4IGZyb21cclxuICpcclxuICogQHJldHVybnMge21hdDR9IG91dFxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGZyb21RdWF0KG91dCwgcSkge1xyXG4gIHZhciB4ID0gcVswXSxcclxuICAgICAgeSA9IHFbMV0sXHJcbiAgICAgIHogPSBxWzJdLFxyXG4gICAgICB3ID0gcVszXTtcclxuICB2YXIgeDIgPSB4ICsgeDtcclxuICB2YXIgeTIgPSB5ICsgeTtcclxuICB2YXIgejIgPSB6ICsgejtcclxuXHJcbiAgdmFyIHh4ID0geCAqIHgyO1xyXG4gIHZhciB5eCA9IHkgKiB4MjtcclxuICB2YXIgeXkgPSB5ICogeTI7XHJcbiAgdmFyIHp4ID0geiAqIHgyO1xyXG4gIHZhciB6eSA9IHogKiB5MjtcclxuICB2YXIgenogPSB6ICogejI7XHJcbiAgdmFyIHd4ID0gdyAqIHgyO1xyXG4gIHZhciB3eSA9IHcgKiB5MjtcclxuICB2YXIgd3ogPSB3ICogejI7XHJcblxyXG4gIG91dFswXSA9IDEgLSB5eSAtIHp6O1xyXG4gIG91dFsxXSA9IHl4ICsgd3o7XHJcbiAgb3V0WzJdID0genggLSB3eTtcclxuICBvdXRbM10gPSAwO1xyXG5cclxuICBvdXRbNF0gPSB5eCAtIHd6O1xyXG4gIG91dFs1XSA9IDEgLSB4eCAtIHp6O1xyXG4gIG91dFs2XSA9IHp5ICsgd3g7XHJcbiAgb3V0WzddID0gMDtcclxuXHJcbiAgb3V0WzhdID0genggKyB3eTtcclxuICBvdXRbOV0gPSB6eSAtIHd4O1xyXG4gIG91dFsxMF0gPSAxIC0geHggLSB5eTtcclxuICBvdXRbMTFdID0gMDtcclxuXHJcbiAgb3V0WzEyXSA9IDA7XHJcbiAgb3V0WzEzXSA9IDA7XHJcbiAgb3V0WzE0XSA9IDA7XHJcbiAgb3V0WzE1XSA9IDE7XHJcblxyXG4gIHJldHVybiBvdXQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBHZW5lcmF0ZXMgYSBmcnVzdHVtIG1hdHJpeCB3aXRoIHRoZSBnaXZlbiBib3VuZHNcclxuICpcclxuICogQHBhcmFtIHttYXQ0fSBvdXQgbWF0NCBmcnVzdHVtIG1hdHJpeCB3aWxsIGJlIHdyaXR0ZW4gaW50b1xyXG4gKiBAcGFyYW0ge051bWJlcn0gbGVmdCBMZWZ0IGJvdW5kIG9mIHRoZSBmcnVzdHVtXHJcbiAqIEBwYXJhbSB7TnVtYmVyfSByaWdodCBSaWdodCBib3VuZCBvZiB0aGUgZnJ1c3R1bVxyXG4gKiBAcGFyYW0ge051bWJlcn0gYm90dG9tIEJvdHRvbSBib3VuZCBvZiB0aGUgZnJ1c3R1bVxyXG4gKiBAcGFyYW0ge051bWJlcn0gdG9wIFRvcCBib3VuZCBvZiB0aGUgZnJ1c3R1bVxyXG4gKiBAcGFyYW0ge051bWJlcn0gbmVhciBOZWFyIGJvdW5kIG9mIHRoZSBmcnVzdHVtXHJcbiAqIEBwYXJhbSB7TnVtYmVyfSBmYXIgRmFyIGJvdW5kIG9mIHRoZSBmcnVzdHVtXHJcbiAqIEByZXR1cm5zIHttYXQ0fSBvdXRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBmcnVzdHVtKG91dCwgbGVmdCwgcmlnaHQsIGJvdHRvbSwgdG9wLCBuZWFyLCBmYXIpIHtcclxuICB2YXIgcmwgPSAxIC8gKHJpZ2h0IC0gbGVmdCk7XHJcbiAgdmFyIHRiID0gMSAvICh0b3AgLSBib3R0b20pO1xyXG4gIHZhciBuZiA9IDEgLyAobmVhciAtIGZhcik7XHJcbiAgb3V0WzBdID0gbmVhciAqIDIgKiBybDtcclxuICBvdXRbMV0gPSAwO1xyXG4gIG91dFsyXSA9IDA7XHJcbiAgb3V0WzNdID0gMDtcclxuICBvdXRbNF0gPSAwO1xyXG4gIG91dFs1XSA9IG5lYXIgKiAyICogdGI7XHJcbiAgb3V0WzZdID0gMDtcclxuICBvdXRbN10gPSAwO1xyXG4gIG91dFs4XSA9IChyaWdodCArIGxlZnQpICogcmw7XHJcbiAgb3V0WzldID0gKHRvcCArIGJvdHRvbSkgKiB0YjtcclxuICBvdXRbMTBdID0gKGZhciArIG5lYXIpICogbmY7XHJcbiAgb3V0WzExXSA9IC0xO1xyXG4gIG91dFsxMl0gPSAwO1xyXG4gIG91dFsxM10gPSAwO1xyXG4gIG91dFsxNF0gPSBmYXIgKiBuZWFyICogMiAqIG5mO1xyXG4gIG91dFsxNV0gPSAwO1xyXG4gIHJldHVybiBvdXQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBHZW5lcmF0ZXMgYSBwZXJzcGVjdGl2ZSBwcm9qZWN0aW9uIG1hdHJpeCB3aXRoIHRoZSBnaXZlbiBib3VuZHMuXHJcbiAqIFBhc3NpbmcgbnVsbC91bmRlZmluZWQvbm8gdmFsdWUgZm9yIGZhciB3aWxsIGdlbmVyYXRlIGluZmluaXRlIHByb2plY3Rpb24gbWF0cml4LlxyXG4gKlxyXG4gKiBAcGFyYW0ge21hdDR9IG91dCBtYXQ0IGZydXN0dW0gbWF0cml4IHdpbGwgYmUgd3JpdHRlbiBpbnRvXHJcbiAqIEBwYXJhbSB7bnVtYmVyfSBmb3Z5IFZlcnRpY2FsIGZpZWxkIG9mIHZpZXcgaW4gcmFkaWFuc1xyXG4gKiBAcGFyYW0ge251bWJlcn0gYXNwZWN0IEFzcGVjdCByYXRpby4gdHlwaWNhbGx5IHZpZXdwb3J0IHdpZHRoL2hlaWdodFxyXG4gKiBAcGFyYW0ge251bWJlcn0gbmVhciBOZWFyIGJvdW5kIG9mIHRoZSBmcnVzdHVtXHJcbiAqIEBwYXJhbSB7bnVtYmVyfSBmYXIgRmFyIGJvdW5kIG9mIHRoZSBmcnVzdHVtLCBjYW4gYmUgbnVsbCBvciBJbmZpbml0eVxyXG4gKiBAcmV0dXJucyB7bWF0NH0gb3V0XHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gcGVyc3BlY3RpdmUob3V0LCBmb3Z5LCBhc3BlY3QsIG5lYXIsIGZhcikge1xyXG4gIHZhciBmID0gMS4wIC8gTWF0aC50YW4oZm92eSAvIDIpLFxyXG4gICAgICBuZiA9IHZvaWQgMDtcclxuICBvdXRbMF0gPSBmIC8gYXNwZWN0O1xyXG4gIG91dFsxXSA9IDA7XHJcbiAgb3V0WzJdID0gMDtcclxuICBvdXRbM10gPSAwO1xyXG4gIG91dFs0XSA9IDA7XHJcbiAgb3V0WzVdID0gZjtcclxuICBvdXRbNl0gPSAwO1xyXG4gIG91dFs3XSA9IDA7XHJcbiAgb3V0WzhdID0gMDtcclxuICBvdXRbOV0gPSAwO1xyXG4gIG91dFsxMV0gPSAtMTtcclxuICBvdXRbMTJdID0gMDtcclxuICBvdXRbMTNdID0gMDtcclxuICBvdXRbMTVdID0gMDtcclxuICBpZiAoZmFyICE9IG51bGwgJiYgZmFyICE9PSBJbmZpbml0eSkge1xyXG4gICAgbmYgPSAxIC8gKG5lYXIgLSBmYXIpO1xyXG4gICAgb3V0WzEwXSA9IChmYXIgKyBuZWFyKSAqIG5mO1xyXG4gICAgb3V0WzE0XSA9IDIgKiBmYXIgKiBuZWFyICogbmY7XHJcbiAgfSBlbHNlIHtcclxuICAgIG91dFsxMF0gPSAtMTtcclxuICAgIG91dFsxNF0gPSAtMiAqIG5lYXI7XHJcbiAgfVxyXG4gIHJldHVybiBvdXQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBHZW5lcmF0ZXMgYSBwZXJzcGVjdGl2ZSBwcm9qZWN0aW9uIG1hdHJpeCB3aXRoIHRoZSBnaXZlbiBmaWVsZCBvZiB2aWV3LlxyXG4gKiBUaGlzIGlzIHByaW1hcmlseSB1c2VmdWwgZm9yIGdlbmVyYXRpbmcgcHJvamVjdGlvbiBtYXRyaWNlcyB0byBiZSB1c2VkXHJcbiAqIHdpdGggdGhlIHN0aWxsIGV4cGVyaWVtZW50YWwgV2ViVlIgQVBJLlxyXG4gKlxyXG4gKiBAcGFyYW0ge21hdDR9IG91dCBtYXQ0IGZydXN0dW0gbWF0cml4IHdpbGwgYmUgd3JpdHRlbiBpbnRvXHJcbiAqIEBwYXJhbSB7T2JqZWN0fSBmb3YgT2JqZWN0IGNvbnRhaW5pbmcgdGhlIGZvbGxvd2luZyB2YWx1ZXM6IHVwRGVncmVlcywgZG93bkRlZ3JlZXMsIGxlZnREZWdyZWVzLCByaWdodERlZ3JlZXNcclxuICogQHBhcmFtIHtudW1iZXJ9IG5lYXIgTmVhciBib3VuZCBvZiB0aGUgZnJ1c3R1bVxyXG4gKiBAcGFyYW0ge251bWJlcn0gZmFyIEZhciBib3VuZCBvZiB0aGUgZnJ1c3R1bVxyXG4gKiBAcmV0dXJucyB7bWF0NH0gb3V0XHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gcGVyc3BlY3RpdmVGcm9tRmllbGRPZlZpZXcob3V0LCBmb3YsIG5lYXIsIGZhcikge1xyXG4gIHZhciB1cFRhbiA9IE1hdGgudGFuKGZvdi51cERlZ3JlZXMgKiBNYXRoLlBJIC8gMTgwLjApO1xyXG4gIHZhciBkb3duVGFuID0gTWF0aC50YW4oZm92LmRvd25EZWdyZWVzICogTWF0aC5QSSAvIDE4MC4wKTtcclxuICB2YXIgbGVmdFRhbiA9IE1hdGgudGFuKGZvdi5sZWZ0RGVncmVlcyAqIE1hdGguUEkgLyAxODAuMCk7XHJcbiAgdmFyIHJpZ2h0VGFuID0gTWF0aC50YW4oZm92LnJpZ2h0RGVncmVlcyAqIE1hdGguUEkgLyAxODAuMCk7XHJcbiAgdmFyIHhTY2FsZSA9IDIuMCAvIChsZWZ0VGFuICsgcmlnaHRUYW4pO1xyXG4gIHZhciB5U2NhbGUgPSAyLjAgLyAodXBUYW4gKyBkb3duVGFuKTtcclxuXHJcbiAgb3V0WzBdID0geFNjYWxlO1xyXG4gIG91dFsxXSA9IDAuMDtcclxuICBvdXRbMl0gPSAwLjA7XHJcbiAgb3V0WzNdID0gMC4wO1xyXG4gIG91dFs0XSA9IDAuMDtcclxuICBvdXRbNV0gPSB5U2NhbGU7XHJcbiAgb3V0WzZdID0gMC4wO1xyXG4gIG91dFs3XSA9IDAuMDtcclxuICBvdXRbOF0gPSAtKChsZWZ0VGFuIC0gcmlnaHRUYW4pICogeFNjYWxlICogMC41KTtcclxuICBvdXRbOV0gPSAodXBUYW4gLSBkb3duVGFuKSAqIHlTY2FsZSAqIDAuNTtcclxuICBvdXRbMTBdID0gZmFyIC8gKG5lYXIgLSBmYXIpO1xyXG4gIG91dFsxMV0gPSAtMS4wO1xyXG4gIG91dFsxMl0gPSAwLjA7XHJcbiAgb3V0WzEzXSA9IDAuMDtcclxuICBvdXRbMTRdID0gZmFyICogbmVhciAvIChuZWFyIC0gZmFyKTtcclxuICBvdXRbMTVdID0gMC4wO1xyXG4gIHJldHVybiBvdXQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBHZW5lcmF0ZXMgYSBvcnRob2dvbmFsIHByb2plY3Rpb24gbWF0cml4IHdpdGggdGhlIGdpdmVuIGJvdW5kc1xyXG4gKlxyXG4gKiBAcGFyYW0ge21hdDR9IG91dCBtYXQ0IGZydXN0dW0gbWF0cml4IHdpbGwgYmUgd3JpdHRlbiBpbnRvXHJcbiAqIEBwYXJhbSB7bnVtYmVyfSBsZWZ0IExlZnQgYm91bmQgb2YgdGhlIGZydXN0dW1cclxuICogQHBhcmFtIHtudW1iZXJ9IHJpZ2h0IFJpZ2h0IGJvdW5kIG9mIHRoZSBmcnVzdHVtXHJcbiAqIEBwYXJhbSB7bnVtYmVyfSBib3R0b20gQm90dG9tIGJvdW5kIG9mIHRoZSBmcnVzdHVtXHJcbiAqIEBwYXJhbSB7bnVtYmVyfSB0b3AgVG9wIGJvdW5kIG9mIHRoZSBmcnVzdHVtXHJcbiAqIEBwYXJhbSB7bnVtYmVyfSBuZWFyIE5lYXIgYm91bmQgb2YgdGhlIGZydXN0dW1cclxuICogQHBhcmFtIHtudW1iZXJ9IGZhciBGYXIgYm91bmQgb2YgdGhlIGZydXN0dW1cclxuICogQHJldHVybnMge21hdDR9IG91dFxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIG9ydGhvKG91dCwgbGVmdCwgcmlnaHQsIGJvdHRvbSwgdG9wLCBuZWFyLCBmYXIpIHtcclxuICB2YXIgbHIgPSAxIC8gKGxlZnQgLSByaWdodCk7XHJcbiAgdmFyIGJ0ID0gMSAvIChib3R0b20gLSB0b3ApO1xyXG4gIHZhciBuZiA9IDEgLyAobmVhciAtIGZhcik7XHJcbiAgb3V0WzBdID0gLTIgKiBscjtcclxuICBvdXRbMV0gPSAwO1xyXG4gIG91dFsyXSA9IDA7XHJcbiAgb3V0WzNdID0gMDtcclxuICBvdXRbNF0gPSAwO1xyXG4gIG91dFs1XSA9IC0yICogYnQ7XHJcbiAgb3V0WzZdID0gMDtcclxuICBvdXRbN10gPSAwO1xyXG4gIG91dFs4XSA9IDA7XHJcbiAgb3V0WzldID0gMDtcclxuICBvdXRbMTBdID0gMiAqIG5mO1xyXG4gIG91dFsxMV0gPSAwO1xyXG4gIG91dFsxMl0gPSAobGVmdCArIHJpZ2h0KSAqIGxyO1xyXG4gIG91dFsxM10gPSAodG9wICsgYm90dG9tKSAqIGJ0O1xyXG4gIG91dFsxNF0gPSAoZmFyICsgbmVhcikgKiBuZjtcclxuICBvdXRbMTVdID0gMTtcclxuICByZXR1cm4gb3V0O1xyXG59XHJcblxyXG4vKipcclxuICogR2VuZXJhdGVzIGEgbG9vay1hdCBtYXRyaXggd2l0aCB0aGUgZ2l2ZW4gZXllIHBvc2l0aW9uLCBmb2NhbCBwb2ludCwgYW5kIHVwIGF4aXMuXHJcbiAqIElmIHlvdSB3YW50IGEgbWF0cml4IHRoYXQgYWN0dWFsbHkgbWFrZXMgYW4gb2JqZWN0IGxvb2sgYXQgYW5vdGhlciBvYmplY3QsIHlvdSBzaG91bGQgdXNlIHRhcmdldFRvIGluc3RlYWQuXHJcbiAqXHJcbiAqIEBwYXJhbSB7bWF0NH0gb3V0IG1hdDQgZnJ1c3R1bSBtYXRyaXggd2lsbCBiZSB3cml0dGVuIGludG9cclxuICogQHBhcmFtIHt2ZWMzfSBleWUgUG9zaXRpb24gb2YgdGhlIHZpZXdlclxyXG4gKiBAcGFyYW0ge3ZlYzN9IGNlbnRlciBQb2ludCB0aGUgdmlld2VyIGlzIGxvb2tpbmcgYXRcclxuICogQHBhcmFtIHt2ZWMzfSB1cCB2ZWMzIHBvaW50aW5nIHVwXHJcbiAqIEByZXR1cm5zIHttYXQ0fSBvdXRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBsb29rQXQob3V0LCBleWUsIGNlbnRlciwgdXApIHtcclxuICB2YXIgeDAgPSB2b2lkIDAsXHJcbiAgICAgIHgxID0gdm9pZCAwLFxyXG4gICAgICB4MiA9IHZvaWQgMCxcclxuICAgICAgeTAgPSB2b2lkIDAsXHJcbiAgICAgIHkxID0gdm9pZCAwLFxyXG4gICAgICB5MiA9IHZvaWQgMCxcclxuICAgICAgejAgPSB2b2lkIDAsXHJcbiAgICAgIHoxID0gdm9pZCAwLFxyXG4gICAgICB6MiA9IHZvaWQgMCxcclxuICAgICAgbGVuID0gdm9pZCAwO1xyXG4gIHZhciBleWV4ID0gZXllWzBdO1xyXG4gIHZhciBleWV5ID0gZXllWzFdO1xyXG4gIHZhciBleWV6ID0gZXllWzJdO1xyXG4gIHZhciB1cHggPSB1cFswXTtcclxuICB2YXIgdXB5ID0gdXBbMV07XHJcbiAgdmFyIHVweiA9IHVwWzJdO1xyXG4gIHZhciBjZW50ZXJ4ID0gY2VudGVyWzBdO1xyXG4gIHZhciBjZW50ZXJ5ID0gY2VudGVyWzFdO1xyXG4gIHZhciBjZW50ZXJ6ID0gY2VudGVyWzJdO1xyXG5cclxuICBpZiAoTWF0aC5hYnMoZXlleCAtIGNlbnRlcngpIDwgZ2xNYXRyaXguRVBTSUxPTiAmJiBNYXRoLmFicyhleWV5IC0gY2VudGVyeSkgPCBnbE1hdHJpeC5FUFNJTE9OICYmIE1hdGguYWJzKGV5ZXogLSBjZW50ZXJ6KSA8IGdsTWF0cml4LkVQU0lMT04pIHtcclxuICAgIHJldHVybiBpZGVudGl0eShvdXQpO1xyXG4gIH1cclxuXHJcbiAgejAgPSBleWV4IC0gY2VudGVyeDtcclxuICB6MSA9IGV5ZXkgLSBjZW50ZXJ5O1xyXG4gIHoyID0gZXlleiAtIGNlbnRlcno7XHJcblxyXG4gIGxlbiA9IDEgLyBNYXRoLnNxcnQoejAgKiB6MCArIHoxICogejEgKyB6MiAqIHoyKTtcclxuICB6MCAqPSBsZW47XHJcbiAgejEgKj0gbGVuO1xyXG4gIHoyICo9IGxlbjtcclxuXHJcbiAgeDAgPSB1cHkgKiB6MiAtIHVweiAqIHoxO1xyXG4gIHgxID0gdXB6ICogejAgLSB1cHggKiB6MjtcclxuICB4MiA9IHVweCAqIHoxIC0gdXB5ICogejA7XHJcbiAgbGVuID0gTWF0aC5zcXJ0KHgwICogeDAgKyB4MSAqIHgxICsgeDIgKiB4Mik7XHJcbiAgaWYgKCFsZW4pIHtcclxuICAgIHgwID0gMDtcclxuICAgIHgxID0gMDtcclxuICAgIHgyID0gMDtcclxuICB9IGVsc2Uge1xyXG4gICAgbGVuID0gMSAvIGxlbjtcclxuICAgIHgwICo9IGxlbjtcclxuICAgIHgxICo9IGxlbjtcclxuICAgIHgyICo9IGxlbjtcclxuICB9XHJcblxyXG4gIHkwID0gejEgKiB4MiAtIHoyICogeDE7XHJcbiAgeTEgPSB6MiAqIHgwIC0gejAgKiB4MjtcclxuICB5MiA9IHowICogeDEgLSB6MSAqIHgwO1xyXG5cclxuICBsZW4gPSBNYXRoLnNxcnQoeTAgKiB5MCArIHkxICogeTEgKyB5MiAqIHkyKTtcclxuICBpZiAoIWxlbikge1xyXG4gICAgeTAgPSAwO1xyXG4gICAgeTEgPSAwO1xyXG4gICAgeTIgPSAwO1xyXG4gIH0gZWxzZSB7XHJcbiAgICBsZW4gPSAxIC8gbGVuO1xyXG4gICAgeTAgKj0gbGVuO1xyXG4gICAgeTEgKj0gbGVuO1xyXG4gICAgeTIgKj0gbGVuO1xyXG4gIH1cclxuXHJcbiAgb3V0WzBdID0geDA7XHJcbiAgb3V0WzFdID0geTA7XHJcbiAgb3V0WzJdID0gejA7XHJcbiAgb3V0WzNdID0gMDtcclxuICBvdXRbNF0gPSB4MTtcclxuICBvdXRbNV0gPSB5MTtcclxuICBvdXRbNl0gPSB6MTtcclxuICBvdXRbN10gPSAwO1xyXG4gIG91dFs4XSA9IHgyO1xyXG4gIG91dFs5XSA9IHkyO1xyXG4gIG91dFsxMF0gPSB6MjtcclxuICBvdXRbMTFdID0gMDtcclxuICBvdXRbMTJdID0gLSh4MCAqIGV5ZXggKyB4MSAqIGV5ZXkgKyB4MiAqIGV5ZXopO1xyXG4gIG91dFsxM10gPSAtKHkwICogZXlleCArIHkxICogZXlleSArIHkyICogZXlleik7XHJcbiAgb3V0WzE0XSA9IC0oejAgKiBleWV4ICsgejEgKiBleWV5ICsgejIgKiBleWV6KTtcclxuICBvdXRbMTVdID0gMTtcclxuXHJcbiAgcmV0dXJuIG91dDtcclxufVxyXG5cclxuLyoqXHJcbiAqIEdlbmVyYXRlcyBhIG1hdHJpeCB0aGF0IG1ha2VzIHNvbWV0aGluZyBsb29rIGF0IHNvbWV0aGluZyBlbHNlLlxyXG4gKlxyXG4gKiBAcGFyYW0ge21hdDR9IG91dCBtYXQ0IGZydXN0dW0gbWF0cml4IHdpbGwgYmUgd3JpdHRlbiBpbnRvXHJcbiAqIEBwYXJhbSB7dmVjM30gZXllIFBvc2l0aW9uIG9mIHRoZSB2aWV3ZXJcclxuICogQHBhcmFtIHt2ZWMzfSBjZW50ZXIgUG9pbnQgdGhlIHZpZXdlciBpcyBsb29raW5nIGF0XHJcbiAqIEBwYXJhbSB7dmVjM30gdXAgdmVjMyBwb2ludGluZyB1cFxyXG4gKiBAcmV0dXJucyB7bWF0NH0gb3V0XHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gdGFyZ2V0VG8ob3V0LCBleWUsIHRhcmdldCwgdXApIHtcclxuICB2YXIgZXlleCA9IGV5ZVswXSxcclxuICAgICAgZXlleSA9IGV5ZVsxXSxcclxuICAgICAgZXlleiA9IGV5ZVsyXSxcclxuICAgICAgdXB4ID0gdXBbMF0sXHJcbiAgICAgIHVweSA9IHVwWzFdLFxyXG4gICAgICB1cHogPSB1cFsyXTtcclxuXHJcbiAgdmFyIHowID0gZXlleCAtIHRhcmdldFswXSxcclxuICAgICAgejEgPSBleWV5IC0gdGFyZ2V0WzFdLFxyXG4gICAgICB6MiA9IGV5ZXogLSB0YXJnZXRbMl07XHJcblxyXG4gIHZhciBsZW4gPSB6MCAqIHowICsgejEgKiB6MSArIHoyICogejI7XHJcbiAgaWYgKGxlbiA+IDApIHtcclxuICAgIGxlbiA9IDEgLyBNYXRoLnNxcnQobGVuKTtcclxuICAgIHowICo9IGxlbjtcclxuICAgIHoxICo9IGxlbjtcclxuICAgIHoyICo9IGxlbjtcclxuICB9XHJcblxyXG4gIHZhciB4MCA9IHVweSAqIHoyIC0gdXB6ICogejEsXHJcbiAgICAgIHgxID0gdXB6ICogejAgLSB1cHggKiB6MixcclxuICAgICAgeDIgPSB1cHggKiB6MSAtIHVweSAqIHowO1xyXG5cclxuICBsZW4gPSB4MCAqIHgwICsgeDEgKiB4MSArIHgyICogeDI7XHJcbiAgaWYgKGxlbiA+IDApIHtcclxuICAgIGxlbiA9IDEgLyBNYXRoLnNxcnQobGVuKTtcclxuICAgIHgwICo9IGxlbjtcclxuICAgIHgxICo9IGxlbjtcclxuICAgIHgyICo9IGxlbjtcclxuICB9XHJcblxyXG4gIG91dFswXSA9IHgwO1xyXG4gIG91dFsxXSA9IHgxO1xyXG4gIG91dFsyXSA9IHgyO1xyXG4gIG91dFszXSA9IDA7XHJcbiAgb3V0WzRdID0gejEgKiB4MiAtIHoyICogeDE7XHJcbiAgb3V0WzVdID0gejIgKiB4MCAtIHowICogeDI7XHJcbiAgb3V0WzZdID0gejAgKiB4MSAtIHoxICogeDA7XHJcbiAgb3V0WzddID0gMDtcclxuICBvdXRbOF0gPSB6MDtcclxuICBvdXRbOV0gPSB6MTtcclxuICBvdXRbMTBdID0gejI7XHJcbiAgb3V0WzExXSA9IDA7XHJcbiAgb3V0WzEyXSA9IGV5ZXg7XHJcbiAgb3V0WzEzXSA9IGV5ZXk7XHJcbiAgb3V0WzE0XSA9IGV5ZXo7XHJcbiAgb3V0WzE1XSA9IDE7XHJcbiAgcmV0dXJuIG91dDtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBSZXR1cm5zIGEgc3RyaW5nIHJlcHJlc2VudGF0aW9uIG9mIGEgbWF0NFxyXG4gKlxyXG4gKiBAcGFyYW0ge21hdDR9IGEgbWF0cml4IHRvIHJlcHJlc2VudCBhcyBhIHN0cmluZ1xyXG4gKiBAcmV0dXJucyB7U3RyaW5nfSBzdHJpbmcgcmVwcmVzZW50YXRpb24gb2YgdGhlIG1hdHJpeFxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIHN0cihhKSB7XHJcbiAgcmV0dXJuICdtYXQ0KCcgKyBhWzBdICsgJywgJyArIGFbMV0gKyAnLCAnICsgYVsyXSArICcsICcgKyBhWzNdICsgJywgJyArIGFbNF0gKyAnLCAnICsgYVs1XSArICcsICcgKyBhWzZdICsgJywgJyArIGFbN10gKyAnLCAnICsgYVs4XSArICcsICcgKyBhWzldICsgJywgJyArIGFbMTBdICsgJywgJyArIGFbMTFdICsgJywgJyArIGFbMTJdICsgJywgJyArIGFbMTNdICsgJywgJyArIGFbMTRdICsgJywgJyArIGFbMTVdICsgJyknO1xyXG59XHJcblxyXG4vKipcclxuICogUmV0dXJucyBGcm9iZW5pdXMgbm9ybSBvZiBhIG1hdDRcclxuICpcclxuICogQHBhcmFtIHttYXQ0fSBhIHRoZSBtYXRyaXggdG8gY2FsY3VsYXRlIEZyb2Jlbml1cyBub3JtIG9mXHJcbiAqIEByZXR1cm5zIHtOdW1iZXJ9IEZyb2Jlbml1cyBub3JtXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gZnJvYihhKSB7XHJcbiAgcmV0dXJuIE1hdGguc3FydChNYXRoLnBvdyhhWzBdLCAyKSArIE1hdGgucG93KGFbMV0sIDIpICsgTWF0aC5wb3coYVsyXSwgMikgKyBNYXRoLnBvdyhhWzNdLCAyKSArIE1hdGgucG93KGFbNF0sIDIpICsgTWF0aC5wb3coYVs1XSwgMikgKyBNYXRoLnBvdyhhWzZdLCAyKSArIE1hdGgucG93KGFbN10sIDIpICsgTWF0aC5wb3coYVs4XSwgMikgKyBNYXRoLnBvdyhhWzldLCAyKSArIE1hdGgucG93KGFbMTBdLCAyKSArIE1hdGgucG93KGFbMTFdLCAyKSArIE1hdGgucG93KGFbMTJdLCAyKSArIE1hdGgucG93KGFbMTNdLCAyKSArIE1hdGgucG93KGFbMTRdLCAyKSArIE1hdGgucG93KGFbMTVdLCAyKSk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBBZGRzIHR3byBtYXQ0J3NcclxuICpcclxuICogQHBhcmFtIHttYXQ0fSBvdXQgdGhlIHJlY2VpdmluZyBtYXRyaXhcclxuICogQHBhcmFtIHttYXQ0fSBhIHRoZSBmaXJzdCBvcGVyYW5kXHJcbiAqIEBwYXJhbSB7bWF0NH0gYiB0aGUgc2Vjb25kIG9wZXJhbmRcclxuICogQHJldHVybnMge21hdDR9IG91dFxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGFkZChvdXQsIGEsIGIpIHtcclxuICBvdXRbMF0gPSBhWzBdICsgYlswXTtcclxuICBvdXRbMV0gPSBhWzFdICsgYlsxXTtcclxuICBvdXRbMl0gPSBhWzJdICsgYlsyXTtcclxuICBvdXRbM10gPSBhWzNdICsgYlszXTtcclxuICBvdXRbNF0gPSBhWzRdICsgYls0XTtcclxuICBvdXRbNV0gPSBhWzVdICsgYls1XTtcclxuICBvdXRbNl0gPSBhWzZdICsgYls2XTtcclxuICBvdXRbN10gPSBhWzddICsgYls3XTtcclxuICBvdXRbOF0gPSBhWzhdICsgYls4XTtcclxuICBvdXRbOV0gPSBhWzldICsgYls5XTtcclxuICBvdXRbMTBdID0gYVsxMF0gKyBiWzEwXTtcclxuICBvdXRbMTFdID0gYVsxMV0gKyBiWzExXTtcclxuICBvdXRbMTJdID0gYVsxMl0gKyBiWzEyXTtcclxuICBvdXRbMTNdID0gYVsxM10gKyBiWzEzXTtcclxuICBvdXRbMTRdID0gYVsxNF0gKyBiWzE0XTtcclxuICBvdXRbMTVdID0gYVsxNV0gKyBiWzE1XTtcclxuICByZXR1cm4gb3V0O1xyXG59XHJcblxyXG4vKipcclxuICogU3VidHJhY3RzIG1hdHJpeCBiIGZyb20gbWF0cml4IGFcclxuICpcclxuICogQHBhcmFtIHttYXQ0fSBvdXQgdGhlIHJlY2VpdmluZyBtYXRyaXhcclxuICogQHBhcmFtIHttYXQ0fSBhIHRoZSBmaXJzdCBvcGVyYW5kXHJcbiAqIEBwYXJhbSB7bWF0NH0gYiB0aGUgc2Vjb25kIG9wZXJhbmRcclxuICogQHJldHVybnMge21hdDR9IG91dFxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIHN1YnRyYWN0KG91dCwgYSwgYikge1xyXG4gIG91dFswXSA9IGFbMF0gLSBiWzBdO1xyXG4gIG91dFsxXSA9IGFbMV0gLSBiWzFdO1xyXG4gIG91dFsyXSA9IGFbMl0gLSBiWzJdO1xyXG4gIG91dFszXSA9IGFbM10gLSBiWzNdO1xyXG4gIG91dFs0XSA9IGFbNF0gLSBiWzRdO1xyXG4gIG91dFs1XSA9IGFbNV0gLSBiWzVdO1xyXG4gIG91dFs2XSA9IGFbNl0gLSBiWzZdO1xyXG4gIG91dFs3XSA9IGFbN10gLSBiWzddO1xyXG4gIG91dFs4XSA9IGFbOF0gLSBiWzhdO1xyXG4gIG91dFs5XSA9IGFbOV0gLSBiWzldO1xyXG4gIG91dFsxMF0gPSBhWzEwXSAtIGJbMTBdO1xyXG4gIG91dFsxMV0gPSBhWzExXSAtIGJbMTFdO1xyXG4gIG91dFsxMl0gPSBhWzEyXSAtIGJbMTJdO1xyXG4gIG91dFsxM10gPSBhWzEzXSAtIGJbMTNdO1xyXG4gIG91dFsxNF0gPSBhWzE0XSAtIGJbMTRdO1xyXG4gIG91dFsxNV0gPSBhWzE1XSAtIGJbMTVdO1xyXG4gIHJldHVybiBvdXQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBNdWx0aXBseSBlYWNoIGVsZW1lbnQgb2YgdGhlIG1hdHJpeCBieSBhIHNjYWxhci5cclxuICpcclxuICogQHBhcmFtIHttYXQ0fSBvdXQgdGhlIHJlY2VpdmluZyBtYXRyaXhcclxuICogQHBhcmFtIHttYXQ0fSBhIHRoZSBtYXRyaXggdG8gc2NhbGVcclxuICogQHBhcmFtIHtOdW1iZXJ9IGIgYW1vdW50IHRvIHNjYWxlIHRoZSBtYXRyaXgncyBlbGVtZW50cyBieVxyXG4gKiBAcmV0dXJucyB7bWF0NH0gb3V0XHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gbXVsdGlwbHlTY2FsYXIob3V0LCBhLCBiKSB7XHJcbiAgb3V0WzBdID0gYVswXSAqIGI7XHJcbiAgb3V0WzFdID0gYVsxXSAqIGI7XHJcbiAgb3V0WzJdID0gYVsyXSAqIGI7XHJcbiAgb3V0WzNdID0gYVszXSAqIGI7XHJcbiAgb3V0WzRdID0gYVs0XSAqIGI7XHJcbiAgb3V0WzVdID0gYVs1XSAqIGI7XHJcbiAgb3V0WzZdID0gYVs2XSAqIGI7XHJcbiAgb3V0WzddID0gYVs3XSAqIGI7XHJcbiAgb3V0WzhdID0gYVs4XSAqIGI7XHJcbiAgb3V0WzldID0gYVs5XSAqIGI7XHJcbiAgb3V0WzEwXSA9IGFbMTBdICogYjtcclxuICBvdXRbMTFdID0gYVsxMV0gKiBiO1xyXG4gIG91dFsxMl0gPSBhWzEyXSAqIGI7XHJcbiAgb3V0WzEzXSA9IGFbMTNdICogYjtcclxuICBvdXRbMTRdID0gYVsxNF0gKiBiO1xyXG4gIG91dFsxNV0gPSBhWzE1XSAqIGI7XHJcbiAgcmV0dXJuIG91dDtcclxufVxyXG5cclxuLyoqXHJcbiAqIEFkZHMgdHdvIG1hdDQncyBhZnRlciBtdWx0aXBseWluZyBlYWNoIGVsZW1lbnQgb2YgdGhlIHNlY29uZCBvcGVyYW5kIGJ5IGEgc2NhbGFyIHZhbHVlLlxyXG4gKlxyXG4gKiBAcGFyYW0ge21hdDR9IG91dCB0aGUgcmVjZWl2aW5nIHZlY3RvclxyXG4gKiBAcGFyYW0ge21hdDR9IGEgdGhlIGZpcnN0IG9wZXJhbmRcclxuICogQHBhcmFtIHttYXQ0fSBiIHRoZSBzZWNvbmQgb3BlcmFuZFxyXG4gKiBAcGFyYW0ge051bWJlcn0gc2NhbGUgdGhlIGFtb3VudCB0byBzY2FsZSBiJ3MgZWxlbWVudHMgYnkgYmVmb3JlIGFkZGluZ1xyXG4gKiBAcmV0dXJucyB7bWF0NH0gb3V0XHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gbXVsdGlwbHlTY2FsYXJBbmRBZGQob3V0LCBhLCBiLCBzY2FsZSkge1xyXG4gIG91dFswXSA9IGFbMF0gKyBiWzBdICogc2NhbGU7XHJcbiAgb3V0WzFdID0gYVsxXSArIGJbMV0gKiBzY2FsZTtcclxuICBvdXRbMl0gPSBhWzJdICsgYlsyXSAqIHNjYWxlO1xyXG4gIG91dFszXSA9IGFbM10gKyBiWzNdICogc2NhbGU7XHJcbiAgb3V0WzRdID0gYVs0XSArIGJbNF0gKiBzY2FsZTtcclxuICBvdXRbNV0gPSBhWzVdICsgYls1XSAqIHNjYWxlO1xyXG4gIG91dFs2XSA9IGFbNl0gKyBiWzZdICogc2NhbGU7XHJcbiAgb3V0WzddID0gYVs3XSArIGJbN10gKiBzY2FsZTtcclxuICBvdXRbOF0gPSBhWzhdICsgYls4XSAqIHNjYWxlO1xyXG4gIG91dFs5XSA9IGFbOV0gKyBiWzldICogc2NhbGU7XHJcbiAgb3V0WzEwXSA9IGFbMTBdICsgYlsxMF0gKiBzY2FsZTtcclxuICBvdXRbMTFdID0gYVsxMV0gKyBiWzExXSAqIHNjYWxlO1xyXG4gIG91dFsxMl0gPSBhWzEyXSArIGJbMTJdICogc2NhbGU7XHJcbiAgb3V0WzEzXSA9IGFbMTNdICsgYlsxM10gKiBzY2FsZTtcclxuICBvdXRbMTRdID0gYVsxNF0gKyBiWzE0XSAqIHNjYWxlO1xyXG4gIG91dFsxNV0gPSBhWzE1XSArIGJbMTVdICogc2NhbGU7XHJcbiAgcmV0dXJuIG91dDtcclxufVxyXG5cclxuLyoqXHJcbiAqIFJldHVybnMgd2hldGhlciBvciBub3QgdGhlIG1hdHJpY2VzIGhhdmUgZXhhY3RseSB0aGUgc2FtZSBlbGVtZW50cyBpbiB0aGUgc2FtZSBwb3NpdGlvbiAod2hlbiBjb21wYXJlZCB3aXRoID09PSlcclxuICpcclxuICogQHBhcmFtIHttYXQ0fSBhIFRoZSBmaXJzdCBtYXRyaXguXHJcbiAqIEBwYXJhbSB7bWF0NH0gYiBUaGUgc2Vjb25kIG1hdHJpeC5cclxuICogQHJldHVybnMge0Jvb2xlYW59IFRydWUgaWYgdGhlIG1hdHJpY2VzIGFyZSBlcXVhbCwgZmFsc2Ugb3RoZXJ3aXNlLlxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGV4YWN0RXF1YWxzKGEsIGIpIHtcclxuICByZXR1cm4gYVswXSA9PT0gYlswXSAmJiBhWzFdID09PSBiWzFdICYmIGFbMl0gPT09IGJbMl0gJiYgYVszXSA9PT0gYlszXSAmJiBhWzRdID09PSBiWzRdICYmIGFbNV0gPT09IGJbNV0gJiYgYVs2XSA9PT0gYls2XSAmJiBhWzddID09PSBiWzddICYmIGFbOF0gPT09IGJbOF0gJiYgYVs5XSA9PT0gYls5XSAmJiBhWzEwXSA9PT0gYlsxMF0gJiYgYVsxMV0gPT09IGJbMTFdICYmIGFbMTJdID09PSBiWzEyXSAmJiBhWzEzXSA9PT0gYlsxM10gJiYgYVsxNF0gPT09IGJbMTRdICYmIGFbMTVdID09PSBiWzE1XTtcclxufVxyXG5cclxuLyoqXHJcbiAqIFJldHVybnMgd2hldGhlciBvciBub3QgdGhlIG1hdHJpY2VzIGhhdmUgYXBwcm94aW1hdGVseSB0aGUgc2FtZSBlbGVtZW50cyBpbiB0aGUgc2FtZSBwb3NpdGlvbi5cclxuICpcclxuICogQHBhcmFtIHttYXQ0fSBhIFRoZSBmaXJzdCBtYXRyaXguXHJcbiAqIEBwYXJhbSB7bWF0NH0gYiBUaGUgc2Vjb25kIG1hdHJpeC5cclxuICogQHJldHVybnMge0Jvb2xlYW59IFRydWUgaWYgdGhlIG1hdHJpY2VzIGFyZSBlcXVhbCwgZmFsc2Ugb3RoZXJ3aXNlLlxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGVxdWFscyhhLCBiKSB7XHJcbiAgdmFyIGEwID0gYVswXSxcclxuICAgICAgYTEgPSBhWzFdLFxyXG4gICAgICBhMiA9IGFbMl0sXHJcbiAgICAgIGEzID0gYVszXTtcclxuICB2YXIgYTQgPSBhWzRdLFxyXG4gICAgICBhNSA9IGFbNV0sXHJcbiAgICAgIGE2ID0gYVs2XSxcclxuICAgICAgYTcgPSBhWzddO1xyXG4gIHZhciBhOCA9IGFbOF0sXHJcbiAgICAgIGE5ID0gYVs5XSxcclxuICAgICAgYTEwID0gYVsxMF0sXHJcbiAgICAgIGExMSA9IGFbMTFdO1xyXG4gIHZhciBhMTIgPSBhWzEyXSxcclxuICAgICAgYTEzID0gYVsxM10sXHJcbiAgICAgIGExNCA9IGFbMTRdLFxyXG4gICAgICBhMTUgPSBhWzE1XTtcclxuXHJcbiAgdmFyIGIwID0gYlswXSxcclxuICAgICAgYjEgPSBiWzFdLFxyXG4gICAgICBiMiA9IGJbMl0sXHJcbiAgICAgIGIzID0gYlszXTtcclxuICB2YXIgYjQgPSBiWzRdLFxyXG4gICAgICBiNSA9IGJbNV0sXHJcbiAgICAgIGI2ID0gYls2XSxcclxuICAgICAgYjcgPSBiWzddO1xyXG4gIHZhciBiOCA9IGJbOF0sXHJcbiAgICAgIGI5ID0gYls5XSxcclxuICAgICAgYjEwID0gYlsxMF0sXHJcbiAgICAgIGIxMSA9IGJbMTFdO1xyXG4gIHZhciBiMTIgPSBiWzEyXSxcclxuICAgICAgYjEzID0gYlsxM10sXHJcbiAgICAgIGIxNCA9IGJbMTRdLFxyXG4gICAgICBiMTUgPSBiWzE1XTtcclxuXHJcbiAgcmV0dXJuIE1hdGguYWJzKGEwIC0gYjApIDw9IGdsTWF0cml4LkVQU0lMT04gKiBNYXRoLm1heCgxLjAsIE1hdGguYWJzKGEwKSwgTWF0aC5hYnMoYjApKSAmJiBNYXRoLmFicyhhMSAtIGIxKSA8PSBnbE1hdHJpeC5FUFNJTE9OICogTWF0aC5tYXgoMS4wLCBNYXRoLmFicyhhMSksIE1hdGguYWJzKGIxKSkgJiYgTWF0aC5hYnMoYTIgLSBiMikgPD0gZ2xNYXRyaXguRVBTSUxPTiAqIE1hdGgubWF4KDEuMCwgTWF0aC5hYnMoYTIpLCBNYXRoLmFicyhiMikpICYmIE1hdGguYWJzKGEzIC0gYjMpIDw9IGdsTWF0cml4LkVQU0lMT04gKiBNYXRoLm1heCgxLjAsIE1hdGguYWJzKGEzKSwgTWF0aC5hYnMoYjMpKSAmJiBNYXRoLmFicyhhNCAtIGI0KSA8PSBnbE1hdHJpeC5FUFNJTE9OICogTWF0aC5tYXgoMS4wLCBNYXRoLmFicyhhNCksIE1hdGguYWJzKGI0KSkgJiYgTWF0aC5hYnMoYTUgLSBiNSkgPD0gZ2xNYXRyaXguRVBTSUxPTiAqIE1hdGgubWF4KDEuMCwgTWF0aC5hYnMoYTUpLCBNYXRoLmFicyhiNSkpICYmIE1hdGguYWJzKGE2IC0gYjYpIDw9IGdsTWF0cml4LkVQU0lMT04gKiBNYXRoLm1heCgxLjAsIE1hdGguYWJzKGE2KSwgTWF0aC5hYnMoYjYpKSAmJiBNYXRoLmFicyhhNyAtIGI3KSA8PSBnbE1hdHJpeC5FUFNJTE9OICogTWF0aC5tYXgoMS4wLCBNYXRoLmFicyhhNyksIE1hdGguYWJzKGI3KSkgJiYgTWF0aC5hYnMoYTggLSBiOCkgPD0gZ2xNYXRyaXguRVBTSUxPTiAqIE1hdGgubWF4KDEuMCwgTWF0aC5hYnMoYTgpLCBNYXRoLmFicyhiOCkpICYmIE1hdGguYWJzKGE5IC0gYjkpIDw9IGdsTWF0cml4LkVQU0lMT04gKiBNYXRoLm1heCgxLjAsIE1hdGguYWJzKGE5KSwgTWF0aC5hYnMoYjkpKSAmJiBNYXRoLmFicyhhMTAgLSBiMTApIDw9IGdsTWF0cml4LkVQU0lMT04gKiBNYXRoLm1heCgxLjAsIE1hdGguYWJzKGExMCksIE1hdGguYWJzKGIxMCkpICYmIE1hdGguYWJzKGExMSAtIGIxMSkgPD0gZ2xNYXRyaXguRVBTSUxPTiAqIE1hdGgubWF4KDEuMCwgTWF0aC5hYnMoYTExKSwgTWF0aC5hYnMoYjExKSkgJiYgTWF0aC5hYnMoYTEyIC0gYjEyKSA8PSBnbE1hdHJpeC5FUFNJTE9OICogTWF0aC5tYXgoMS4wLCBNYXRoLmFicyhhMTIpLCBNYXRoLmFicyhiMTIpKSAmJiBNYXRoLmFicyhhMTMgLSBiMTMpIDw9IGdsTWF0cml4LkVQU0lMT04gKiBNYXRoLm1heCgxLjAsIE1hdGguYWJzKGExMyksIE1hdGguYWJzKGIxMykpICYmIE1hdGguYWJzKGExNCAtIGIxNCkgPD0gZ2xNYXRyaXguRVBTSUxPTiAqIE1hdGgubWF4KDEuMCwgTWF0aC5hYnMoYTE0KSwgTWF0aC5hYnMoYjE0KSkgJiYgTWF0aC5hYnMoYTE1IC0gYjE1KSA8PSBnbE1hdHJpeC5FUFNJTE9OICogTWF0aC5tYXgoMS4wLCBNYXRoLmFicyhhMTUpLCBNYXRoLmFicyhiMTUpKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIEFsaWFzIGZvciB7QGxpbmsgbWF0NC5tdWx0aXBseX1cclxuICogQGZ1bmN0aW9uXHJcbiAqL1xyXG5leHBvcnQgdmFyIG11bCA9IG11bHRpcGx5O1xyXG5cclxuLyoqXHJcbiAqIEFsaWFzIGZvciB7QGxpbmsgbWF0NC5zdWJ0cmFjdH1cclxuICogQGZ1bmN0aW9uXHJcbiAqL1xyXG5leHBvcnQgdmFyIHN1YiA9IHN1YnRyYWN0OyIsImltcG9ydCAqIGFzIGdsTWF0cml4IGZyb20gXCIuL2NvbW1vbi5qc1wiO1xyXG5cclxuLyoqXHJcbiAqIDMgRGltZW5zaW9uYWwgVmVjdG9yXHJcbiAqIEBtb2R1bGUgdmVjM1xyXG4gKi9cclxuXHJcbi8qKlxyXG4gKiBDcmVhdGVzIGEgbmV3LCBlbXB0eSB2ZWMzXHJcbiAqXHJcbiAqIEByZXR1cm5zIHt2ZWMzfSBhIG5ldyAzRCB2ZWN0b3JcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGUoKSB7XHJcbiAgdmFyIG91dCA9IG5ldyBnbE1hdHJpeC5BUlJBWV9UWVBFKDMpO1xyXG4gIGlmIChnbE1hdHJpeC5BUlJBWV9UWVBFICE9IEZsb2F0MzJBcnJheSkge1xyXG4gICAgb3V0WzBdID0gMDtcclxuICAgIG91dFsxXSA9IDA7XHJcbiAgICBvdXRbMl0gPSAwO1xyXG4gIH1cclxuICByZXR1cm4gb3V0O1xyXG59XHJcblxyXG4vKipcclxuICogQ3JlYXRlcyBhIG5ldyB2ZWMzIGluaXRpYWxpemVkIHdpdGggdmFsdWVzIGZyb20gYW4gZXhpc3RpbmcgdmVjdG9yXHJcbiAqXHJcbiAqIEBwYXJhbSB7dmVjM30gYSB2ZWN0b3IgdG8gY2xvbmVcclxuICogQHJldHVybnMge3ZlYzN9IGEgbmV3IDNEIHZlY3RvclxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGNsb25lKGEpIHtcclxuICB2YXIgb3V0ID0gbmV3IGdsTWF0cml4LkFSUkFZX1RZUEUoMyk7XHJcbiAgb3V0WzBdID0gYVswXTtcclxuICBvdXRbMV0gPSBhWzFdO1xyXG4gIG91dFsyXSA9IGFbMl07XHJcbiAgcmV0dXJuIG91dDtcclxufVxyXG5cclxuLyoqXHJcbiAqIENhbGN1bGF0ZXMgdGhlIGxlbmd0aCBvZiBhIHZlYzNcclxuICpcclxuICogQHBhcmFtIHt2ZWMzfSBhIHZlY3RvciB0byBjYWxjdWxhdGUgbGVuZ3RoIG9mXHJcbiAqIEByZXR1cm5zIHtOdW1iZXJ9IGxlbmd0aCBvZiBhXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gbGVuZ3RoKGEpIHtcclxuICB2YXIgeCA9IGFbMF07XHJcbiAgdmFyIHkgPSBhWzFdO1xyXG4gIHZhciB6ID0gYVsyXTtcclxuICByZXR1cm4gTWF0aC5zcXJ0KHggKiB4ICsgeSAqIHkgKyB6ICogeik7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDcmVhdGVzIGEgbmV3IHZlYzMgaW5pdGlhbGl6ZWQgd2l0aCB0aGUgZ2l2ZW4gdmFsdWVzXHJcbiAqXHJcbiAqIEBwYXJhbSB7TnVtYmVyfSB4IFggY29tcG9uZW50XHJcbiAqIEBwYXJhbSB7TnVtYmVyfSB5IFkgY29tcG9uZW50XHJcbiAqIEBwYXJhbSB7TnVtYmVyfSB6IFogY29tcG9uZW50XHJcbiAqIEByZXR1cm5zIHt2ZWMzfSBhIG5ldyAzRCB2ZWN0b3JcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBmcm9tVmFsdWVzKHgsIHksIHopIHtcclxuICB2YXIgb3V0ID0gbmV3IGdsTWF0cml4LkFSUkFZX1RZUEUoMyk7XHJcbiAgb3V0WzBdID0geDtcclxuICBvdXRbMV0gPSB5O1xyXG4gIG91dFsyXSA9IHo7XHJcbiAgcmV0dXJuIG91dDtcclxufVxyXG5cclxuLyoqXHJcbiAqIENvcHkgdGhlIHZhbHVlcyBmcm9tIG9uZSB2ZWMzIHRvIGFub3RoZXJcclxuICpcclxuICogQHBhcmFtIHt2ZWMzfSBvdXQgdGhlIHJlY2VpdmluZyB2ZWN0b3JcclxuICogQHBhcmFtIHt2ZWMzfSBhIHRoZSBzb3VyY2UgdmVjdG9yXHJcbiAqIEByZXR1cm5zIHt2ZWMzfSBvdXRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBjb3B5KG91dCwgYSkge1xyXG4gIG91dFswXSA9IGFbMF07XHJcbiAgb3V0WzFdID0gYVsxXTtcclxuICBvdXRbMl0gPSBhWzJdO1xyXG4gIHJldHVybiBvdXQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBTZXQgdGhlIGNvbXBvbmVudHMgb2YgYSB2ZWMzIHRvIHRoZSBnaXZlbiB2YWx1ZXNcclxuICpcclxuICogQHBhcmFtIHt2ZWMzfSBvdXQgdGhlIHJlY2VpdmluZyB2ZWN0b3JcclxuICogQHBhcmFtIHtOdW1iZXJ9IHggWCBjb21wb25lbnRcclxuICogQHBhcmFtIHtOdW1iZXJ9IHkgWSBjb21wb25lbnRcclxuICogQHBhcmFtIHtOdW1iZXJ9IHogWiBjb21wb25lbnRcclxuICogQHJldHVybnMge3ZlYzN9IG91dFxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIHNldChvdXQsIHgsIHksIHopIHtcclxuICBvdXRbMF0gPSB4O1xyXG4gIG91dFsxXSA9IHk7XHJcbiAgb3V0WzJdID0gejtcclxuICByZXR1cm4gb3V0O1xyXG59XHJcblxyXG4vKipcclxuICogQWRkcyB0d28gdmVjMydzXHJcbiAqXHJcbiAqIEBwYXJhbSB7dmVjM30gb3V0IHRoZSByZWNlaXZpbmcgdmVjdG9yXHJcbiAqIEBwYXJhbSB7dmVjM30gYSB0aGUgZmlyc3Qgb3BlcmFuZFxyXG4gKiBAcGFyYW0ge3ZlYzN9IGIgdGhlIHNlY29uZCBvcGVyYW5kXHJcbiAqIEByZXR1cm5zIHt2ZWMzfSBvdXRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBhZGQob3V0LCBhLCBiKSB7XHJcbiAgb3V0WzBdID0gYVswXSArIGJbMF07XHJcbiAgb3V0WzFdID0gYVsxXSArIGJbMV07XHJcbiAgb3V0WzJdID0gYVsyXSArIGJbMl07XHJcbiAgcmV0dXJuIG91dDtcclxufVxyXG5cclxuLyoqXHJcbiAqIFN1YnRyYWN0cyB2ZWN0b3IgYiBmcm9tIHZlY3RvciBhXHJcbiAqXHJcbiAqIEBwYXJhbSB7dmVjM30gb3V0IHRoZSByZWNlaXZpbmcgdmVjdG9yXHJcbiAqIEBwYXJhbSB7dmVjM30gYSB0aGUgZmlyc3Qgb3BlcmFuZFxyXG4gKiBAcGFyYW0ge3ZlYzN9IGIgdGhlIHNlY29uZCBvcGVyYW5kXHJcbiAqIEByZXR1cm5zIHt2ZWMzfSBvdXRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBzdWJ0cmFjdChvdXQsIGEsIGIpIHtcclxuICBvdXRbMF0gPSBhWzBdIC0gYlswXTtcclxuICBvdXRbMV0gPSBhWzFdIC0gYlsxXTtcclxuICBvdXRbMl0gPSBhWzJdIC0gYlsyXTtcclxuICByZXR1cm4gb3V0O1xyXG59XHJcblxyXG4vKipcclxuICogTXVsdGlwbGllcyB0d28gdmVjMydzXHJcbiAqXHJcbiAqIEBwYXJhbSB7dmVjM30gb3V0IHRoZSByZWNlaXZpbmcgdmVjdG9yXHJcbiAqIEBwYXJhbSB7dmVjM30gYSB0aGUgZmlyc3Qgb3BlcmFuZFxyXG4gKiBAcGFyYW0ge3ZlYzN9IGIgdGhlIHNlY29uZCBvcGVyYW5kXHJcbiAqIEByZXR1cm5zIHt2ZWMzfSBvdXRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBtdWx0aXBseShvdXQsIGEsIGIpIHtcclxuICBvdXRbMF0gPSBhWzBdICogYlswXTtcclxuICBvdXRbMV0gPSBhWzFdICogYlsxXTtcclxuICBvdXRbMl0gPSBhWzJdICogYlsyXTtcclxuICByZXR1cm4gb3V0O1xyXG59XHJcblxyXG4vKipcclxuICogRGl2aWRlcyB0d28gdmVjMydzXHJcbiAqXHJcbiAqIEBwYXJhbSB7dmVjM30gb3V0IHRoZSByZWNlaXZpbmcgdmVjdG9yXHJcbiAqIEBwYXJhbSB7dmVjM30gYSB0aGUgZmlyc3Qgb3BlcmFuZFxyXG4gKiBAcGFyYW0ge3ZlYzN9IGIgdGhlIHNlY29uZCBvcGVyYW5kXHJcbiAqIEByZXR1cm5zIHt2ZWMzfSBvdXRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBkaXZpZGUob3V0LCBhLCBiKSB7XHJcbiAgb3V0WzBdID0gYVswXSAvIGJbMF07XHJcbiAgb3V0WzFdID0gYVsxXSAvIGJbMV07XHJcbiAgb3V0WzJdID0gYVsyXSAvIGJbMl07XHJcbiAgcmV0dXJuIG91dDtcclxufVxyXG5cclxuLyoqXHJcbiAqIE1hdGguY2VpbCB0aGUgY29tcG9uZW50cyBvZiBhIHZlYzNcclxuICpcclxuICogQHBhcmFtIHt2ZWMzfSBvdXQgdGhlIHJlY2VpdmluZyB2ZWN0b3JcclxuICogQHBhcmFtIHt2ZWMzfSBhIHZlY3RvciB0byBjZWlsXHJcbiAqIEByZXR1cm5zIHt2ZWMzfSBvdXRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBjZWlsKG91dCwgYSkge1xyXG4gIG91dFswXSA9IE1hdGguY2VpbChhWzBdKTtcclxuICBvdXRbMV0gPSBNYXRoLmNlaWwoYVsxXSk7XHJcbiAgb3V0WzJdID0gTWF0aC5jZWlsKGFbMl0pO1xyXG4gIHJldHVybiBvdXQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBNYXRoLmZsb29yIHRoZSBjb21wb25lbnRzIG9mIGEgdmVjM1xyXG4gKlxyXG4gKiBAcGFyYW0ge3ZlYzN9IG91dCB0aGUgcmVjZWl2aW5nIHZlY3RvclxyXG4gKiBAcGFyYW0ge3ZlYzN9IGEgdmVjdG9yIHRvIGZsb29yXHJcbiAqIEByZXR1cm5zIHt2ZWMzfSBvdXRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBmbG9vcihvdXQsIGEpIHtcclxuICBvdXRbMF0gPSBNYXRoLmZsb29yKGFbMF0pO1xyXG4gIG91dFsxXSA9IE1hdGguZmxvb3IoYVsxXSk7XHJcbiAgb3V0WzJdID0gTWF0aC5mbG9vcihhWzJdKTtcclxuICByZXR1cm4gb3V0O1xyXG59XHJcblxyXG4vKipcclxuICogUmV0dXJucyB0aGUgbWluaW11bSBvZiB0d28gdmVjMydzXHJcbiAqXHJcbiAqIEBwYXJhbSB7dmVjM30gb3V0IHRoZSByZWNlaXZpbmcgdmVjdG9yXHJcbiAqIEBwYXJhbSB7dmVjM30gYSB0aGUgZmlyc3Qgb3BlcmFuZFxyXG4gKiBAcGFyYW0ge3ZlYzN9IGIgdGhlIHNlY29uZCBvcGVyYW5kXHJcbiAqIEByZXR1cm5zIHt2ZWMzfSBvdXRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBtaW4ob3V0LCBhLCBiKSB7XHJcbiAgb3V0WzBdID0gTWF0aC5taW4oYVswXSwgYlswXSk7XHJcbiAgb3V0WzFdID0gTWF0aC5taW4oYVsxXSwgYlsxXSk7XHJcbiAgb3V0WzJdID0gTWF0aC5taW4oYVsyXSwgYlsyXSk7XHJcbiAgcmV0dXJuIG91dDtcclxufVxyXG5cclxuLyoqXHJcbiAqIFJldHVybnMgdGhlIG1heGltdW0gb2YgdHdvIHZlYzMnc1xyXG4gKlxyXG4gKiBAcGFyYW0ge3ZlYzN9IG91dCB0aGUgcmVjZWl2aW5nIHZlY3RvclxyXG4gKiBAcGFyYW0ge3ZlYzN9IGEgdGhlIGZpcnN0IG9wZXJhbmRcclxuICogQHBhcmFtIHt2ZWMzfSBiIHRoZSBzZWNvbmQgb3BlcmFuZFxyXG4gKiBAcmV0dXJucyB7dmVjM30gb3V0XHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gbWF4KG91dCwgYSwgYikge1xyXG4gIG91dFswXSA9IE1hdGgubWF4KGFbMF0sIGJbMF0pO1xyXG4gIG91dFsxXSA9IE1hdGgubWF4KGFbMV0sIGJbMV0pO1xyXG4gIG91dFsyXSA9IE1hdGgubWF4KGFbMl0sIGJbMl0pO1xyXG4gIHJldHVybiBvdXQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBNYXRoLnJvdW5kIHRoZSBjb21wb25lbnRzIG9mIGEgdmVjM1xyXG4gKlxyXG4gKiBAcGFyYW0ge3ZlYzN9IG91dCB0aGUgcmVjZWl2aW5nIHZlY3RvclxyXG4gKiBAcGFyYW0ge3ZlYzN9IGEgdmVjdG9yIHRvIHJvdW5kXHJcbiAqIEByZXR1cm5zIHt2ZWMzfSBvdXRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiByb3VuZChvdXQsIGEpIHtcclxuICBvdXRbMF0gPSBNYXRoLnJvdW5kKGFbMF0pO1xyXG4gIG91dFsxXSA9IE1hdGgucm91bmQoYVsxXSk7XHJcbiAgb3V0WzJdID0gTWF0aC5yb3VuZChhWzJdKTtcclxuICByZXR1cm4gb3V0O1xyXG59XHJcblxyXG4vKipcclxuICogU2NhbGVzIGEgdmVjMyBieSBhIHNjYWxhciBudW1iZXJcclxuICpcclxuICogQHBhcmFtIHt2ZWMzfSBvdXQgdGhlIHJlY2VpdmluZyB2ZWN0b3JcclxuICogQHBhcmFtIHt2ZWMzfSBhIHRoZSB2ZWN0b3IgdG8gc2NhbGVcclxuICogQHBhcmFtIHtOdW1iZXJ9IGIgYW1vdW50IHRvIHNjYWxlIHRoZSB2ZWN0b3IgYnlcclxuICogQHJldHVybnMge3ZlYzN9IG91dFxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIHNjYWxlKG91dCwgYSwgYikge1xyXG4gIG91dFswXSA9IGFbMF0gKiBiO1xyXG4gIG91dFsxXSA9IGFbMV0gKiBiO1xyXG4gIG91dFsyXSA9IGFbMl0gKiBiO1xyXG4gIHJldHVybiBvdXQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBBZGRzIHR3byB2ZWMzJ3MgYWZ0ZXIgc2NhbGluZyB0aGUgc2Vjb25kIG9wZXJhbmQgYnkgYSBzY2FsYXIgdmFsdWVcclxuICpcclxuICogQHBhcmFtIHt2ZWMzfSBvdXQgdGhlIHJlY2VpdmluZyB2ZWN0b3JcclxuICogQHBhcmFtIHt2ZWMzfSBhIHRoZSBmaXJzdCBvcGVyYW5kXHJcbiAqIEBwYXJhbSB7dmVjM30gYiB0aGUgc2Vjb25kIG9wZXJhbmRcclxuICogQHBhcmFtIHtOdW1iZXJ9IHNjYWxlIHRoZSBhbW91bnQgdG8gc2NhbGUgYiBieSBiZWZvcmUgYWRkaW5nXHJcbiAqIEByZXR1cm5zIHt2ZWMzfSBvdXRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBzY2FsZUFuZEFkZChvdXQsIGEsIGIsIHNjYWxlKSB7XHJcbiAgb3V0WzBdID0gYVswXSArIGJbMF0gKiBzY2FsZTtcclxuICBvdXRbMV0gPSBhWzFdICsgYlsxXSAqIHNjYWxlO1xyXG4gIG91dFsyXSA9IGFbMl0gKyBiWzJdICogc2NhbGU7XHJcbiAgcmV0dXJuIG91dDtcclxufVxyXG5cclxuLyoqXHJcbiAqIENhbGN1bGF0ZXMgdGhlIGV1Y2xpZGlhbiBkaXN0YW5jZSBiZXR3ZWVuIHR3byB2ZWMzJ3NcclxuICpcclxuICogQHBhcmFtIHt2ZWMzfSBhIHRoZSBmaXJzdCBvcGVyYW5kXHJcbiAqIEBwYXJhbSB7dmVjM30gYiB0aGUgc2Vjb25kIG9wZXJhbmRcclxuICogQHJldHVybnMge051bWJlcn0gZGlzdGFuY2UgYmV0d2VlbiBhIGFuZCBiXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gZGlzdGFuY2UoYSwgYikge1xyXG4gIHZhciB4ID0gYlswXSAtIGFbMF07XHJcbiAgdmFyIHkgPSBiWzFdIC0gYVsxXTtcclxuICB2YXIgeiA9IGJbMl0gLSBhWzJdO1xyXG4gIHJldHVybiBNYXRoLnNxcnQoeCAqIHggKyB5ICogeSArIHogKiB6KTtcclxufVxyXG5cclxuLyoqXHJcbiAqIENhbGN1bGF0ZXMgdGhlIHNxdWFyZWQgZXVjbGlkaWFuIGRpc3RhbmNlIGJldHdlZW4gdHdvIHZlYzMnc1xyXG4gKlxyXG4gKiBAcGFyYW0ge3ZlYzN9IGEgdGhlIGZpcnN0IG9wZXJhbmRcclxuICogQHBhcmFtIHt2ZWMzfSBiIHRoZSBzZWNvbmQgb3BlcmFuZFxyXG4gKiBAcmV0dXJucyB7TnVtYmVyfSBzcXVhcmVkIGRpc3RhbmNlIGJldHdlZW4gYSBhbmQgYlxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIHNxdWFyZWREaXN0YW5jZShhLCBiKSB7XHJcbiAgdmFyIHggPSBiWzBdIC0gYVswXTtcclxuICB2YXIgeSA9IGJbMV0gLSBhWzFdO1xyXG4gIHZhciB6ID0gYlsyXSAtIGFbMl07XHJcbiAgcmV0dXJuIHggKiB4ICsgeSAqIHkgKyB6ICogejtcclxufVxyXG5cclxuLyoqXHJcbiAqIENhbGN1bGF0ZXMgdGhlIHNxdWFyZWQgbGVuZ3RoIG9mIGEgdmVjM1xyXG4gKlxyXG4gKiBAcGFyYW0ge3ZlYzN9IGEgdmVjdG9yIHRvIGNhbGN1bGF0ZSBzcXVhcmVkIGxlbmd0aCBvZlxyXG4gKiBAcmV0dXJucyB7TnVtYmVyfSBzcXVhcmVkIGxlbmd0aCBvZiBhXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gc3F1YXJlZExlbmd0aChhKSB7XHJcbiAgdmFyIHggPSBhWzBdO1xyXG4gIHZhciB5ID0gYVsxXTtcclxuICB2YXIgeiA9IGFbMl07XHJcbiAgcmV0dXJuIHggKiB4ICsgeSAqIHkgKyB6ICogejtcclxufVxyXG5cclxuLyoqXHJcbiAqIE5lZ2F0ZXMgdGhlIGNvbXBvbmVudHMgb2YgYSB2ZWMzXHJcbiAqXHJcbiAqIEBwYXJhbSB7dmVjM30gb3V0IHRoZSByZWNlaXZpbmcgdmVjdG9yXHJcbiAqIEBwYXJhbSB7dmVjM30gYSB2ZWN0b3IgdG8gbmVnYXRlXHJcbiAqIEByZXR1cm5zIHt2ZWMzfSBvdXRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBuZWdhdGUob3V0LCBhKSB7XHJcbiAgb3V0WzBdID0gLWFbMF07XHJcbiAgb3V0WzFdID0gLWFbMV07XHJcbiAgb3V0WzJdID0gLWFbMl07XHJcbiAgcmV0dXJuIG91dDtcclxufVxyXG5cclxuLyoqXHJcbiAqIFJldHVybnMgdGhlIGludmVyc2Ugb2YgdGhlIGNvbXBvbmVudHMgb2YgYSB2ZWMzXHJcbiAqXHJcbiAqIEBwYXJhbSB7dmVjM30gb3V0IHRoZSByZWNlaXZpbmcgdmVjdG9yXHJcbiAqIEBwYXJhbSB7dmVjM30gYSB2ZWN0b3IgdG8gaW52ZXJ0XHJcbiAqIEByZXR1cm5zIHt2ZWMzfSBvdXRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBpbnZlcnNlKG91dCwgYSkge1xyXG4gIG91dFswXSA9IDEuMCAvIGFbMF07XHJcbiAgb3V0WzFdID0gMS4wIC8gYVsxXTtcclxuICBvdXRbMl0gPSAxLjAgLyBhWzJdO1xyXG4gIHJldHVybiBvdXQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBOb3JtYWxpemUgYSB2ZWMzXHJcbiAqXHJcbiAqIEBwYXJhbSB7dmVjM30gb3V0IHRoZSByZWNlaXZpbmcgdmVjdG9yXHJcbiAqIEBwYXJhbSB7dmVjM30gYSB2ZWN0b3IgdG8gbm9ybWFsaXplXHJcbiAqIEByZXR1cm5zIHt2ZWMzfSBvdXRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBub3JtYWxpemUob3V0LCBhKSB7XHJcbiAgdmFyIHggPSBhWzBdO1xyXG4gIHZhciB5ID0gYVsxXTtcclxuICB2YXIgeiA9IGFbMl07XHJcbiAgdmFyIGxlbiA9IHggKiB4ICsgeSAqIHkgKyB6ICogejtcclxuICBpZiAobGVuID4gMCkge1xyXG4gICAgLy9UT0RPOiBldmFsdWF0ZSB1c2Ugb2YgZ2xtX2ludnNxcnQgaGVyZT9cclxuICAgIGxlbiA9IDEgLyBNYXRoLnNxcnQobGVuKTtcclxuICAgIG91dFswXSA9IGFbMF0gKiBsZW47XHJcbiAgICBvdXRbMV0gPSBhWzFdICogbGVuO1xyXG4gICAgb3V0WzJdID0gYVsyXSAqIGxlbjtcclxuICB9XHJcbiAgcmV0dXJuIG91dDtcclxufVxyXG5cclxuLyoqXHJcbiAqIENhbGN1bGF0ZXMgdGhlIGRvdCBwcm9kdWN0IG9mIHR3byB2ZWMzJ3NcclxuICpcclxuICogQHBhcmFtIHt2ZWMzfSBhIHRoZSBmaXJzdCBvcGVyYW5kXHJcbiAqIEBwYXJhbSB7dmVjM30gYiB0aGUgc2Vjb25kIG9wZXJhbmRcclxuICogQHJldHVybnMge051bWJlcn0gZG90IHByb2R1Y3Qgb2YgYSBhbmQgYlxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGRvdChhLCBiKSB7XHJcbiAgcmV0dXJuIGFbMF0gKiBiWzBdICsgYVsxXSAqIGJbMV0gKyBhWzJdICogYlsyXTtcclxufVxyXG5cclxuLyoqXHJcbiAqIENvbXB1dGVzIHRoZSBjcm9zcyBwcm9kdWN0IG9mIHR3byB2ZWMzJ3NcclxuICpcclxuICogQHBhcmFtIHt2ZWMzfSBvdXQgdGhlIHJlY2VpdmluZyB2ZWN0b3JcclxuICogQHBhcmFtIHt2ZWMzfSBhIHRoZSBmaXJzdCBvcGVyYW5kXHJcbiAqIEBwYXJhbSB7dmVjM30gYiB0aGUgc2Vjb25kIG9wZXJhbmRcclxuICogQHJldHVybnMge3ZlYzN9IG91dFxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGNyb3NzKG91dCwgYSwgYikge1xyXG4gIHZhciBheCA9IGFbMF0sXHJcbiAgICAgIGF5ID0gYVsxXSxcclxuICAgICAgYXogPSBhWzJdO1xyXG4gIHZhciBieCA9IGJbMF0sXHJcbiAgICAgIGJ5ID0gYlsxXSxcclxuICAgICAgYnogPSBiWzJdO1xyXG5cclxuICBvdXRbMF0gPSBheSAqIGJ6IC0gYXogKiBieTtcclxuICBvdXRbMV0gPSBheiAqIGJ4IC0gYXggKiBiejtcclxuICBvdXRbMl0gPSBheCAqIGJ5IC0gYXkgKiBieDtcclxuICByZXR1cm4gb3V0O1xyXG59XHJcblxyXG4vKipcclxuICogUGVyZm9ybXMgYSBsaW5lYXIgaW50ZXJwb2xhdGlvbiBiZXR3ZWVuIHR3byB2ZWMzJ3NcclxuICpcclxuICogQHBhcmFtIHt2ZWMzfSBvdXQgdGhlIHJlY2VpdmluZyB2ZWN0b3JcclxuICogQHBhcmFtIHt2ZWMzfSBhIHRoZSBmaXJzdCBvcGVyYW5kXHJcbiAqIEBwYXJhbSB7dmVjM30gYiB0aGUgc2Vjb25kIG9wZXJhbmRcclxuICogQHBhcmFtIHtOdW1iZXJ9IHQgaW50ZXJwb2xhdGlvbiBhbW91bnQsIGluIHRoZSByYW5nZSBbMC0xXSwgYmV0d2VlbiB0aGUgdHdvIGlucHV0c1xyXG4gKiBAcmV0dXJucyB7dmVjM30gb3V0XHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gbGVycChvdXQsIGEsIGIsIHQpIHtcclxuICB2YXIgYXggPSBhWzBdO1xyXG4gIHZhciBheSA9IGFbMV07XHJcbiAgdmFyIGF6ID0gYVsyXTtcclxuICBvdXRbMF0gPSBheCArIHQgKiAoYlswXSAtIGF4KTtcclxuICBvdXRbMV0gPSBheSArIHQgKiAoYlsxXSAtIGF5KTtcclxuICBvdXRbMl0gPSBheiArIHQgKiAoYlsyXSAtIGF6KTtcclxuICByZXR1cm4gb3V0O1xyXG59XHJcblxyXG4vKipcclxuICogUGVyZm9ybXMgYSBoZXJtaXRlIGludGVycG9sYXRpb24gd2l0aCB0d28gY29udHJvbCBwb2ludHNcclxuICpcclxuICogQHBhcmFtIHt2ZWMzfSBvdXQgdGhlIHJlY2VpdmluZyB2ZWN0b3JcclxuICogQHBhcmFtIHt2ZWMzfSBhIHRoZSBmaXJzdCBvcGVyYW5kXHJcbiAqIEBwYXJhbSB7dmVjM30gYiB0aGUgc2Vjb25kIG9wZXJhbmRcclxuICogQHBhcmFtIHt2ZWMzfSBjIHRoZSB0aGlyZCBvcGVyYW5kXHJcbiAqIEBwYXJhbSB7dmVjM30gZCB0aGUgZm91cnRoIG9wZXJhbmRcclxuICogQHBhcmFtIHtOdW1iZXJ9IHQgaW50ZXJwb2xhdGlvbiBhbW91bnQsIGluIHRoZSByYW5nZSBbMC0xXSwgYmV0d2VlbiB0aGUgdHdvIGlucHV0c1xyXG4gKiBAcmV0dXJucyB7dmVjM30gb3V0XHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gaGVybWl0ZShvdXQsIGEsIGIsIGMsIGQsIHQpIHtcclxuICB2YXIgZmFjdG9yVGltZXMyID0gdCAqIHQ7XHJcbiAgdmFyIGZhY3RvcjEgPSBmYWN0b3JUaW1lczIgKiAoMiAqIHQgLSAzKSArIDE7XHJcbiAgdmFyIGZhY3RvcjIgPSBmYWN0b3JUaW1lczIgKiAodCAtIDIpICsgdDtcclxuICB2YXIgZmFjdG9yMyA9IGZhY3RvclRpbWVzMiAqICh0IC0gMSk7XHJcbiAgdmFyIGZhY3RvcjQgPSBmYWN0b3JUaW1lczIgKiAoMyAtIDIgKiB0KTtcclxuXHJcbiAgb3V0WzBdID0gYVswXSAqIGZhY3RvcjEgKyBiWzBdICogZmFjdG9yMiArIGNbMF0gKiBmYWN0b3IzICsgZFswXSAqIGZhY3RvcjQ7XHJcbiAgb3V0WzFdID0gYVsxXSAqIGZhY3RvcjEgKyBiWzFdICogZmFjdG9yMiArIGNbMV0gKiBmYWN0b3IzICsgZFsxXSAqIGZhY3RvcjQ7XHJcbiAgb3V0WzJdID0gYVsyXSAqIGZhY3RvcjEgKyBiWzJdICogZmFjdG9yMiArIGNbMl0gKiBmYWN0b3IzICsgZFsyXSAqIGZhY3RvcjQ7XHJcblxyXG4gIHJldHVybiBvdXQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBQZXJmb3JtcyBhIGJlemllciBpbnRlcnBvbGF0aW9uIHdpdGggdHdvIGNvbnRyb2wgcG9pbnRzXHJcbiAqXHJcbiAqIEBwYXJhbSB7dmVjM30gb3V0IHRoZSByZWNlaXZpbmcgdmVjdG9yXHJcbiAqIEBwYXJhbSB7dmVjM30gYSB0aGUgZmlyc3Qgb3BlcmFuZFxyXG4gKiBAcGFyYW0ge3ZlYzN9IGIgdGhlIHNlY29uZCBvcGVyYW5kXHJcbiAqIEBwYXJhbSB7dmVjM30gYyB0aGUgdGhpcmQgb3BlcmFuZFxyXG4gKiBAcGFyYW0ge3ZlYzN9IGQgdGhlIGZvdXJ0aCBvcGVyYW5kXHJcbiAqIEBwYXJhbSB7TnVtYmVyfSB0IGludGVycG9sYXRpb24gYW1vdW50LCBpbiB0aGUgcmFuZ2UgWzAtMV0sIGJldHdlZW4gdGhlIHR3byBpbnB1dHNcclxuICogQHJldHVybnMge3ZlYzN9IG91dFxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGJlemllcihvdXQsIGEsIGIsIGMsIGQsIHQpIHtcclxuICB2YXIgaW52ZXJzZUZhY3RvciA9IDEgLSB0O1xyXG4gIHZhciBpbnZlcnNlRmFjdG9yVGltZXNUd28gPSBpbnZlcnNlRmFjdG9yICogaW52ZXJzZUZhY3RvcjtcclxuICB2YXIgZmFjdG9yVGltZXMyID0gdCAqIHQ7XHJcbiAgdmFyIGZhY3RvcjEgPSBpbnZlcnNlRmFjdG9yVGltZXNUd28gKiBpbnZlcnNlRmFjdG9yO1xyXG4gIHZhciBmYWN0b3IyID0gMyAqIHQgKiBpbnZlcnNlRmFjdG9yVGltZXNUd287XHJcbiAgdmFyIGZhY3RvcjMgPSAzICogZmFjdG9yVGltZXMyICogaW52ZXJzZUZhY3RvcjtcclxuICB2YXIgZmFjdG9yNCA9IGZhY3RvclRpbWVzMiAqIHQ7XHJcblxyXG4gIG91dFswXSA9IGFbMF0gKiBmYWN0b3IxICsgYlswXSAqIGZhY3RvcjIgKyBjWzBdICogZmFjdG9yMyArIGRbMF0gKiBmYWN0b3I0O1xyXG4gIG91dFsxXSA9IGFbMV0gKiBmYWN0b3IxICsgYlsxXSAqIGZhY3RvcjIgKyBjWzFdICogZmFjdG9yMyArIGRbMV0gKiBmYWN0b3I0O1xyXG4gIG91dFsyXSA9IGFbMl0gKiBmYWN0b3IxICsgYlsyXSAqIGZhY3RvcjIgKyBjWzJdICogZmFjdG9yMyArIGRbMl0gKiBmYWN0b3I0O1xyXG5cclxuICByZXR1cm4gb3V0O1xyXG59XHJcblxyXG4vKipcclxuICogR2VuZXJhdGVzIGEgcmFuZG9tIHZlY3RvciB3aXRoIHRoZSBnaXZlbiBzY2FsZVxyXG4gKlxyXG4gKiBAcGFyYW0ge3ZlYzN9IG91dCB0aGUgcmVjZWl2aW5nIHZlY3RvclxyXG4gKiBAcGFyYW0ge051bWJlcn0gW3NjYWxlXSBMZW5ndGggb2YgdGhlIHJlc3VsdGluZyB2ZWN0b3IuIElmIG9tbWl0dGVkLCBhIHVuaXQgdmVjdG9yIHdpbGwgYmUgcmV0dXJuZWRcclxuICogQHJldHVybnMge3ZlYzN9IG91dFxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIHJhbmRvbShvdXQsIHNjYWxlKSB7XHJcbiAgc2NhbGUgPSBzY2FsZSB8fCAxLjA7XHJcblxyXG4gIHZhciByID0gZ2xNYXRyaXguUkFORE9NKCkgKiAyLjAgKiBNYXRoLlBJO1xyXG4gIHZhciB6ID0gZ2xNYXRyaXguUkFORE9NKCkgKiAyLjAgLSAxLjA7XHJcbiAgdmFyIHpTY2FsZSA9IE1hdGguc3FydCgxLjAgLSB6ICogeikgKiBzY2FsZTtcclxuXHJcbiAgb3V0WzBdID0gTWF0aC5jb3MocikgKiB6U2NhbGU7XHJcbiAgb3V0WzFdID0gTWF0aC5zaW4ocikgKiB6U2NhbGU7XHJcbiAgb3V0WzJdID0geiAqIHNjYWxlO1xyXG4gIHJldHVybiBvdXQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBUcmFuc2Zvcm1zIHRoZSB2ZWMzIHdpdGggYSBtYXQ0LlxyXG4gKiA0dGggdmVjdG9yIGNvbXBvbmVudCBpcyBpbXBsaWNpdGx5ICcxJ1xyXG4gKlxyXG4gKiBAcGFyYW0ge3ZlYzN9IG91dCB0aGUgcmVjZWl2aW5nIHZlY3RvclxyXG4gKiBAcGFyYW0ge3ZlYzN9IGEgdGhlIHZlY3RvciB0byB0cmFuc2Zvcm1cclxuICogQHBhcmFtIHttYXQ0fSBtIG1hdHJpeCB0byB0cmFuc2Zvcm0gd2l0aFxyXG4gKiBAcmV0dXJucyB7dmVjM30gb3V0XHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gdHJhbnNmb3JtTWF0NChvdXQsIGEsIG0pIHtcclxuICB2YXIgeCA9IGFbMF0sXHJcbiAgICAgIHkgPSBhWzFdLFxyXG4gICAgICB6ID0gYVsyXTtcclxuICB2YXIgdyA9IG1bM10gKiB4ICsgbVs3XSAqIHkgKyBtWzExXSAqIHogKyBtWzE1XTtcclxuICB3ID0gdyB8fCAxLjA7XHJcbiAgb3V0WzBdID0gKG1bMF0gKiB4ICsgbVs0XSAqIHkgKyBtWzhdICogeiArIG1bMTJdKSAvIHc7XHJcbiAgb3V0WzFdID0gKG1bMV0gKiB4ICsgbVs1XSAqIHkgKyBtWzldICogeiArIG1bMTNdKSAvIHc7XHJcbiAgb3V0WzJdID0gKG1bMl0gKiB4ICsgbVs2XSAqIHkgKyBtWzEwXSAqIHogKyBtWzE0XSkgLyB3O1xyXG4gIHJldHVybiBvdXQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBUcmFuc2Zvcm1zIHRoZSB2ZWMzIHdpdGggYSBtYXQzLlxyXG4gKlxyXG4gKiBAcGFyYW0ge3ZlYzN9IG91dCB0aGUgcmVjZWl2aW5nIHZlY3RvclxyXG4gKiBAcGFyYW0ge3ZlYzN9IGEgdGhlIHZlY3RvciB0byB0cmFuc2Zvcm1cclxuICogQHBhcmFtIHttYXQzfSBtIHRoZSAzeDMgbWF0cml4IHRvIHRyYW5zZm9ybSB3aXRoXHJcbiAqIEByZXR1cm5zIHt2ZWMzfSBvdXRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiB0cmFuc2Zvcm1NYXQzKG91dCwgYSwgbSkge1xyXG4gIHZhciB4ID0gYVswXSxcclxuICAgICAgeSA9IGFbMV0sXHJcbiAgICAgIHogPSBhWzJdO1xyXG4gIG91dFswXSA9IHggKiBtWzBdICsgeSAqIG1bM10gKyB6ICogbVs2XTtcclxuICBvdXRbMV0gPSB4ICogbVsxXSArIHkgKiBtWzRdICsgeiAqIG1bN107XHJcbiAgb3V0WzJdID0geCAqIG1bMl0gKyB5ICogbVs1XSArIHogKiBtWzhdO1xyXG4gIHJldHVybiBvdXQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBUcmFuc2Zvcm1zIHRoZSB2ZWMzIHdpdGggYSBxdWF0XHJcbiAqIENhbiBhbHNvIGJlIHVzZWQgZm9yIGR1YWwgcXVhdGVybmlvbnMuIChNdWx0aXBseSBpdCB3aXRoIHRoZSByZWFsIHBhcnQpXHJcbiAqXHJcbiAqIEBwYXJhbSB7dmVjM30gb3V0IHRoZSByZWNlaXZpbmcgdmVjdG9yXHJcbiAqIEBwYXJhbSB7dmVjM30gYSB0aGUgdmVjdG9yIHRvIHRyYW5zZm9ybVxyXG4gKiBAcGFyYW0ge3F1YXR9IHEgcXVhdGVybmlvbiB0byB0cmFuc2Zvcm0gd2l0aFxyXG4gKiBAcmV0dXJucyB7dmVjM30gb3V0XHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gdHJhbnNmb3JtUXVhdChvdXQsIGEsIHEpIHtcclxuICAvLyBiZW5jaG1hcmtzOiBodHRwczovL2pzcGVyZi5jb20vcXVhdGVybmlvbi10cmFuc2Zvcm0tdmVjMy1pbXBsZW1lbnRhdGlvbnMtZml4ZWRcclxuICB2YXIgcXggPSBxWzBdLFxyXG4gICAgICBxeSA9IHFbMV0sXHJcbiAgICAgIHF6ID0gcVsyXSxcclxuICAgICAgcXcgPSBxWzNdO1xyXG4gIHZhciB4ID0gYVswXSxcclxuICAgICAgeSA9IGFbMV0sXHJcbiAgICAgIHogPSBhWzJdO1xyXG4gIC8vIHZhciBxdmVjID0gW3F4LCBxeSwgcXpdO1xyXG4gIC8vIHZhciB1diA9IHZlYzMuY3Jvc3MoW10sIHF2ZWMsIGEpO1xyXG4gIHZhciB1dnggPSBxeSAqIHogLSBxeiAqIHksXHJcbiAgICAgIHV2eSA9IHF6ICogeCAtIHF4ICogeixcclxuICAgICAgdXZ6ID0gcXggKiB5IC0gcXkgKiB4O1xyXG4gIC8vIHZhciB1dXYgPSB2ZWMzLmNyb3NzKFtdLCBxdmVjLCB1dik7XHJcbiAgdmFyIHV1dnggPSBxeSAqIHV2eiAtIHF6ICogdXZ5LFxyXG4gICAgICB1dXZ5ID0gcXogKiB1dnggLSBxeCAqIHV2eixcclxuICAgICAgdXV2eiA9IHF4ICogdXZ5IC0gcXkgKiB1dng7XHJcbiAgLy8gdmVjMy5zY2FsZSh1diwgdXYsIDIgKiB3KTtcclxuICB2YXIgdzIgPSBxdyAqIDI7XHJcbiAgdXZ4ICo9IHcyO1xyXG4gIHV2eSAqPSB3MjtcclxuICB1dnogKj0gdzI7XHJcbiAgLy8gdmVjMy5zY2FsZSh1dXYsIHV1diwgMik7XHJcbiAgdXV2eCAqPSAyO1xyXG4gIHV1dnkgKj0gMjtcclxuICB1dXZ6ICo9IDI7XHJcbiAgLy8gcmV0dXJuIHZlYzMuYWRkKG91dCwgYSwgdmVjMy5hZGQob3V0LCB1diwgdXV2KSk7XHJcbiAgb3V0WzBdID0geCArIHV2eCArIHV1dng7XHJcbiAgb3V0WzFdID0geSArIHV2eSArIHV1dnk7XHJcbiAgb3V0WzJdID0geiArIHV2eiArIHV1dno7XHJcbiAgcmV0dXJuIG91dDtcclxufVxyXG5cclxuLyoqXHJcbiAqIFJvdGF0ZSBhIDNEIHZlY3RvciBhcm91bmQgdGhlIHgtYXhpc1xyXG4gKiBAcGFyYW0ge3ZlYzN9IG91dCBUaGUgcmVjZWl2aW5nIHZlYzNcclxuICogQHBhcmFtIHt2ZWMzfSBhIFRoZSB2ZWMzIHBvaW50IHRvIHJvdGF0ZVxyXG4gKiBAcGFyYW0ge3ZlYzN9IGIgVGhlIG9yaWdpbiBvZiB0aGUgcm90YXRpb25cclxuICogQHBhcmFtIHtOdW1iZXJ9IGMgVGhlIGFuZ2xlIG9mIHJvdGF0aW9uXHJcbiAqIEByZXR1cm5zIHt2ZWMzfSBvdXRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiByb3RhdGVYKG91dCwgYSwgYiwgYykge1xyXG4gIHZhciBwID0gW10sXHJcbiAgICAgIHIgPSBbXTtcclxuICAvL1RyYW5zbGF0ZSBwb2ludCB0byB0aGUgb3JpZ2luXHJcbiAgcFswXSA9IGFbMF0gLSBiWzBdO1xyXG4gIHBbMV0gPSBhWzFdIC0gYlsxXTtcclxuICBwWzJdID0gYVsyXSAtIGJbMl07XHJcblxyXG4gIC8vcGVyZm9ybSByb3RhdGlvblxyXG4gIHJbMF0gPSBwWzBdO1xyXG4gIHJbMV0gPSBwWzFdICogTWF0aC5jb3MoYykgLSBwWzJdICogTWF0aC5zaW4oYyk7XHJcbiAgclsyXSA9IHBbMV0gKiBNYXRoLnNpbihjKSArIHBbMl0gKiBNYXRoLmNvcyhjKTtcclxuXHJcbiAgLy90cmFuc2xhdGUgdG8gY29ycmVjdCBwb3NpdGlvblxyXG4gIG91dFswXSA9IHJbMF0gKyBiWzBdO1xyXG4gIG91dFsxXSA9IHJbMV0gKyBiWzFdO1xyXG4gIG91dFsyXSA9IHJbMl0gKyBiWzJdO1xyXG5cclxuICByZXR1cm4gb3V0O1xyXG59XHJcblxyXG4vKipcclxuICogUm90YXRlIGEgM0QgdmVjdG9yIGFyb3VuZCB0aGUgeS1heGlzXHJcbiAqIEBwYXJhbSB7dmVjM30gb3V0IFRoZSByZWNlaXZpbmcgdmVjM1xyXG4gKiBAcGFyYW0ge3ZlYzN9IGEgVGhlIHZlYzMgcG9pbnQgdG8gcm90YXRlXHJcbiAqIEBwYXJhbSB7dmVjM30gYiBUaGUgb3JpZ2luIG9mIHRoZSByb3RhdGlvblxyXG4gKiBAcGFyYW0ge051bWJlcn0gYyBUaGUgYW5nbGUgb2Ygcm90YXRpb25cclxuICogQHJldHVybnMge3ZlYzN9IG91dFxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIHJvdGF0ZVkob3V0LCBhLCBiLCBjKSB7XHJcbiAgdmFyIHAgPSBbXSxcclxuICAgICAgciA9IFtdO1xyXG4gIC8vVHJhbnNsYXRlIHBvaW50IHRvIHRoZSBvcmlnaW5cclxuICBwWzBdID0gYVswXSAtIGJbMF07XHJcbiAgcFsxXSA9IGFbMV0gLSBiWzFdO1xyXG4gIHBbMl0gPSBhWzJdIC0gYlsyXTtcclxuXHJcbiAgLy9wZXJmb3JtIHJvdGF0aW9uXHJcbiAgclswXSA9IHBbMl0gKiBNYXRoLnNpbihjKSArIHBbMF0gKiBNYXRoLmNvcyhjKTtcclxuICByWzFdID0gcFsxXTtcclxuICByWzJdID0gcFsyXSAqIE1hdGguY29zKGMpIC0gcFswXSAqIE1hdGguc2luKGMpO1xyXG5cclxuICAvL3RyYW5zbGF0ZSB0byBjb3JyZWN0IHBvc2l0aW9uXHJcbiAgb3V0WzBdID0gclswXSArIGJbMF07XHJcbiAgb3V0WzFdID0gclsxXSArIGJbMV07XHJcbiAgb3V0WzJdID0gclsyXSArIGJbMl07XHJcblxyXG4gIHJldHVybiBvdXQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBSb3RhdGUgYSAzRCB2ZWN0b3IgYXJvdW5kIHRoZSB6LWF4aXNcclxuICogQHBhcmFtIHt2ZWMzfSBvdXQgVGhlIHJlY2VpdmluZyB2ZWMzXHJcbiAqIEBwYXJhbSB7dmVjM30gYSBUaGUgdmVjMyBwb2ludCB0byByb3RhdGVcclxuICogQHBhcmFtIHt2ZWMzfSBiIFRoZSBvcmlnaW4gb2YgdGhlIHJvdGF0aW9uXHJcbiAqIEBwYXJhbSB7TnVtYmVyfSBjIFRoZSBhbmdsZSBvZiByb3RhdGlvblxyXG4gKiBAcmV0dXJucyB7dmVjM30gb3V0XHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gcm90YXRlWihvdXQsIGEsIGIsIGMpIHtcclxuICB2YXIgcCA9IFtdLFxyXG4gICAgICByID0gW107XHJcbiAgLy9UcmFuc2xhdGUgcG9pbnQgdG8gdGhlIG9yaWdpblxyXG4gIHBbMF0gPSBhWzBdIC0gYlswXTtcclxuICBwWzFdID0gYVsxXSAtIGJbMV07XHJcbiAgcFsyXSA9IGFbMl0gLSBiWzJdO1xyXG5cclxuICAvL3BlcmZvcm0gcm90YXRpb25cclxuICByWzBdID0gcFswXSAqIE1hdGguY29zKGMpIC0gcFsxXSAqIE1hdGguc2luKGMpO1xyXG4gIHJbMV0gPSBwWzBdICogTWF0aC5zaW4oYykgKyBwWzFdICogTWF0aC5jb3MoYyk7XHJcbiAgclsyXSA9IHBbMl07XHJcblxyXG4gIC8vdHJhbnNsYXRlIHRvIGNvcnJlY3QgcG9zaXRpb25cclxuICBvdXRbMF0gPSByWzBdICsgYlswXTtcclxuICBvdXRbMV0gPSByWzFdICsgYlsxXTtcclxuICBvdXRbMl0gPSByWzJdICsgYlsyXTtcclxuXHJcbiAgcmV0dXJuIG91dDtcclxufVxyXG5cclxuLyoqXHJcbiAqIEdldCB0aGUgYW5nbGUgYmV0d2VlbiB0d28gM0QgdmVjdG9yc1xyXG4gKiBAcGFyYW0ge3ZlYzN9IGEgVGhlIGZpcnN0IG9wZXJhbmRcclxuICogQHBhcmFtIHt2ZWMzfSBiIFRoZSBzZWNvbmQgb3BlcmFuZFxyXG4gKiBAcmV0dXJucyB7TnVtYmVyfSBUaGUgYW5nbGUgaW4gcmFkaWFuc1xyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGFuZ2xlKGEsIGIpIHtcclxuICB2YXIgdGVtcEEgPSBmcm9tVmFsdWVzKGFbMF0sIGFbMV0sIGFbMl0pO1xyXG4gIHZhciB0ZW1wQiA9IGZyb21WYWx1ZXMoYlswXSwgYlsxXSwgYlsyXSk7XHJcblxyXG4gIG5vcm1hbGl6ZSh0ZW1wQSwgdGVtcEEpO1xyXG4gIG5vcm1hbGl6ZSh0ZW1wQiwgdGVtcEIpO1xyXG5cclxuICB2YXIgY29zaW5lID0gZG90KHRlbXBBLCB0ZW1wQik7XHJcblxyXG4gIGlmIChjb3NpbmUgPiAxLjApIHtcclxuICAgIHJldHVybiAwO1xyXG4gIH0gZWxzZSBpZiAoY29zaW5lIDwgLTEuMCkge1xyXG4gICAgcmV0dXJuIE1hdGguUEk7XHJcbiAgfSBlbHNlIHtcclxuICAgIHJldHVybiBNYXRoLmFjb3MoY29zaW5lKTtcclxuICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBSZXR1cm5zIGEgc3RyaW5nIHJlcHJlc2VudGF0aW9uIG9mIGEgdmVjdG9yXHJcbiAqXHJcbiAqIEBwYXJhbSB7dmVjM30gYSB2ZWN0b3IgdG8gcmVwcmVzZW50IGFzIGEgc3RyaW5nXHJcbiAqIEByZXR1cm5zIHtTdHJpbmd9IHN0cmluZyByZXByZXNlbnRhdGlvbiBvZiB0aGUgdmVjdG9yXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gc3RyKGEpIHtcclxuICByZXR1cm4gJ3ZlYzMoJyArIGFbMF0gKyAnLCAnICsgYVsxXSArICcsICcgKyBhWzJdICsgJyknO1xyXG59XHJcblxyXG4vKipcclxuICogUmV0dXJucyB3aGV0aGVyIG9yIG5vdCB0aGUgdmVjdG9ycyBoYXZlIGV4YWN0bHkgdGhlIHNhbWUgZWxlbWVudHMgaW4gdGhlIHNhbWUgcG9zaXRpb24gKHdoZW4gY29tcGFyZWQgd2l0aCA9PT0pXHJcbiAqXHJcbiAqIEBwYXJhbSB7dmVjM30gYSBUaGUgZmlyc3QgdmVjdG9yLlxyXG4gKiBAcGFyYW0ge3ZlYzN9IGIgVGhlIHNlY29uZCB2ZWN0b3IuXHJcbiAqIEByZXR1cm5zIHtCb29sZWFufSBUcnVlIGlmIHRoZSB2ZWN0b3JzIGFyZSBlcXVhbCwgZmFsc2Ugb3RoZXJ3aXNlLlxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGV4YWN0RXF1YWxzKGEsIGIpIHtcclxuICByZXR1cm4gYVswXSA9PT0gYlswXSAmJiBhWzFdID09PSBiWzFdICYmIGFbMl0gPT09IGJbMl07XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBSZXR1cm5zIHdoZXRoZXIgb3Igbm90IHRoZSB2ZWN0b3JzIGhhdmUgYXBwcm94aW1hdGVseSB0aGUgc2FtZSBlbGVtZW50cyBpbiB0aGUgc2FtZSBwb3NpdGlvbi5cclxuICpcclxuICogQHBhcmFtIHt2ZWMzfSBhIFRoZSBmaXJzdCB2ZWN0b3IuXHJcbiAqIEBwYXJhbSB7dmVjM30gYiBUaGUgc2Vjb25kIHZlY3Rvci5cclxuICogQHJldHVybnMge0Jvb2xlYW59IFRydWUgaWYgdGhlIHZlY3RvcnMgYXJlIGVxdWFsLCBmYWxzZSBvdGhlcndpc2UuXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gZXF1YWxzKGEsIGIpIHtcclxuICB2YXIgYTAgPSBhWzBdLFxyXG4gICAgICBhMSA9IGFbMV0sXHJcbiAgICAgIGEyID0gYVsyXTtcclxuICB2YXIgYjAgPSBiWzBdLFxyXG4gICAgICBiMSA9IGJbMV0sXHJcbiAgICAgIGIyID0gYlsyXTtcclxuICByZXR1cm4gTWF0aC5hYnMoYTAgLSBiMCkgPD0gZ2xNYXRyaXguRVBTSUxPTiAqIE1hdGgubWF4KDEuMCwgTWF0aC5hYnMoYTApLCBNYXRoLmFicyhiMCkpICYmIE1hdGguYWJzKGExIC0gYjEpIDw9IGdsTWF0cml4LkVQU0lMT04gKiBNYXRoLm1heCgxLjAsIE1hdGguYWJzKGExKSwgTWF0aC5hYnMoYjEpKSAmJiBNYXRoLmFicyhhMiAtIGIyKSA8PSBnbE1hdHJpeC5FUFNJTE9OICogTWF0aC5tYXgoMS4wLCBNYXRoLmFicyhhMiksIE1hdGguYWJzKGIyKSk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBBbGlhcyBmb3Ige0BsaW5rIHZlYzMuc3VidHJhY3R9XHJcbiAqIEBmdW5jdGlvblxyXG4gKi9cclxuZXhwb3J0IHZhciBzdWIgPSBzdWJ0cmFjdDtcclxuXHJcbi8qKlxyXG4gKiBBbGlhcyBmb3Ige0BsaW5rIHZlYzMubXVsdGlwbHl9XHJcbiAqIEBmdW5jdGlvblxyXG4gKi9cclxuZXhwb3J0IHZhciBtdWwgPSBtdWx0aXBseTtcclxuXHJcbi8qKlxyXG4gKiBBbGlhcyBmb3Ige0BsaW5rIHZlYzMuZGl2aWRlfVxyXG4gKiBAZnVuY3Rpb25cclxuICovXHJcbmV4cG9ydCB2YXIgZGl2ID0gZGl2aWRlO1xyXG5cclxuLyoqXHJcbiAqIEFsaWFzIGZvciB7QGxpbmsgdmVjMy5kaXN0YW5jZX1cclxuICogQGZ1bmN0aW9uXHJcbiAqL1xyXG5leHBvcnQgdmFyIGRpc3QgPSBkaXN0YW5jZTtcclxuXHJcbi8qKlxyXG4gKiBBbGlhcyBmb3Ige0BsaW5rIHZlYzMuc3F1YXJlZERpc3RhbmNlfVxyXG4gKiBAZnVuY3Rpb25cclxuICovXHJcbmV4cG9ydCB2YXIgc3FyRGlzdCA9IHNxdWFyZWREaXN0YW5jZTtcclxuXHJcbi8qKlxyXG4gKiBBbGlhcyBmb3Ige0BsaW5rIHZlYzMubGVuZ3RofVxyXG4gKiBAZnVuY3Rpb25cclxuICovXHJcbmV4cG9ydCB2YXIgbGVuID0gbGVuZ3RoO1xyXG5cclxuLyoqXHJcbiAqIEFsaWFzIGZvciB7QGxpbmsgdmVjMy5zcXVhcmVkTGVuZ3RofVxyXG4gKiBAZnVuY3Rpb25cclxuICovXHJcbmV4cG9ydCB2YXIgc3FyTGVuID0gc3F1YXJlZExlbmd0aDtcclxuXHJcbi8qKlxyXG4gKiBQZXJmb3JtIHNvbWUgb3BlcmF0aW9uIG92ZXIgYW4gYXJyYXkgb2YgdmVjM3MuXHJcbiAqXHJcbiAqIEBwYXJhbSB7QXJyYXl9IGEgdGhlIGFycmF5IG9mIHZlY3RvcnMgdG8gaXRlcmF0ZSBvdmVyXHJcbiAqIEBwYXJhbSB7TnVtYmVyfSBzdHJpZGUgTnVtYmVyIG9mIGVsZW1lbnRzIGJldHdlZW4gdGhlIHN0YXJ0IG9mIGVhY2ggdmVjMy4gSWYgMCBhc3N1bWVzIHRpZ2h0bHkgcGFja2VkXHJcbiAqIEBwYXJhbSB7TnVtYmVyfSBvZmZzZXQgTnVtYmVyIG9mIGVsZW1lbnRzIHRvIHNraXAgYXQgdGhlIGJlZ2lubmluZyBvZiB0aGUgYXJyYXlcclxuICogQHBhcmFtIHtOdW1iZXJ9IGNvdW50IE51bWJlciBvZiB2ZWMzcyB0byBpdGVyYXRlIG92ZXIuIElmIDAgaXRlcmF0ZXMgb3ZlciBlbnRpcmUgYXJyYXlcclxuICogQHBhcmFtIHtGdW5jdGlvbn0gZm4gRnVuY3Rpb24gdG8gY2FsbCBmb3IgZWFjaCB2ZWN0b3IgaW4gdGhlIGFycmF5XHJcbiAqIEBwYXJhbSB7T2JqZWN0fSBbYXJnXSBhZGRpdGlvbmFsIGFyZ3VtZW50IHRvIHBhc3MgdG8gZm5cclxuICogQHJldHVybnMge0FycmF5fSBhXHJcbiAqIEBmdW5jdGlvblxyXG4gKi9cclxuZXhwb3J0IHZhciBmb3JFYWNoID0gZnVuY3Rpb24gKCkge1xyXG4gIHZhciB2ZWMgPSBjcmVhdGUoKTtcclxuXHJcbiAgcmV0dXJuIGZ1bmN0aW9uIChhLCBzdHJpZGUsIG9mZnNldCwgY291bnQsIGZuLCBhcmcpIHtcclxuICAgIHZhciBpID0gdm9pZCAwLFxyXG4gICAgICAgIGwgPSB2b2lkIDA7XHJcbiAgICBpZiAoIXN0cmlkZSkge1xyXG4gICAgICBzdHJpZGUgPSAzO1xyXG4gICAgfVxyXG5cclxuICAgIGlmICghb2Zmc2V0KSB7XHJcbiAgICAgIG9mZnNldCA9IDA7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGNvdW50KSB7XHJcbiAgICAgIGwgPSBNYXRoLm1pbihjb3VudCAqIHN0cmlkZSArIG9mZnNldCwgYS5sZW5ndGgpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgbCA9IGEubGVuZ3RoO1xyXG4gICAgfVxyXG5cclxuICAgIGZvciAoaSA9IG9mZnNldDsgaSA8IGw7IGkgKz0gc3RyaWRlKSB7XHJcbiAgICAgIHZlY1swXSA9IGFbaV07dmVjWzFdID0gYVtpICsgMV07dmVjWzJdID0gYVtpICsgMl07XHJcbiAgICAgIGZuKHZlYywgdmVjLCBhcmcpO1xyXG4gICAgICBhW2ldID0gdmVjWzBdO2FbaSArIDFdID0gdmVjWzFdO2FbaSArIDJdID0gdmVjWzJdO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBhO1xyXG4gIH07XHJcbn0oKTsiLCJpbXBvcnQgKiBhcyBnbE1hdHJpeCBmcm9tIFwiLi9jb21tb24uanNcIjtcclxuXHJcbi8qKlxyXG4gKiA0IERpbWVuc2lvbmFsIFZlY3RvclxyXG4gKiBAbW9kdWxlIHZlYzRcclxuICovXHJcblxyXG4vKipcclxuICogQ3JlYXRlcyBhIG5ldywgZW1wdHkgdmVjNFxyXG4gKlxyXG4gKiBAcmV0dXJucyB7dmVjNH0gYSBuZXcgNEQgdmVjdG9yXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlKCkge1xyXG4gIHZhciBvdXQgPSBuZXcgZ2xNYXRyaXguQVJSQVlfVFlQRSg0KTtcclxuICBpZiAoZ2xNYXRyaXguQVJSQVlfVFlQRSAhPSBGbG9hdDMyQXJyYXkpIHtcclxuICAgIG91dFswXSA9IDA7XHJcbiAgICBvdXRbMV0gPSAwO1xyXG4gICAgb3V0WzJdID0gMDtcclxuICAgIG91dFszXSA9IDA7XHJcbiAgfVxyXG4gIHJldHVybiBvdXQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDcmVhdGVzIGEgbmV3IHZlYzQgaW5pdGlhbGl6ZWQgd2l0aCB2YWx1ZXMgZnJvbSBhbiBleGlzdGluZyB2ZWN0b3JcclxuICpcclxuICogQHBhcmFtIHt2ZWM0fSBhIHZlY3RvciB0byBjbG9uZVxyXG4gKiBAcmV0dXJucyB7dmVjNH0gYSBuZXcgNEQgdmVjdG9yXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gY2xvbmUoYSkge1xyXG4gIHZhciBvdXQgPSBuZXcgZ2xNYXRyaXguQVJSQVlfVFlQRSg0KTtcclxuICBvdXRbMF0gPSBhWzBdO1xyXG4gIG91dFsxXSA9IGFbMV07XHJcbiAgb3V0WzJdID0gYVsyXTtcclxuICBvdXRbM10gPSBhWzNdO1xyXG4gIHJldHVybiBvdXQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDcmVhdGVzIGEgbmV3IHZlYzQgaW5pdGlhbGl6ZWQgd2l0aCB0aGUgZ2l2ZW4gdmFsdWVzXHJcbiAqXHJcbiAqIEBwYXJhbSB7TnVtYmVyfSB4IFggY29tcG9uZW50XHJcbiAqIEBwYXJhbSB7TnVtYmVyfSB5IFkgY29tcG9uZW50XHJcbiAqIEBwYXJhbSB7TnVtYmVyfSB6IFogY29tcG9uZW50XHJcbiAqIEBwYXJhbSB7TnVtYmVyfSB3IFcgY29tcG9uZW50XHJcbiAqIEByZXR1cm5zIHt2ZWM0fSBhIG5ldyA0RCB2ZWN0b3JcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBmcm9tVmFsdWVzKHgsIHksIHosIHcpIHtcclxuICB2YXIgb3V0ID0gbmV3IGdsTWF0cml4LkFSUkFZX1RZUEUoNCk7XHJcbiAgb3V0WzBdID0geDtcclxuICBvdXRbMV0gPSB5O1xyXG4gIG91dFsyXSA9IHo7XHJcbiAgb3V0WzNdID0gdztcclxuICByZXR1cm4gb3V0O1xyXG59XHJcblxyXG4vKipcclxuICogQ29weSB0aGUgdmFsdWVzIGZyb20gb25lIHZlYzQgdG8gYW5vdGhlclxyXG4gKlxyXG4gKiBAcGFyYW0ge3ZlYzR9IG91dCB0aGUgcmVjZWl2aW5nIHZlY3RvclxyXG4gKiBAcGFyYW0ge3ZlYzR9IGEgdGhlIHNvdXJjZSB2ZWN0b3JcclxuICogQHJldHVybnMge3ZlYzR9IG91dFxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGNvcHkob3V0LCBhKSB7XHJcbiAgb3V0WzBdID0gYVswXTtcclxuICBvdXRbMV0gPSBhWzFdO1xyXG4gIG91dFsyXSA9IGFbMl07XHJcbiAgb3V0WzNdID0gYVszXTtcclxuICByZXR1cm4gb3V0O1xyXG59XHJcblxyXG4vKipcclxuICogU2V0IHRoZSBjb21wb25lbnRzIG9mIGEgdmVjNCB0byB0aGUgZ2l2ZW4gdmFsdWVzXHJcbiAqXHJcbiAqIEBwYXJhbSB7dmVjNH0gb3V0IHRoZSByZWNlaXZpbmcgdmVjdG9yXHJcbiAqIEBwYXJhbSB7TnVtYmVyfSB4IFggY29tcG9uZW50XHJcbiAqIEBwYXJhbSB7TnVtYmVyfSB5IFkgY29tcG9uZW50XHJcbiAqIEBwYXJhbSB7TnVtYmVyfSB6IFogY29tcG9uZW50XHJcbiAqIEBwYXJhbSB7TnVtYmVyfSB3IFcgY29tcG9uZW50XHJcbiAqIEByZXR1cm5zIHt2ZWM0fSBvdXRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBzZXQob3V0LCB4LCB5LCB6LCB3KSB7XHJcbiAgb3V0WzBdID0geDtcclxuICBvdXRbMV0gPSB5O1xyXG4gIG91dFsyXSA9IHo7XHJcbiAgb3V0WzNdID0gdztcclxuICByZXR1cm4gb3V0O1xyXG59XHJcblxyXG4vKipcclxuICogQWRkcyB0d28gdmVjNCdzXHJcbiAqXHJcbiAqIEBwYXJhbSB7dmVjNH0gb3V0IHRoZSByZWNlaXZpbmcgdmVjdG9yXHJcbiAqIEBwYXJhbSB7dmVjNH0gYSB0aGUgZmlyc3Qgb3BlcmFuZFxyXG4gKiBAcGFyYW0ge3ZlYzR9IGIgdGhlIHNlY29uZCBvcGVyYW5kXHJcbiAqIEByZXR1cm5zIHt2ZWM0fSBvdXRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBhZGQob3V0LCBhLCBiKSB7XHJcbiAgb3V0WzBdID0gYVswXSArIGJbMF07XHJcbiAgb3V0WzFdID0gYVsxXSArIGJbMV07XHJcbiAgb3V0WzJdID0gYVsyXSArIGJbMl07XHJcbiAgb3V0WzNdID0gYVszXSArIGJbM107XHJcbiAgcmV0dXJuIG91dDtcclxufVxyXG5cclxuLyoqXHJcbiAqIFN1YnRyYWN0cyB2ZWN0b3IgYiBmcm9tIHZlY3RvciBhXHJcbiAqXHJcbiAqIEBwYXJhbSB7dmVjNH0gb3V0IHRoZSByZWNlaXZpbmcgdmVjdG9yXHJcbiAqIEBwYXJhbSB7dmVjNH0gYSB0aGUgZmlyc3Qgb3BlcmFuZFxyXG4gKiBAcGFyYW0ge3ZlYzR9IGIgdGhlIHNlY29uZCBvcGVyYW5kXHJcbiAqIEByZXR1cm5zIHt2ZWM0fSBvdXRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBzdWJ0cmFjdChvdXQsIGEsIGIpIHtcclxuICBvdXRbMF0gPSBhWzBdIC0gYlswXTtcclxuICBvdXRbMV0gPSBhWzFdIC0gYlsxXTtcclxuICBvdXRbMl0gPSBhWzJdIC0gYlsyXTtcclxuICBvdXRbM10gPSBhWzNdIC0gYlszXTtcclxuICByZXR1cm4gb3V0O1xyXG59XHJcblxyXG4vKipcclxuICogTXVsdGlwbGllcyB0d28gdmVjNCdzXHJcbiAqXHJcbiAqIEBwYXJhbSB7dmVjNH0gb3V0IHRoZSByZWNlaXZpbmcgdmVjdG9yXHJcbiAqIEBwYXJhbSB7dmVjNH0gYSB0aGUgZmlyc3Qgb3BlcmFuZFxyXG4gKiBAcGFyYW0ge3ZlYzR9IGIgdGhlIHNlY29uZCBvcGVyYW5kXHJcbiAqIEByZXR1cm5zIHt2ZWM0fSBvdXRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBtdWx0aXBseShvdXQsIGEsIGIpIHtcclxuICBvdXRbMF0gPSBhWzBdICogYlswXTtcclxuICBvdXRbMV0gPSBhWzFdICogYlsxXTtcclxuICBvdXRbMl0gPSBhWzJdICogYlsyXTtcclxuICBvdXRbM10gPSBhWzNdICogYlszXTtcclxuICByZXR1cm4gb3V0O1xyXG59XHJcblxyXG4vKipcclxuICogRGl2aWRlcyB0d28gdmVjNCdzXHJcbiAqXHJcbiAqIEBwYXJhbSB7dmVjNH0gb3V0IHRoZSByZWNlaXZpbmcgdmVjdG9yXHJcbiAqIEBwYXJhbSB7dmVjNH0gYSB0aGUgZmlyc3Qgb3BlcmFuZFxyXG4gKiBAcGFyYW0ge3ZlYzR9IGIgdGhlIHNlY29uZCBvcGVyYW5kXHJcbiAqIEByZXR1cm5zIHt2ZWM0fSBvdXRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBkaXZpZGUob3V0LCBhLCBiKSB7XHJcbiAgb3V0WzBdID0gYVswXSAvIGJbMF07XHJcbiAgb3V0WzFdID0gYVsxXSAvIGJbMV07XHJcbiAgb3V0WzJdID0gYVsyXSAvIGJbMl07XHJcbiAgb3V0WzNdID0gYVszXSAvIGJbM107XHJcbiAgcmV0dXJuIG91dDtcclxufVxyXG5cclxuLyoqXHJcbiAqIE1hdGguY2VpbCB0aGUgY29tcG9uZW50cyBvZiBhIHZlYzRcclxuICpcclxuICogQHBhcmFtIHt2ZWM0fSBvdXQgdGhlIHJlY2VpdmluZyB2ZWN0b3JcclxuICogQHBhcmFtIHt2ZWM0fSBhIHZlY3RvciB0byBjZWlsXHJcbiAqIEByZXR1cm5zIHt2ZWM0fSBvdXRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBjZWlsKG91dCwgYSkge1xyXG4gIG91dFswXSA9IE1hdGguY2VpbChhWzBdKTtcclxuICBvdXRbMV0gPSBNYXRoLmNlaWwoYVsxXSk7XHJcbiAgb3V0WzJdID0gTWF0aC5jZWlsKGFbMl0pO1xyXG4gIG91dFszXSA9IE1hdGguY2VpbChhWzNdKTtcclxuICByZXR1cm4gb3V0O1xyXG59XHJcblxyXG4vKipcclxuICogTWF0aC5mbG9vciB0aGUgY29tcG9uZW50cyBvZiBhIHZlYzRcclxuICpcclxuICogQHBhcmFtIHt2ZWM0fSBvdXQgdGhlIHJlY2VpdmluZyB2ZWN0b3JcclxuICogQHBhcmFtIHt2ZWM0fSBhIHZlY3RvciB0byBmbG9vclxyXG4gKiBAcmV0dXJucyB7dmVjNH0gb3V0XHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gZmxvb3Iob3V0LCBhKSB7XHJcbiAgb3V0WzBdID0gTWF0aC5mbG9vcihhWzBdKTtcclxuICBvdXRbMV0gPSBNYXRoLmZsb29yKGFbMV0pO1xyXG4gIG91dFsyXSA9IE1hdGguZmxvb3IoYVsyXSk7XHJcbiAgb3V0WzNdID0gTWF0aC5mbG9vcihhWzNdKTtcclxuICByZXR1cm4gb3V0O1xyXG59XHJcblxyXG4vKipcclxuICogUmV0dXJucyB0aGUgbWluaW11bSBvZiB0d28gdmVjNCdzXHJcbiAqXHJcbiAqIEBwYXJhbSB7dmVjNH0gb3V0IHRoZSByZWNlaXZpbmcgdmVjdG9yXHJcbiAqIEBwYXJhbSB7dmVjNH0gYSB0aGUgZmlyc3Qgb3BlcmFuZFxyXG4gKiBAcGFyYW0ge3ZlYzR9IGIgdGhlIHNlY29uZCBvcGVyYW5kXHJcbiAqIEByZXR1cm5zIHt2ZWM0fSBvdXRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBtaW4ob3V0LCBhLCBiKSB7XHJcbiAgb3V0WzBdID0gTWF0aC5taW4oYVswXSwgYlswXSk7XHJcbiAgb3V0WzFdID0gTWF0aC5taW4oYVsxXSwgYlsxXSk7XHJcbiAgb3V0WzJdID0gTWF0aC5taW4oYVsyXSwgYlsyXSk7XHJcbiAgb3V0WzNdID0gTWF0aC5taW4oYVszXSwgYlszXSk7XHJcbiAgcmV0dXJuIG91dDtcclxufVxyXG5cclxuLyoqXHJcbiAqIFJldHVybnMgdGhlIG1heGltdW0gb2YgdHdvIHZlYzQnc1xyXG4gKlxyXG4gKiBAcGFyYW0ge3ZlYzR9IG91dCB0aGUgcmVjZWl2aW5nIHZlY3RvclxyXG4gKiBAcGFyYW0ge3ZlYzR9IGEgdGhlIGZpcnN0IG9wZXJhbmRcclxuICogQHBhcmFtIHt2ZWM0fSBiIHRoZSBzZWNvbmQgb3BlcmFuZFxyXG4gKiBAcmV0dXJucyB7dmVjNH0gb3V0XHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gbWF4KG91dCwgYSwgYikge1xyXG4gIG91dFswXSA9IE1hdGgubWF4KGFbMF0sIGJbMF0pO1xyXG4gIG91dFsxXSA9IE1hdGgubWF4KGFbMV0sIGJbMV0pO1xyXG4gIG91dFsyXSA9IE1hdGgubWF4KGFbMl0sIGJbMl0pO1xyXG4gIG91dFszXSA9IE1hdGgubWF4KGFbM10sIGJbM10pO1xyXG4gIHJldHVybiBvdXQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBNYXRoLnJvdW5kIHRoZSBjb21wb25lbnRzIG9mIGEgdmVjNFxyXG4gKlxyXG4gKiBAcGFyYW0ge3ZlYzR9IG91dCB0aGUgcmVjZWl2aW5nIHZlY3RvclxyXG4gKiBAcGFyYW0ge3ZlYzR9IGEgdmVjdG9yIHRvIHJvdW5kXHJcbiAqIEByZXR1cm5zIHt2ZWM0fSBvdXRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiByb3VuZChvdXQsIGEpIHtcclxuICBvdXRbMF0gPSBNYXRoLnJvdW5kKGFbMF0pO1xyXG4gIG91dFsxXSA9IE1hdGgucm91bmQoYVsxXSk7XHJcbiAgb3V0WzJdID0gTWF0aC5yb3VuZChhWzJdKTtcclxuICBvdXRbM10gPSBNYXRoLnJvdW5kKGFbM10pO1xyXG4gIHJldHVybiBvdXQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBTY2FsZXMgYSB2ZWM0IGJ5IGEgc2NhbGFyIG51bWJlclxyXG4gKlxyXG4gKiBAcGFyYW0ge3ZlYzR9IG91dCB0aGUgcmVjZWl2aW5nIHZlY3RvclxyXG4gKiBAcGFyYW0ge3ZlYzR9IGEgdGhlIHZlY3RvciB0byBzY2FsZVxyXG4gKiBAcGFyYW0ge051bWJlcn0gYiBhbW91bnQgdG8gc2NhbGUgdGhlIHZlY3RvciBieVxyXG4gKiBAcmV0dXJucyB7dmVjNH0gb3V0XHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gc2NhbGUob3V0LCBhLCBiKSB7XHJcbiAgb3V0WzBdID0gYVswXSAqIGI7XHJcbiAgb3V0WzFdID0gYVsxXSAqIGI7XHJcbiAgb3V0WzJdID0gYVsyXSAqIGI7XHJcbiAgb3V0WzNdID0gYVszXSAqIGI7XHJcbiAgcmV0dXJuIG91dDtcclxufVxyXG5cclxuLyoqXHJcbiAqIEFkZHMgdHdvIHZlYzQncyBhZnRlciBzY2FsaW5nIHRoZSBzZWNvbmQgb3BlcmFuZCBieSBhIHNjYWxhciB2YWx1ZVxyXG4gKlxyXG4gKiBAcGFyYW0ge3ZlYzR9IG91dCB0aGUgcmVjZWl2aW5nIHZlY3RvclxyXG4gKiBAcGFyYW0ge3ZlYzR9IGEgdGhlIGZpcnN0IG9wZXJhbmRcclxuICogQHBhcmFtIHt2ZWM0fSBiIHRoZSBzZWNvbmQgb3BlcmFuZFxyXG4gKiBAcGFyYW0ge051bWJlcn0gc2NhbGUgdGhlIGFtb3VudCB0byBzY2FsZSBiIGJ5IGJlZm9yZSBhZGRpbmdcclxuICogQHJldHVybnMge3ZlYzR9IG91dFxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIHNjYWxlQW5kQWRkKG91dCwgYSwgYiwgc2NhbGUpIHtcclxuICBvdXRbMF0gPSBhWzBdICsgYlswXSAqIHNjYWxlO1xyXG4gIG91dFsxXSA9IGFbMV0gKyBiWzFdICogc2NhbGU7XHJcbiAgb3V0WzJdID0gYVsyXSArIGJbMl0gKiBzY2FsZTtcclxuICBvdXRbM10gPSBhWzNdICsgYlszXSAqIHNjYWxlO1xyXG4gIHJldHVybiBvdXQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDYWxjdWxhdGVzIHRoZSBldWNsaWRpYW4gZGlzdGFuY2UgYmV0d2VlbiB0d28gdmVjNCdzXHJcbiAqXHJcbiAqIEBwYXJhbSB7dmVjNH0gYSB0aGUgZmlyc3Qgb3BlcmFuZFxyXG4gKiBAcGFyYW0ge3ZlYzR9IGIgdGhlIHNlY29uZCBvcGVyYW5kXHJcbiAqIEByZXR1cm5zIHtOdW1iZXJ9IGRpc3RhbmNlIGJldHdlZW4gYSBhbmQgYlxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGRpc3RhbmNlKGEsIGIpIHtcclxuICB2YXIgeCA9IGJbMF0gLSBhWzBdO1xyXG4gIHZhciB5ID0gYlsxXSAtIGFbMV07XHJcbiAgdmFyIHogPSBiWzJdIC0gYVsyXTtcclxuICB2YXIgdyA9IGJbM10gLSBhWzNdO1xyXG4gIHJldHVybiBNYXRoLnNxcnQoeCAqIHggKyB5ICogeSArIHogKiB6ICsgdyAqIHcpO1xyXG59XHJcblxyXG4vKipcclxuICogQ2FsY3VsYXRlcyB0aGUgc3F1YXJlZCBldWNsaWRpYW4gZGlzdGFuY2UgYmV0d2VlbiB0d28gdmVjNCdzXHJcbiAqXHJcbiAqIEBwYXJhbSB7dmVjNH0gYSB0aGUgZmlyc3Qgb3BlcmFuZFxyXG4gKiBAcGFyYW0ge3ZlYzR9IGIgdGhlIHNlY29uZCBvcGVyYW5kXHJcbiAqIEByZXR1cm5zIHtOdW1iZXJ9IHNxdWFyZWQgZGlzdGFuY2UgYmV0d2VlbiBhIGFuZCBiXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gc3F1YXJlZERpc3RhbmNlKGEsIGIpIHtcclxuICB2YXIgeCA9IGJbMF0gLSBhWzBdO1xyXG4gIHZhciB5ID0gYlsxXSAtIGFbMV07XHJcbiAgdmFyIHogPSBiWzJdIC0gYVsyXTtcclxuICB2YXIgdyA9IGJbM10gLSBhWzNdO1xyXG4gIHJldHVybiB4ICogeCArIHkgKiB5ICsgeiAqIHogKyB3ICogdztcclxufVxyXG5cclxuLyoqXHJcbiAqIENhbGN1bGF0ZXMgdGhlIGxlbmd0aCBvZiBhIHZlYzRcclxuICpcclxuICogQHBhcmFtIHt2ZWM0fSBhIHZlY3RvciB0byBjYWxjdWxhdGUgbGVuZ3RoIG9mXHJcbiAqIEByZXR1cm5zIHtOdW1iZXJ9IGxlbmd0aCBvZiBhXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gbGVuZ3RoKGEpIHtcclxuICB2YXIgeCA9IGFbMF07XHJcbiAgdmFyIHkgPSBhWzFdO1xyXG4gIHZhciB6ID0gYVsyXTtcclxuICB2YXIgdyA9IGFbM107XHJcbiAgcmV0dXJuIE1hdGguc3FydCh4ICogeCArIHkgKiB5ICsgeiAqIHogKyB3ICogdyk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDYWxjdWxhdGVzIHRoZSBzcXVhcmVkIGxlbmd0aCBvZiBhIHZlYzRcclxuICpcclxuICogQHBhcmFtIHt2ZWM0fSBhIHZlY3RvciB0byBjYWxjdWxhdGUgc3F1YXJlZCBsZW5ndGggb2ZcclxuICogQHJldHVybnMge051bWJlcn0gc3F1YXJlZCBsZW5ndGggb2YgYVxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIHNxdWFyZWRMZW5ndGgoYSkge1xyXG4gIHZhciB4ID0gYVswXTtcclxuICB2YXIgeSA9IGFbMV07XHJcbiAgdmFyIHogPSBhWzJdO1xyXG4gIHZhciB3ID0gYVszXTtcclxuICByZXR1cm4geCAqIHggKyB5ICogeSArIHogKiB6ICsgdyAqIHc7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBOZWdhdGVzIHRoZSBjb21wb25lbnRzIG9mIGEgdmVjNFxyXG4gKlxyXG4gKiBAcGFyYW0ge3ZlYzR9IG91dCB0aGUgcmVjZWl2aW5nIHZlY3RvclxyXG4gKiBAcGFyYW0ge3ZlYzR9IGEgdmVjdG9yIHRvIG5lZ2F0ZVxyXG4gKiBAcmV0dXJucyB7dmVjNH0gb3V0XHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gbmVnYXRlKG91dCwgYSkge1xyXG4gIG91dFswXSA9IC1hWzBdO1xyXG4gIG91dFsxXSA9IC1hWzFdO1xyXG4gIG91dFsyXSA9IC1hWzJdO1xyXG4gIG91dFszXSA9IC1hWzNdO1xyXG4gIHJldHVybiBvdXQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBSZXR1cm5zIHRoZSBpbnZlcnNlIG9mIHRoZSBjb21wb25lbnRzIG9mIGEgdmVjNFxyXG4gKlxyXG4gKiBAcGFyYW0ge3ZlYzR9IG91dCB0aGUgcmVjZWl2aW5nIHZlY3RvclxyXG4gKiBAcGFyYW0ge3ZlYzR9IGEgdmVjdG9yIHRvIGludmVydFxyXG4gKiBAcmV0dXJucyB7dmVjNH0gb3V0XHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gaW52ZXJzZShvdXQsIGEpIHtcclxuICBvdXRbMF0gPSAxLjAgLyBhWzBdO1xyXG4gIG91dFsxXSA9IDEuMCAvIGFbMV07XHJcbiAgb3V0WzJdID0gMS4wIC8gYVsyXTtcclxuICBvdXRbM10gPSAxLjAgLyBhWzNdO1xyXG4gIHJldHVybiBvdXQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBOb3JtYWxpemUgYSB2ZWM0XHJcbiAqXHJcbiAqIEBwYXJhbSB7dmVjNH0gb3V0IHRoZSByZWNlaXZpbmcgdmVjdG9yXHJcbiAqIEBwYXJhbSB7dmVjNH0gYSB2ZWN0b3IgdG8gbm9ybWFsaXplXHJcbiAqIEByZXR1cm5zIHt2ZWM0fSBvdXRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBub3JtYWxpemUob3V0LCBhKSB7XHJcbiAgdmFyIHggPSBhWzBdO1xyXG4gIHZhciB5ID0gYVsxXTtcclxuICB2YXIgeiA9IGFbMl07XHJcbiAgdmFyIHcgPSBhWzNdO1xyXG4gIHZhciBsZW4gPSB4ICogeCArIHkgKiB5ICsgeiAqIHogKyB3ICogdztcclxuICBpZiAobGVuID4gMCkge1xyXG4gICAgbGVuID0gMSAvIE1hdGguc3FydChsZW4pO1xyXG4gICAgb3V0WzBdID0geCAqIGxlbjtcclxuICAgIG91dFsxXSA9IHkgKiBsZW47XHJcbiAgICBvdXRbMl0gPSB6ICogbGVuO1xyXG4gICAgb3V0WzNdID0gdyAqIGxlbjtcclxuICB9XHJcbiAgcmV0dXJuIG91dDtcclxufVxyXG5cclxuLyoqXHJcbiAqIENhbGN1bGF0ZXMgdGhlIGRvdCBwcm9kdWN0IG9mIHR3byB2ZWM0J3NcclxuICpcclxuICogQHBhcmFtIHt2ZWM0fSBhIHRoZSBmaXJzdCBvcGVyYW5kXHJcbiAqIEBwYXJhbSB7dmVjNH0gYiB0aGUgc2Vjb25kIG9wZXJhbmRcclxuICogQHJldHVybnMge051bWJlcn0gZG90IHByb2R1Y3Qgb2YgYSBhbmQgYlxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGRvdChhLCBiKSB7XHJcbiAgcmV0dXJuIGFbMF0gKiBiWzBdICsgYVsxXSAqIGJbMV0gKyBhWzJdICogYlsyXSArIGFbM10gKiBiWzNdO1xyXG59XHJcblxyXG4vKipcclxuICogUGVyZm9ybXMgYSBsaW5lYXIgaW50ZXJwb2xhdGlvbiBiZXR3ZWVuIHR3byB2ZWM0J3NcclxuICpcclxuICogQHBhcmFtIHt2ZWM0fSBvdXQgdGhlIHJlY2VpdmluZyB2ZWN0b3JcclxuICogQHBhcmFtIHt2ZWM0fSBhIHRoZSBmaXJzdCBvcGVyYW5kXHJcbiAqIEBwYXJhbSB7dmVjNH0gYiB0aGUgc2Vjb25kIG9wZXJhbmRcclxuICogQHBhcmFtIHtOdW1iZXJ9IHQgaW50ZXJwb2xhdGlvbiBhbW91bnQsIGluIHRoZSByYW5nZSBbMC0xXSwgYmV0d2VlbiB0aGUgdHdvIGlucHV0c1xyXG4gKiBAcmV0dXJucyB7dmVjNH0gb3V0XHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gbGVycChvdXQsIGEsIGIsIHQpIHtcclxuICB2YXIgYXggPSBhWzBdO1xyXG4gIHZhciBheSA9IGFbMV07XHJcbiAgdmFyIGF6ID0gYVsyXTtcclxuICB2YXIgYXcgPSBhWzNdO1xyXG4gIG91dFswXSA9IGF4ICsgdCAqIChiWzBdIC0gYXgpO1xyXG4gIG91dFsxXSA9IGF5ICsgdCAqIChiWzFdIC0gYXkpO1xyXG4gIG91dFsyXSA9IGF6ICsgdCAqIChiWzJdIC0gYXopO1xyXG4gIG91dFszXSA9IGF3ICsgdCAqIChiWzNdIC0gYXcpO1xyXG4gIHJldHVybiBvdXQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBHZW5lcmF0ZXMgYSByYW5kb20gdmVjdG9yIHdpdGggdGhlIGdpdmVuIHNjYWxlXHJcbiAqXHJcbiAqIEBwYXJhbSB7dmVjNH0gb3V0IHRoZSByZWNlaXZpbmcgdmVjdG9yXHJcbiAqIEBwYXJhbSB7TnVtYmVyfSBbc2NhbGVdIExlbmd0aCBvZiB0aGUgcmVzdWx0aW5nIHZlY3Rvci4gSWYgb21taXR0ZWQsIGEgdW5pdCB2ZWN0b3Igd2lsbCBiZSByZXR1cm5lZFxyXG4gKiBAcmV0dXJucyB7dmVjNH0gb3V0XHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gcmFuZG9tKG91dCwgc2NhbGUpIHtcclxuICBzY2FsZSA9IHNjYWxlIHx8IDEuMDtcclxuXHJcbiAgLy8gTWFyc2FnbGlhLCBHZW9yZ2UuIENob29zaW5nIGEgUG9pbnQgZnJvbSB0aGUgU3VyZmFjZSBvZiBhXHJcbiAgLy8gU3BoZXJlLiBBbm4uIE1hdGguIFN0YXRpc3QuIDQzICgxOTcyKSwgbm8uIDIsIDY0NS0tNjQ2LlxyXG4gIC8vIGh0dHA6Ly9wcm9qZWN0ZXVjbGlkLm9yZy9ldWNsaWQuYW9tcy8xMTc3NjkyNjQ0O1xyXG4gIHZhciB2MSwgdjIsIHYzLCB2NDtcclxuICB2YXIgczEsIHMyO1xyXG4gIGRvIHtcclxuICAgIHYxID0gZ2xNYXRyaXguUkFORE9NKCkgKiAyIC0gMTtcclxuICAgIHYyID0gZ2xNYXRyaXguUkFORE9NKCkgKiAyIC0gMTtcclxuICAgIHMxID0gdjEgKiB2MSArIHYyICogdjI7XHJcbiAgfSB3aGlsZSAoczEgPj0gMSk7XHJcbiAgZG8ge1xyXG4gICAgdjMgPSBnbE1hdHJpeC5SQU5ET00oKSAqIDIgLSAxO1xyXG4gICAgdjQgPSBnbE1hdHJpeC5SQU5ET00oKSAqIDIgLSAxO1xyXG4gICAgczIgPSB2MyAqIHYzICsgdjQgKiB2NDtcclxuICB9IHdoaWxlIChzMiA+PSAxKTtcclxuXHJcbiAgdmFyIGQgPSBNYXRoLnNxcnQoKDEgLSBzMSkgLyBzMik7XHJcbiAgb3V0WzBdID0gc2NhbGUgKiB2MTtcclxuICBvdXRbMV0gPSBzY2FsZSAqIHYyO1xyXG4gIG91dFsyXSA9IHNjYWxlICogdjMgKiBkO1xyXG4gIG91dFszXSA9IHNjYWxlICogdjQgKiBkO1xyXG4gIHJldHVybiBvdXQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBUcmFuc2Zvcm1zIHRoZSB2ZWM0IHdpdGggYSBtYXQ0LlxyXG4gKlxyXG4gKiBAcGFyYW0ge3ZlYzR9IG91dCB0aGUgcmVjZWl2aW5nIHZlY3RvclxyXG4gKiBAcGFyYW0ge3ZlYzR9IGEgdGhlIHZlY3RvciB0byB0cmFuc2Zvcm1cclxuICogQHBhcmFtIHttYXQ0fSBtIG1hdHJpeCB0byB0cmFuc2Zvcm0gd2l0aFxyXG4gKiBAcmV0dXJucyB7dmVjNH0gb3V0XHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gdHJhbnNmb3JtTWF0NChvdXQsIGEsIG0pIHtcclxuICB2YXIgeCA9IGFbMF0sXHJcbiAgICAgIHkgPSBhWzFdLFxyXG4gICAgICB6ID0gYVsyXSxcclxuICAgICAgdyA9IGFbM107XHJcbiAgb3V0WzBdID0gbVswXSAqIHggKyBtWzRdICogeSArIG1bOF0gKiB6ICsgbVsxMl0gKiB3O1xyXG4gIG91dFsxXSA9IG1bMV0gKiB4ICsgbVs1XSAqIHkgKyBtWzldICogeiArIG1bMTNdICogdztcclxuICBvdXRbMl0gPSBtWzJdICogeCArIG1bNl0gKiB5ICsgbVsxMF0gKiB6ICsgbVsxNF0gKiB3O1xyXG4gIG91dFszXSA9IG1bM10gKiB4ICsgbVs3XSAqIHkgKyBtWzExXSAqIHogKyBtWzE1XSAqIHc7XHJcbiAgcmV0dXJuIG91dDtcclxufVxyXG5cclxuLyoqXHJcbiAqIFRyYW5zZm9ybXMgdGhlIHZlYzQgd2l0aCBhIHF1YXRcclxuICpcclxuICogQHBhcmFtIHt2ZWM0fSBvdXQgdGhlIHJlY2VpdmluZyB2ZWN0b3JcclxuICogQHBhcmFtIHt2ZWM0fSBhIHRoZSB2ZWN0b3IgdG8gdHJhbnNmb3JtXHJcbiAqIEBwYXJhbSB7cXVhdH0gcSBxdWF0ZXJuaW9uIHRvIHRyYW5zZm9ybSB3aXRoXHJcbiAqIEByZXR1cm5zIHt2ZWM0fSBvdXRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiB0cmFuc2Zvcm1RdWF0KG91dCwgYSwgcSkge1xyXG4gIHZhciB4ID0gYVswXSxcclxuICAgICAgeSA9IGFbMV0sXHJcbiAgICAgIHogPSBhWzJdO1xyXG4gIHZhciBxeCA9IHFbMF0sXHJcbiAgICAgIHF5ID0gcVsxXSxcclxuICAgICAgcXogPSBxWzJdLFxyXG4gICAgICBxdyA9IHFbM107XHJcblxyXG4gIC8vIGNhbGN1bGF0ZSBxdWF0ICogdmVjXHJcbiAgdmFyIGl4ID0gcXcgKiB4ICsgcXkgKiB6IC0gcXogKiB5O1xyXG4gIHZhciBpeSA9IHF3ICogeSArIHF6ICogeCAtIHF4ICogejtcclxuICB2YXIgaXogPSBxdyAqIHogKyBxeCAqIHkgLSBxeSAqIHg7XHJcbiAgdmFyIGl3ID0gLXF4ICogeCAtIHF5ICogeSAtIHF6ICogejtcclxuXHJcbiAgLy8gY2FsY3VsYXRlIHJlc3VsdCAqIGludmVyc2UgcXVhdFxyXG4gIG91dFswXSA9IGl4ICogcXcgKyBpdyAqIC1xeCArIGl5ICogLXF6IC0gaXogKiAtcXk7XHJcbiAgb3V0WzFdID0gaXkgKiBxdyArIGl3ICogLXF5ICsgaXogKiAtcXggLSBpeCAqIC1xejtcclxuICBvdXRbMl0gPSBpeiAqIHF3ICsgaXcgKiAtcXogKyBpeCAqIC1xeSAtIGl5ICogLXF4O1xyXG4gIG91dFszXSA9IGFbM107XHJcbiAgcmV0dXJuIG91dDtcclxufVxyXG5cclxuLyoqXHJcbiAqIFJldHVybnMgYSBzdHJpbmcgcmVwcmVzZW50YXRpb24gb2YgYSB2ZWN0b3JcclxuICpcclxuICogQHBhcmFtIHt2ZWM0fSBhIHZlY3RvciB0byByZXByZXNlbnQgYXMgYSBzdHJpbmdcclxuICogQHJldHVybnMge1N0cmluZ30gc3RyaW5nIHJlcHJlc2VudGF0aW9uIG9mIHRoZSB2ZWN0b3JcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBzdHIoYSkge1xyXG4gIHJldHVybiAndmVjNCgnICsgYVswXSArICcsICcgKyBhWzFdICsgJywgJyArIGFbMl0gKyAnLCAnICsgYVszXSArICcpJztcclxufVxyXG5cclxuLyoqXHJcbiAqIFJldHVybnMgd2hldGhlciBvciBub3QgdGhlIHZlY3RvcnMgaGF2ZSBleGFjdGx5IHRoZSBzYW1lIGVsZW1lbnRzIGluIHRoZSBzYW1lIHBvc2l0aW9uICh3aGVuIGNvbXBhcmVkIHdpdGggPT09KVxyXG4gKlxyXG4gKiBAcGFyYW0ge3ZlYzR9IGEgVGhlIGZpcnN0IHZlY3Rvci5cclxuICogQHBhcmFtIHt2ZWM0fSBiIFRoZSBzZWNvbmQgdmVjdG9yLlxyXG4gKiBAcmV0dXJucyB7Qm9vbGVhbn0gVHJ1ZSBpZiB0aGUgdmVjdG9ycyBhcmUgZXF1YWwsIGZhbHNlIG90aGVyd2lzZS5cclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBleGFjdEVxdWFscyhhLCBiKSB7XHJcbiAgcmV0dXJuIGFbMF0gPT09IGJbMF0gJiYgYVsxXSA9PT0gYlsxXSAmJiBhWzJdID09PSBiWzJdICYmIGFbM10gPT09IGJbM107XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBSZXR1cm5zIHdoZXRoZXIgb3Igbm90IHRoZSB2ZWN0b3JzIGhhdmUgYXBwcm94aW1hdGVseSB0aGUgc2FtZSBlbGVtZW50cyBpbiB0aGUgc2FtZSBwb3NpdGlvbi5cclxuICpcclxuICogQHBhcmFtIHt2ZWM0fSBhIFRoZSBmaXJzdCB2ZWN0b3IuXHJcbiAqIEBwYXJhbSB7dmVjNH0gYiBUaGUgc2Vjb25kIHZlY3Rvci5cclxuICogQHJldHVybnMge0Jvb2xlYW59IFRydWUgaWYgdGhlIHZlY3RvcnMgYXJlIGVxdWFsLCBmYWxzZSBvdGhlcndpc2UuXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gZXF1YWxzKGEsIGIpIHtcclxuICB2YXIgYTAgPSBhWzBdLFxyXG4gICAgICBhMSA9IGFbMV0sXHJcbiAgICAgIGEyID0gYVsyXSxcclxuICAgICAgYTMgPSBhWzNdO1xyXG4gIHZhciBiMCA9IGJbMF0sXHJcbiAgICAgIGIxID0gYlsxXSxcclxuICAgICAgYjIgPSBiWzJdLFxyXG4gICAgICBiMyA9IGJbM107XHJcbiAgcmV0dXJuIE1hdGguYWJzKGEwIC0gYjApIDw9IGdsTWF0cml4LkVQU0lMT04gKiBNYXRoLm1heCgxLjAsIE1hdGguYWJzKGEwKSwgTWF0aC5hYnMoYjApKSAmJiBNYXRoLmFicyhhMSAtIGIxKSA8PSBnbE1hdHJpeC5FUFNJTE9OICogTWF0aC5tYXgoMS4wLCBNYXRoLmFicyhhMSksIE1hdGguYWJzKGIxKSkgJiYgTWF0aC5hYnMoYTIgLSBiMikgPD0gZ2xNYXRyaXguRVBTSUxPTiAqIE1hdGgubWF4KDEuMCwgTWF0aC5hYnMoYTIpLCBNYXRoLmFicyhiMikpICYmIE1hdGguYWJzKGEzIC0gYjMpIDw9IGdsTWF0cml4LkVQU0lMT04gKiBNYXRoLm1heCgxLjAsIE1hdGguYWJzKGEzKSwgTWF0aC5hYnMoYjMpKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIEFsaWFzIGZvciB7QGxpbmsgdmVjNC5zdWJ0cmFjdH1cclxuICogQGZ1bmN0aW9uXHJcbiAqL1xyXG5leHBvcnQgdmFyIHN1YiA9IHN1YnRyYWN0O1xyXG5cclxuLyoqXHJcbiAqIEFsaWFzIGZvciB7QGxpbmsgdmVjNC5tdWx0aXBseX1cclxuICogQGZ1bmN0aW9uXHJcbiAqL1xyXG5leHBvcnQgdmFyIG11bCA9IG11bHRpcGx5O1xyXG5cclxuLyoqXHJcbiAqIEFsaWFzIGZvciB7QGxpbmsgdmVjNC5kaXZpZGV9XHJcbiAqIEBmdW5jdGlvblxyXG4gKi9cclxuZXhwb3J0IHZhciBkaXYgPSBkaXZpZGU7XHJcblxyXG4vKipcclxuICogQWxpYXMgZm9yIHtAbGluayB2ZWM0LmRpc3RhbmNlfVxyXG4gKiBAZnVuY3Rpb25cclxuICovXHJcbmV4cG9ydCB2YXIgZGlzdCA9IGRpc3RhbmNlO1xyXG5cclxuLyoqXHJcbiAqIEFsaWFzIGZvciB7QGxpbmsgdmVjNC5zcXVhcmVkRGlzdGFuY2V9XHJcbiAqIEBmdW5jdGlvblxyXG4gKi9cclxuZXhwb3J0IHZhciBzcXJEaXN0ID0gc3F1YXJlZERpc3RhbmNlO1xyXG5cclxuLyoqXHJcbiAqIEFsaWFzIGZvciB7QGxpbmsgdmVjNC5sZW5ndGh9XHJcbiAqIEBmdW5jdGlvblxyXG4gKi9cclxuZXhwb3J0IHZhciBsZW4gPSBsZW5ndGg7XHJcblxyXG4vKipcclxuICogQWxpYXMgZm9yIHtAbGluayB2ZWM0LnNxdWFyZWRMZW5ndGh9XHJcbiAqIEBmdW5jdGlvblxyXG4gKi9cclxuZXhwb3J0IHZhciBzcXJMZW4gPSBzcXVhcmVkTGVuZ3RoO1xyXG5cclxuLyoqXHJcbiAqIFBlcmZvcm0gc29tZSBvcGVyYXRpb24gb3ZlciBhbiBhcnJheSBvZiB2ZWM0cy5cclxuICpcclxuICogQHBhcmFtIHtBcnJheX0gYSB0aGUgYXJyYXkgb2YgdmVjdG9ycyB0byBpdGVyYXRlIG92ZXJcclxuICogQHBhcmFtIHtOdW1iZXJ9IHN0cmlkZSBOdW1iZXIgb2YgZWxlbWVudHMgYmV0d2VlbiB0aGUgc3RhcnQgb2YgZWFjaCB2ZWM0LiBJZiAwIGFzc3VtZXMgdGlnaHRseSBwYWNrZWRcclxuICogQHBhcmFtIHtOdW1iZXJ9IG9mZnNldCBOdW1iZXIgb2YgZWxlbWVudHMgdG8gc2tpcCBhdCB0aGUgYmVnaW5uaW5nIG9mIHRoZSBhcnJheVxyXG4gKiBAcGFyYW0ge051bWJlcn0gY291bnQgTnVtYmVyIG9mIHZlYzRzIHRvIGl0ZXJhdGUgb3Zlci4gSWYgMCBpdGVyYXRlcyBvdmVyIGVudGlyZSBhcnJheVxyXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBmbiBGdW5jdGlvbiB0byBjYWxsIGZvciBlYWNoIHZlY3RvciBpbiB0aGUgYXJyYXlcclxuICogQHBhcmFtIHtPYmplY3R9IFthcmddIGFkZGl0aW9uYWwgYXJndW1lbnQgdG8gcGFzcyB0byBmblxyXG4gKiBAcmV0dXJucyB7QXJyYXl9IGFcclxuICogQGZ1bmN0aW9uXHJcbiAqL1xyXG5leHBvcnQgdmFyIGZvckVhY2ggPSBmdW5jdGlvbiAoKSB7XHJcbiAgdmFyIHZlYyA9IGNyZWF0ZSgpO1xyXG5cclxuICByZXR1cm4gZnVuY3Rpb24gKGEsIHN0cmlkZSwgb2Zmc2V0LCBjb3VudCwgZm4sIGFyZykge1xyXG4gICAgdmFyIGkgPSB2b2lkIDAsXHJcbiAgICAgICAgbCA9IHZvaWQgMDtcclxuICAgIGlmICghc3RyaWRlKSB7XHJcbiAgICAgIHN0cmlkZSA9IDQ7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKCFvZmZzZXQpIHtcclxuICAgICAgb2Zmc2V0ID0gMDtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoY291bnQpIHtcclxuICAgICAgbCA9IE1hdGgubWluKGNvdW50ICogc3RyaWRlICsgb2Zmc2V0LCBhLmxlbmd0aCk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBsID0gYS5sZW5ndGg7XHJcbiAgICB9XHJcblxyXG4gICAgZm9yIChpID0gb2Zmc2V0OyBpIDwgbDsgaSArPSBzdHJpZGUpIHtcclxuICAgICAgdmVjWzBdID0gYVtpXTt2ZWNbMV0gPSBhW2kgKyAxXTt2ZWNbMl0gPSBhW2kgKyAyXTt2ZWNbM10gPSBhW2kgKyAzXTtcclxuICAgICAgZm4odmVjLCB2ZWMsIGFyZyk7XHJcbiAgICAgIGFbaV0gPSB2ZWNbMF07YVtpICsgMV0gPSB2ZWNbMV07YVtpICsgMl0gPSB2ZWNbMl07YVtpICsgM10gPSB2ZWNbM107XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIGE7XHJcbiAgfTtcclxufSgpOyIsImltcG9ydCAqIGFzIGdsTWF0cml4IGZyb20gXCIuL2NvbW1vbi5qc1wiO1xyXG5pbXBvcnQgKiBhcyBtYXQzIGZyb20gXCIuL21hdDMuanNcIjtcclxuaW1wb3J0ICogYXMgdmVjMyBmcm9tIFwiLi92ZWMzLmpzXCI7XHJcbmltcG9ydCAqIGFzIHZlYzQgZnJvbSBcIi4vdmVjNC5qc1wiO1xyXG5cclxuLyoqXHJcbiAqIFF1YXRlcm5pb25cclxuICogQG1vZHVsZSBxdWF0XHJcbiAqL1xyXG5cclxuLyoqXHJcbiAqIENyZWF0ZXMgYSBuZXcgaWRlbnRpdHkgcXVhdFxyXG4gKlxyXG4gKiBAcmV0dXJucyB7cXVhdH0gYSBuZXcgcXVhdGVybmlvblxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZSgpIHtcclxuICB2YXIgb3V0ID0gbmV3IGdsTWF0cml4LkFSUkFZX1RZUEUoNCk7XHJcbiAgaWYgKGdsTWF0cml4LkFSUkFZX1RZUEUgIT0gRmxvYXQzMkFycmF5KSB7XHJcbiAgICBvdXRbMF0gPSAwO1xyXG4gICAgb3V0WzFdID0gMDtcclxuICAgIG91dFsyXSA9IDA7XHJcbiAgfVxyXG4gIG91dFszXSA9IDE7XHJcbiAgcmV0dXJuIG91dDtcclxufVxyXG5cclxuLyoqXHJcbiAqIFNldCBhIHF1YXQgdG8gdGhlIGlkZW50aXR5IHF1YXRlcm5pb25cclxuICpcclxuICogQHBhcmFtIHtxdWF0fSBvdXQgdGhlIHJlY2VpdmluZyBxdWF0ZXJuaW9uXHJcbiAqIEByZXR1cm5zIHtxdWF0fSBvdXRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBpZGVudGl0eShvdXQpIHtcclxuICBvdXRbMF0gPSAwO1xyXG4gIG91dFsxXSA9IDA7XHJcbiAgb3V0WzJdID0gMDtcclxuICBvdXRbM10gPSAxO1xyXG4gIHJldHVybiBvdXQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBTZXRzIGEgcXVhdCBmcm9tIHRoZSBnaXZlbiBhbmdsZSBhbmQgcm90YXRpb24gYXhpcyxcclxuICogdGhlbiByZXR1cm5zIGl0LlxyXG4gKlxyXG4gKiBAcGFyYW0ge3F1YXR9IG91dCB0aGUgcmVjZWl2aW5nIHF1YXRlcm5pb25cclxuICogQHBhcmFtIHt2ZWMzfSBheGlzIHRoZSBheGlzIGFyb3VuZCB3aGljaCB0byByb3RhdGVcclxuICogQHBhcmFtIHtOdW1iZXJ9IHJhZCB0aGUgYW5nbGUgaW4gcmFkaWFuc1xyXG4gKiBAcmV0dXJucyB7cXVhdH0gb3V0XHJcbiAqKi9cclxuZXhwb3J0IGZ1bmN0aW9uIHNldEF4aXNBbmdsZShvdXQsIGF4aXMsIHJhZCkge1xyXG4gIHJhZCA9IHJhZCAqIDAuNTtcclxuICB2YXIgcyA9IE1hdGguc2luKHJhZCk7XHJcbiAgb3V0WzBdID0gcyAqIGF4aXNbMF07XHJcbiAgb3V0WzFdID0gcyAqIGF4aXNbMV07XHJcbiAgb3V0WzJdID0gcyAqIGF4aXNbMl07XHJcbiAgb3V0WzNdID0gTWF0aC5jb3MocmFkKTtcclxuICByZXR1cm4gb3V0O1xyXG59XHJcblxyXG4vKipcclxuICogR2V0cyB0aGUgcm90YXRpb24gYXhpcyBhbmQgYW5nbGUgZm9yIGEgZ2l2ZW5cclxuICogIHF1YXRlcm5pb24uIElmIGEgcXVhdGVybmlvbiBpcyBjcmVhdGVkIHdpdGhcclxuICogIHNldEF4aXNBbmdsZSwgdGhpcyBtZXRob2Qgd2lsbCByZXR1cm4gdGhlIHNhbWVcclxuICogIHZhbHVlcyBhcyBwcm92aWRpZWQgaW4gdGhlIG9yaWdpbmFsIHBhcmFtZXRlciBsaXN0XHJcbiAqICBPUiBmdW5jdGlvbmFsbHkgZXF1aXZhbGVudCB2YWx1ZXMuXHJcbiAqIEV4YW1wbGU6IFRoZSBxdWF0ZXJuaW9uIGZvcm1lZCBieSBheGlzIFswLCAwLCAxXSBhbmRcclxuICogIGFuZ2xlIC05MCBpcyB0aGUgc2FtZSBhcyB0aGUgcXVhdGVybmlvbiBmb3JtZWQgYnlcclxuICogIFswLCAwLCAxXSBhbmQgMjcwLiBUaGlzIG1ldGhvZCBmYXZvcnMgdGhlIGxhdHRlci5cclxuICogQHBhcmFtICB7dmVjM30gb3V0X2F4aXMgIFZlY3RvciByZWNlaXZpbmcgdGhlIGF4aXMgb2Ygcm90YXRpb25cclxuICogQHBhcmFtICB7cXVhdH0gcSAgICAgUXVhdGVybmlvbiB0byBiZSBkZWNvbXBvc2VkXHJcbiAqIEByZXR1cm4ge051bWJlcn0gICAgIEFuZ2xlLCBpbiByYWRpYW5zLCBvZiB0aGUgcm90YXRpb25cclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBnZXRBeGlzQW5nbGUob3V0X2F4aXMsIHEpIHtcclxuICB2YXIgcmFkID0gTWF0aC5hY29zKHFbM10pICogMi4wO1xyXG4gIHZhciBzID0gTWF0aC5zaW4ocmFkIC8gMi4wKTtcclxuICBpZiAocyA+IGdsTWF0cml4LkVQU0lMT04pIHtcclxuICAgIG91dF9heGlzWzBdID0gcVswXSAvIHM7XHJcbiAgICBvdXRfYXhpc1sxXSA9IHFbMV0gLyBzO1xyXG4gICAgb3V0X2F4aXNbMl0gPSBxWzJdIC8gcztcclxuICB9IGVsc2Uge1xyXG4gICAgLy8gSWYgcyBpcyB6ZXJvLCByZXR1cm4gYW55IGF4aXMgKG5vIHJvdGF0aW9uIC0gYXhpcyBkb2VzIG5vdCBtYXR0ZXIpXHJcbiAgICBvdXRfYXhpc1swXSA9IDE7XHJcbiAgICBvdXRfYXhpc1sxXSA9IDA7XHJcbiAgICBvdXRfYXhpc1syXSA9IDA7XHJcbiAgfVxyXG4gIHJldHVybiByYWQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBNdWx0aXBsaWVzIHR3byBxdWF0J3NcclxuICpcclxuICogQHBhcmFtIHtxdWF0fSBvdXQgdGhlIHJlY2VpdmluZyBxdWF0ZXJuaW9uXHJcbiAqIEBwYXJhbSB7cXVhdH0gYSB0aGUgZmlyc3Qgb3BlcmFuZFxyXG4gKiBAcGFyYW0ge3F1YXR9IGIgdGhlIHNlY29uZCBvcGVyYW5kXHJcbiAqIEByZXR1cm5zIHtxdWF0fSBvdXRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBtdWx0aXBseShvdXQsIGEsIGIpIHtcclxuICB2YXIgYXggPSBhWzBdLFxyXG4gICAgICBheSA9IGFbMV0sXHJcbiAgICAgIGF6ID0gYVsyXSxcclxuICAgICAgYXcgPSBhWzNdO1xyXG4gIHZhciBieCA9IGJbMF0sXHJcbiAgICAgIGJ5ID0gYlsxXSxcclxuICAgICAgYnogPSBiWzJdLFxyXG4gICAgICBidyA9IGJbM107XHJcblxyXG4gIG91dFswXSA9IGF4ICogYncgKyBhdyAqIGJ4ICsgYXkgKiBieiAtIGF6ICogYnk7XHJcbiAgb3V0WzFdID0gYXkgKiBidyArIGF3ICogYnkgKyBheiAqIGJ4IC0gYXggKiBiejtcclxuICBvdXRbMl0gPSBheiAqIGJ3ICsgYXcgKiBieiArIGF4ICogYnkgLSBheSAqIGJ4O1xyXG4gIG91dFszXSA9IGF3ICogYncgLSBheCAqIGJ4IC0gYXkgKiBieSAtIGF6ICogYno7XHJcbiAgcmV0dXJuIG91dDtcclxufVxyXG5cclxuLyoqXHJcbiAqIFJvdGF0ZXMgYSBxdWF0ZXJuaW9uIGJ5IHRoZSBnaXZlbiBhbmdsZSBhYm91dCB0aGUgWCBheGlzXHJcbiAqXHJcbiAqIEBwYXJhbSB7cXVhdH0gb3V0IHF1YXQgcmVjZWl2aW5nIG9wZXJhdGlvbiByZXN1bHRcclxuICogQHBhcmFtIHtxdWF0fSBhIHF1YXQgdG8gcm90YXRlXHJcbiAqIEBwYXJhbSB7bnVtYmVyfSByYWQgYW5nbGUgKGluIHJhZGlhbnMpIHRvIHJvdGF0ZVxyXG4gKiBAcmV0dXJucyB7cXVhdH0gb3V0XHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gcm90YXRlWChvdXQsIGEsIHJhZCkge1xyXG4gIHJhZCAqPSAwLjU7XHJcblxyXG4gIHZhciBheCA9IGFbMF0sXHJcbiAgICAgIGF5ID0gYVsxXSxcclxuICAgICAgYXogPSBhWzJdLFxyXG4gICAgICBhdyA9IGFbM107XHJcbiAgdmFyIGJ4ID0gTWF0aC5zaW4ocmFkKSxcclxuICAgICAgYncgPSBNYXRoLmNvcyhyYWQpO1xyXG5cclxuICBvdXRbMF0gPSBheCAqIGJ3ICsgYXcgKiBieDtcclxuICBvdXRbMV0gPSBheSAqIGJ3ICsgYXogKiBieDtcclxuICBvdXRbMl0gPSBheiAqIGJ3IC0gYXkgKiBieDtcclxuICBvdXRbM10gPSBhdyAqIGJ3IC0gYXggKiBieDtcclxuICByZXR1cm4gb3V0O1xyXG59XHJcblxyXG4vKipcclxuICogUm90YXRlcyBhIHF1YXRlcm5pb24gYnkgdGhlIGdpdmVuIGFuZ2xlIGFib3V0IHRoZSBZIGF4aXNcclxuICpcclxuICogQHBhcmFtIHtxdWF0fSBvdXQgcXVhdCByZWNlaXZpbmcgb3BlcmF0aW9uIHJlc3VsdFxyXG4gKiBAcGFyYW0ge3F1YXR9IGEgcXVhdCB0byByb3RhdGVcclxuICogQHBhcmFtIHtudW1iZXJ9IHJhZCBhbmdsZSAoaW4gcmFkaWFucykgdG8gcm90YXRlXHJcbiAqIEByZXR1cm5zIHtxdWF0fSBvdXRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiByb3RhdGVZKG91dCwgYSwgcmFkKSB7XHJcbiAgcmFkICo9IDAuNTtcclxuXHJcbiAgdmFyIGF4ID0gYVswXSxcclxuICAgICAgYXkgPSBhWzFdLFxyXG4gICAgICBheiA9IGFbMl0sXHJcbiAgICAgIGF3ID0gYVszXTtcclxuICB2YXIgYnkgPSBNYXRoLnNpbihyYWQpLFxyXG4gICAgICBidyA9IE1hdGguY29zKHJhZCk7XHJcblxyXG4gIG91dFswXSA9IGF4ICogYncgLSBheiAqIGJ5O1xyXG4gIG91dFsxXSA9IGF5ICogYncgKyBhdyAqIGJ5O1xyXG4gIG91dFsyXSA9IGF6ICogYncgKyBheCAqIGJ5O1xyXG4gIG91dFszXSA9IGF3ICogYncgLSBheSAqIGJ5O1xyXG4gIHJldHVybiBvdXQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBSb3RhdGVzIGEgcXVhdGVybmlvbiBieSB0aGUgZ2l2ZW4gYW5nbGUgYWJvdXQgdGhlIFogYXhpc1xyXG4gKlxyXG4gKiBAcGFyYW0ge3F1YXR9IG91dCBxdWF0IHJlY2VpdmluZyBvcGVyYXRpb24gcmVzdWx0XHJcbiAqIEBwYXJhbSB7cXVhdH0gYSBxdWF0IHRvIHJvdGF0ZVxyXG4gKiBAcGFyYW0ge251bWJlcn0gcmFkIGFuZ2xlIChpbiByYWRpYW5zKSB0byByb3RhdGVcclxuICogQHJldHVybnMge3F1YXR9IG91dFxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIHJvdGF0ZVoob3V0LCBhLCByYWQpIHtcclxuICByYWQgKj0gMC41O1xyXG5cclxuICB2YXIgYXggPSBhWzBdLFxyXG4gICAgICBheSA9IGFbMV0sXHJcbiAgICAgIGF6ID0gYVsyXSxcclxuICAgICAgYXcgPSBhWzNdO1xyXG4gIHZhciBieiA9IE1hdGguc2luKHJhZCksXHJcbiAgICAgIGJ3ID0gTWF0aC5jb3MocmFkKTtcclxuXHJcbiAgb3V0WzBdID0gYXggKiBidyArIGF5ICogYno7XHJcbiAgb3V0WzFdID0gYXkgKiBidyAtIGF4ICogYno7XHJcbiAgb3V0WzJdID0gYXogKiBidyArIGF3ICogYno7XHJcbiAgb3V0WzNdID0gYXcgKiBidyAtIGF6ICogYno7XHJcbiAgcmV0dXJuIG91dDtcclxufVxyXG5cclxuLyoqXHJcbiAqIENhbGN1bGF0ZXMgdGhlIFcgY29tcG9uZW50IG9mIGEgcXVhdCBmcm9tIHRoZSBYLCBZLCBhbmQgWiBjb21wb25lbnRzLlxyXG4gKiBBc3N1bWVzIHRoYXQgcXVhdGVybmlvbiBpcyAxIHVuaXQgaW4gbGVuZ3RoLlxyXG4gKiBBbnkgZXhpc3RpbmcgVyBjb21wb25lbnQgd2lsbCBiZSBpZ25vcmVkLlxyXG4gKlxyXG4gKiBAcGFyYW0ge3F1YXR9IG91dCB0aGUgcmVjZWl2aW5nIHF1YXRlcm5pb25cclxuICogQHBhcmFtIHtxdWF0fSBhIHF1YXQgdG8gY2FsY3VsYXRlIFcgY29tcG9uZW50IG9mXHJcbiAqIEByZXR1cm5zIHtxdWF0fSBvdXRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBjYWxjdWxhdGVXKG91dCwgYSkge1xyXG4gIHZhciB4ID0gYVswXSxcclxuICAgICAgeSA9IGFbMV0sXHJcbiAgICAgIHogPSBhWzJdO1xyXG5cclxuICBvdXRbMF0gPSB4O1xyXG4gIG91dFsxXSA9IHk7XHJcbiAgb3V0WzJdID0gejtcclxuICBvdXRbM10gPSBNYXRoLnNxcnQoTWF0aC5hYnMoMS4wIC0geCAqIHggLSB5ICogeSAtIHogKiB6KSk7XHJcbiAgcmV0dXJuIG91dDtcclxufVxyXG5cclxuLyoqXHJcbiAqIFBlcmZvcm1zIGEgc3BoZXJpY2FsIGxpbmVhciBpbnRlcnBvbGF0aW9uIGJldHdlZW4gdHdvIHF1YXRcclxuICpcclxuICogQHBhcmFtIHtxdWF0fSBvdXQgdGhlIHJlY2VpdmluZyBxdWF0ZXJuaW9uXHJcbiAqIEBwYXJhbSB7cXVhdH0gYSB0aGUgZmlyc3Qgb3BlcmFuZFxyXG4gKiBAcGFyYW0ge3F1YXR9IGIgdGhlIHNlY29uZCBvcGVyYW5kXHJcbiAqIEBwYXJhbSB7TnVtYmVyfSB0IGludGVycG9sYXRpb24gYW1vdW50LCBpbiB0aGUgcmFuZ2UgWzAtMV0sIGJldHdlZW4gdGhlIHR3byBpbnB1dHNcclxuICogQHJldHVybnMge3F1YXR9IG91dFxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIHNsZXJwKG91dCwgYSwgYiwgdCkge1xyXG4gIC8vIGJlbmNobWFya3M6XHJcbiAgLy8gICAgaHR0cDovL2pzcGVyZi5jb20vcXVhdGVybmlvbi1zbGVycC1pbXBsZW1lbnRhdGlvbnNcclxuICB2YXIgYXggPSBhWzBdLFxyXG4gICAgICBheSA9IGFbMV0sXHJcbiAgICAgIGF6ID0gYVsyXSxcclxuICAgICAgYXcgPSBhWzNdO1xyXG4gIHZhciBieCA9IGJbMF0sXHJcbiAgICAgIGJ5ID0gYlsxXSxcclxuICAgICAgYnogPSBiWzJdLFxyXG4gICAgICBidyA9IGJbM107XHJcblxyXG4gIHZhciBvbWVnYSA9IHZvaWQgMCxcclxuICAgICAgY29zb20gPSB2b2lkIDAsXHJcbiAgICAgIHNpbm9tID0gdm9pZCAwLFxyXG4gICAgICBzY2FsZTAgPSB2b2lkIDAsXHJcbiAgICAgIHNjYWxlMSA9IHZvaWQgMDtcclxuXHJcbiAgLy8gY2FsYyBjb3NpbmVcclxuICBjb3NvbSA9IGF4ICogYnggKyBheSAqIGJ5ICsgYXogKiBieiArIGF3ICogYnc7XHJcbiAgLy8gYWRqdXN0IHNpZ25zIChpZiBuZWNlc3NhcnkpXHJcbiAgaWYgKGNvc29tIDwgMC4wKSB7XHJcbiAgICBjb3NvbSA9IC1jb3NvbTtcclxuICAgIGJ4ID0gLWJ4O1xyXG4gICAgYnkgPSAtYnk7XHJcbiAgICBieiA9IC1iejtcclxuICAgIGJ3ID0gLWJ3O1xyXG4gIH1cclxuICAvLyBjYWxjdWxhdGUgY29lZmZpY2llbnRzXHJcbiAgaWYgKDEuMCAtIGNvc29tID4gZ2xNYXRyaXguRVBTSUxPTikge1xyXG4gICAgLy8gc3RhbmRhcmQgY2FzZSAoc2xlcnApXHJcbiAgICBvbWVnYSA9IE1hdGguYWNvcyhjb3NvbSk7XHJcbiAgICBzaW5vbSA9IE1hdGguc2luKG9tZWdhKTtcclxuICAgIHNjYWxlMCA9IE1hdGguc2luKCgxLjAgLSB0KSAqIG9tZWdhKSAvIHNpbm9tO1xyXG4gICAgc2NhbGUxID0gTWF0aC5zaW4odCAqIG9tZWdhKSAvIHNpbm9tO1xyXG4gIH0gZWxzZSB7XHJcbiAgICAvLyBcImZyb21cIiBhbmQgXCJ0b1wiIHF1YXRlcm5pb25zIGFyZSB2ZXJ5IGNsb3NlXHJcbiAgICAvLyAgLi4uIHNvIHdlIGNhbiBkbyBhIGxpbmVhciBpbnRlcnBvbGF0aW9uXHJcbiAgICBzY2FsZTAgPSAxLjAgLSB0O1xyXG4gICAgc2NhbGUxID0gdDtcclxuICB9XHJcbiAgLy8gY2FsY3VsYXRlIGZpbmFsIHZhbHVlc1xyXG4gIG91dFswXSA9IHNjYWxlMCAqIGF4ICsgc2NhbGUxICogYng7XHJcbiAgb3V0WzFdID0gc2NhbGUwICogYXkgKyBzY2FsZTEgKiBieTtcclxuICBvdXRbMl0gPSBzY2FsZTAgKiBheiArIHNjYWxlMSAqIGJ6O1xyXG4gIG91dFszXSA9IHNjYWxlMCAqIGF3ICsgc2NhbGUxICogYnc7XHJcblxyXG4gIHJldHVybiBvdXQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBHZW5lcmF0ZXMgYSByYW5kb20gcXVhdGVybmlvblxyXG4gKlxyXG4gKiBAcGFyYW0ge3F1YXR9IG91dCB0aGUgcmVjZWl2aW5nIHF1YXRlcm5pb25cclxuICogQHJldHVybnMge3F1YXR9IG91dFxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIHJhbmRvbShvdXQpIHtcclxuICAvLyBJbXBsZW1lbnRhdGlvbiBvZiBodHRwOi8vcGxhbm5pbmcuY3MudWl1Yy5lZHUvbm9kZTE5OC5odG1sXHJcbiAgLy8gVE9ETzogQ2FsbGluZyByYW5kb20gMyB0aW1lcyBpcyBwcm9iYWJseSBub3QgdGhlIGZhc3Rlc3Qgc29sdXRpb25cclxuICB2YXIgdTEgPSBnbE1hdHJpeC5SQU5ET00oKTtcclxuICB2YXIgdTIgPSBnbE1hdHJpeC5SQU5ET00oKTtcclxuICB2YXIgdTMgPSBnbE1hdHJpeC5SQU5ET00oKTtcclxuXHJcbiAgdmFyIHNxcnQxTWludXNVMSA9IE1hdGguc3FydCgxIC0gdTEpO1xyXG4gIHZhciBzcXJ0VTEgPSBNYXRoLnNxcnQodTEpO1xyXG5cclxuICBvdXRbMF0gPSBzcXJ0MU1pbnVzVTEgKiBNYXRoLnNpbigyLjAgKiBNYXRoLlBJICogdTIpO1xyXG4gIG91dFsxXSA9IHNxcnQxTWludXNVMSAqIE1hdGguY29zKDIuMCAqIE1hdGguUEkgKiB1Mik7XHJcbiAgb3V0WzJdID0gc3FydFUxICogTWF0aC5zaW4oMi4wICogTWF0aC5QSSAqIHUzKTtcclxuICBvdXRbM10gPSBzcXJ0VTEgKiBNYXRoLmNvcygyLjAgKiBNYXRoLlBJICogdTMpO1xyXG4gIHJldHVybiBvdXQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDYWxjdWxhdGVzIHRoZSBpbnZlcnNlIG9mIGEgcXVhdFxyXG4gKlxyXG4gKiBAcGFyYW0ge3F1YXR9IG91dCB0aGUgcmVjZWl2aW5nIHF1YXRlcm5pb25cclxuICogQHBhcmFtIHtxdWF0fSBhIHF1YXQgdG8gY2FsY3VsYXRlIGludmVyc2Ugb2ZcclxuICogQHJldHVybnMge3F1YXR9IG91dFxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGludmVydChvdXQsIGEpIHtcclxuICB2YXIgYTAgPSBhWzBdLFxyXG4gICAgICBhMSA9IGFbMV0sXHJcbiAgICAgIGEyID0gYVsyXSxcclxuICAgICAgYTMgPSBhWzNdO1xyXG4gIHZhciBkb3QgPSBhMCAqIGEwICsgYTEgKiBhMSArIGEyICogYTIgKyBhMyAqIGEzO1xyXG4gIHZhciBpbnZEb3QgPSBkb3QgPyAxLjAgLyBkb3QgOiAwO1xyXG5cclxuICAvLyBUT0RPOiBXb3VsZCBiZSBmYXN0ZXIgdG8gcmV0dXJuIFswLDAsMCwwXSBpbW1lZGlhdGVseSBpZiBkb3QgPT0gMFxyXG5cclxuICBvdXRbMF0gPSAtYTAgKiBpbnZEb3Q7XHJcbiAgb3V0WzFdID0gLWExICogaW52RG90O1xyXG4gIG91dFsyXSA9IC1hMiAqIGludkRvdDtcclxuICBvdXRbM10gPSBhMyAqIGludkRvdDtcclxuICByZXR1cm4gb3V0O1xyXG59XHJcblxyXG4vKipcclxuICogQ2FsY3VsYXRlcyB0aGUgY29uanVnYXRlIG9mIGEgcXVhdFxyXG4gKiBJZiB0aGUgcXVhdGVybmlvbiBpcyBub3JtYWxpemVkLCB0aGlzIGZ1bmN0aW9uIGlzIGZhc3RlciB0aGFuIHF1YXQuaW52ZXJzZSBhbmQgcHJvZHVjZXMgdGhlIHNhbWUgcmVzdWx0LlxyXG4gKlxyXG4gKiBAcGFyYW0ge3F1YXR9IG91dCB0aGUgcmVjZWl2aW5nIHF1YXRlcm5pb25cclxuICogQHBhcmFtIHtxdWF0fSBhIHF1YXQgdG8gY2FsY3VsYXRlIGNvbmp1Z2F0ZSBvZlxyXG4gKiBAcmV0dXJucyB7cXVhdH0gb3V0XHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gY29uanVnYXRlKG91dCwgYSkge1xyXG4gIG91dFswXSA9IC1hWzBdO1xyXG4gIG91dFsxXSA9IC1hWzFdO1xyXG4gIG91dFsyXSA9IC1hWzJdO1xyXG4gIG91dFszXSA9IGFbM107XHJcbiAgcmV0dXJuIG91dDtcclxufVxyXG5cclxuLyoqXHJcbiAqIENyZWF0ZXMgYSBxdWF0ZXJuaW9uIGZyb20gdGhlIGdpdmVuIDN4MyByb3RhdGlvbiBtYXRyaXguXHJcbiAqXHJcbiAqIE5PVEU6IFRoZSByZXN1bHRhbnQgcXVhdGVybmlvbiBpcyBub3Qgbm9ybWFsaXplZCwgc28geW91IHNob3VsZCBiZSBzdXJlXHJcbiAqIHRvIHJlbm9ybWFsaXplIHRoZSBxdWF0ZXJuaW9uIHlvdXJzZWxmIHdoZXJlIG5lY2Vzc2FyeS5cclxuICpcclxuICogQHBhcmFtIHtxdWF0fSBvdXQgdGhlIHJlY2VpdmluZyBxdWF0ZXJuaW9uXHJcbiAqIEBwYXJhbSB7bWF0M30gbSByb3RhdGlvbiBtYXRyaXhcclxuICogQHJldHVybnMge3F1YXR9IG91dFxyXG4gKiBAZnVuY3Rpb25cclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBmcm9tTWF0MyhvdXQsIG0pIHtcclxuICAvLyBBbGdvcml0aG0gaW4gS2VuIFNob2VtYWtlJ3MgYXJ0aWNsZSBpbiAxOTg3IFNJR0dSQVBIIGNvdXJzZSBub3Rlc1xyXG4gIC8vIGFydGljbGUgXCJRdWF0ZXJuaW9uIENhbGN1bHVzIGFuZCBGYXN0IEFuaW1hdGlvblwiLlxyXG4gIHZhciBmVHJhY2UgPSBtWzBdICsgbVs0XSArIG1bOF07XHJcbiAgdmFyIGZSb290ID0gdm9pZCAwO1xyXG5cclxuICBpZiAoZlRyYWNlID4gMC4wKSB7XHJcbiAgICAvLyB8d3wgPiAxLzIsIG1heSBhcyB3ZWxsIGNob29zZSB3ID4gMS8yXHJcbiAgICBmUm9vdCA9IE1hdGguc3FydChmVHJhY2UgKyAxLjApOyAvLyAyd1xyXG4gICAgb3V0WzNdID0gMC41ICogZlJvb3Q7XHJcbiAgICBmUm9vdCA9IDAuNSAvIGZSb290OyAvLyAxLyg0dylcclxuICAgIG91dFswXSA9IChtWzVdIC0gbVs3XSkgKiBmUm9vdDtcclxuICAgIG91dFsxXSA9IChtWzZdIC0gbVsyXSkgKiBmUm9vdDtcclxuICAgIG91dFsyXSA9IChtWzFdIC0gbVszXSkgKiBmUm9vdDtcclxuICB9IGVsc2Uge1xyXG4gICAgLy8gfHd8IDw9IDEvMlxyXG4gICAgdmFyIGkgPSAwO1xyXG4gICAgaWYgKG1bNF0gPiBtWzBdKSBpID0gMTtcclxuICAgIGlmIChtWzhdID4gbVtpICogMyArIGldKSBpID0gMjtcclxuICAgIHZhciBqID0gKGkgKyAxKSAlIDM7XHJcbiAgICB2YXIgayA9IChpICsgMikgJSAzO1xyXG5cclxuICAgIGZSb290ID0gTWF0aC5zcXJ0KG1baSAqIDMgKyBpXSAtIG1baiAqIDMgKyBqXSAtIG1bayAqIDMgKyBrXSArIDEuMCk7XHJcbiAgICBvdXRbaV0gPSAwLjUgKiBmUm9vdDtcclxuICAgIGZSb290ID0gMC41IC8gZlJvb3Q7XHJcbiAgICBvdXRbM10gPSAobVtqICogMyArIGtdIC0gbVtrICogMyArIGpdKSAqIGZSb290O1xyXG4gICAgb3V0W2pdID0gKG1baiAqIDMgKyBpXSArIG1baSAqIDMgKyBqXSkgKiBmUm9vdDtcclxuICAgIG91dFtrXSA9IChtW2sgKiAzICsgaV0gKyBtW2kgKiAzICsga10pICogZlJvb3Q7XHJcbiAgfVxyXG5cclxuICByZXR1cm4gb3V0O1xyXG59XHJcblxyXG4vKipcclxuICogQ3JlYXRlcyBhIHF1YXRlcm5pb24gZnJvbSB0aGUgZ2l2ZW4gZXVsZXIgYW5nbGUgeCwgeSwgei5cclxuICpcclxuICogQHBhcmFtIHtxdWF0fSBvdXQgdGhlIHJlY2VpdmluZyBxdWF0ZXJuaW9uXHJcbiAqIEBwYXJhbSB7eH0gQW5nbGUgdG8gcm90YXRlIGFyb3VuZCBYIGF4aXMgaW4gZGVncmVlcy5cclxuICogQHBhcmFtIHt5fSBBbmdsZSB0byByb3RhdGUgYXJvdW5kIFkgYXhpcyBpbiBkZWdyZWVzLlxyXG4gKiBAcGFyYW0ge3p9IEFuZ2xlIHRvIHJvdGF0ZSBhcm91bmQgWiBheGlzIGluIGRlZ3JlZXMuXHJcbiAqIEByZXR1cm5zIHtxdWF0fSBvdXRcclxuICogQGZ1bmN0aW9uXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gZnJvbUV1bGVyKG91dCwgeCwgeSwgeikge1xyXG4gIHZhciBoYWxmVG9SYWQgPSAwLjUgKiBNYXRoLlBJIC8gMTgwLjA7XHJcbiAgeCAqPSBoYWxmVG9SYWQ7XHJcbiAgeSAqPSBoYWxmVG9SYWQ7XHJcbiAgeiAqPSBoYWxmVG9SYWQ7XHJcblxyXG4gIHZhciBzeCA9IE1hdGguc2luKHgpO1xyXG4gIHZhciBjeCA9IE1hdGguY29zKHgpO1xyXG4gIHZhciBzeSA9IE1hdGguc2luKHkpO1xyXG4gIHZhciBjeSA9IE1hdGguY29zKHkpO1xyXG4gIHZhciBzeiA9IE1hdGguc2luKHopO1xyXG4gIHZhciBjeiA9IE1hdGguY29zKHopO1xyXG5cclxuICBvdXRbMF0gPSBzeCAqIGN5ICogY3ogLSBjeCAqIHN5ICogc3o7XHJcbiAgb3V0WzFdID0gY3ggKiBzeSAqIGN6ICsgc3ggKiBjeSAqIHN6O1xyXG4gIG91dFsyXSA9IGN4ICogY3kgKiBzeiAtIHN4ICogc3kgKiBjejtcclxuICBvdXRbM10gPSBjeCAqIGN5ICogY3ogKyBzeCAqIHN5ICogc3o7XHJcblxyXG4gIHJldHVybiBvdXQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBSZXR1cm5zIGEgc3RyaW5nIHJlcHJlc2VudGF0aW9uIG9mIGEgcXVhdGVuaW9uXHJcbiAqXHJcbiAqIEBwYXJhbSB7cXVhdH0gYSB2ZWN0b3IgdG8gcmVwcmVzZW50IGFzIGEgc3RyaW5nXHJcbiAqIEByZXR1cm5zIHtTdHJpbmd9IHN0cmluZyByZXByZXNlbnRhdGlvbiBvZiB0aGUgdmVjdG9yXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gc3RyKGEpIHtcclxuICByZXR1cm4gJ3F1YXQoJyArIGFbMF0gKyAnLCAnICsgYVsxXSArICcsICcgKyBhWzJdICsgJywgJyArIGFbM10gKyAnKSc7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDcmVhdGVzIGEgbmV3IHF1YXQgaW5pdGlhbGl6ZWQgd2l0aCB2YWx1ZXMgZnJvbSBhbiBleGlzdGluZyBxdWF0ZXJuaW9uXHJcbiAqXHJcbiAqIEBwYXJhbSB7cXVhdH0gYSBxdWF0ZXJuaW9uIHRvIGNsb25lXHJcbiAqIEByZXR1cm5zIHtxdWF0fSBhIG5ldyBxdWF0ZXJuaW9uXHJcbiAqIEBmdW5jdGlvblxyXG4gKi9cclxuZXhwb3J0IHZhciBjbG9uZSA9IHZlYzQuY2xvbmU7XHJcblxyXG4vKipcclxuICogQ3JlYXRlcyBhIG5ldyBxdWF0IGluaXRpYWxpemVkIHdpdGggdGhlIGdpdmVuIHZhbHVlc1xyXG4gKlxyXG4gKiBAcGFyYW0ge051bWJlcn0geCBYIGNvbXBvbmVudFxyXG4gKiBAcGFyYW0ge051bWJlcn0geSBZIGNvbXBvbmVudFxyXG4gKiBAcGFyYW0ge051bWJlcn0geiBaIGNvbXBvbmVudFxyXG4gKiBAcGFyYW0ge051bWJlcn0gdyBXIGNvbXBvbmVudFxyXG4gKiBAcmV0dXJucyB7cXVhdH0gYSBuZXcgcXVhdGVybmlvblxyXG4gKiBAZnVuY3Rpb25cclxuICovXHJcbmV4cG9ydCB2YXIgZnJvbVZhbHVlcyA9IHZlYzQuZnJvbVZhbHVlcztcclxuXHJcbi8qKlxyXG4gKiBDb3B5IHRoZSB2YWx1ZXMgZnJvbSBvbmUgcXVhdCB0byBhbm90aGVyXHJcbiAqXHJcbiAqIEBwYXJhbSB7cXVhdH0gb3V0IHRoZSByZWNlaXZpbmcgcXVhdGVybmlvblxyXG4gKiBAcGFyYW0ge3F1YXR9IGEgdGhlIHNvdXJjZSBxdWF0ZXJuaW9uXHJcbiAqIEByZXR1cm5zIHtxdWF0fSBvdXRcclxuICogQGZ1bmN0aW9uXHJcbiAqL1xyXG5leHBvcnQgdmFyIGNvcHkgPSB2ZWM0LmNvcHk7XHJcblxyXG4vKipcclxuICogU2V0IHRoZSBjb21wb25lbnRzIG9mIGEgcXVhdCB0byB0aGUgZ2l2ZW4gdmFsdWVzXHJcbiAqXHJcbiAqIEBwYXJhbSB7cXVhdH0gb3V0IHRoZSByZWNlaXZpbmcgcXVhdGVybmlvblxyXG4gKiBAcGFyYW0ge051bWJlcn0geCBYIGNvbXBvbmVudFxyXG4gKiBAcGFyYW0ge051bWJlcn0geSBZIGNvbXBvbmVudFxyXG4gKiBAcGFyYW0ge051bWJlcn0geiBaIGNvbXBvbmVudFxyXG4gKiBAcGFyYW0ge051bWJlcn0gdyBXIGNvbXBvbmVudFxyXG4gKiBAcmV0dXJucyB7cXVhdH0gb3V0XHJcbiAqIEBmdW5jdGlvblxyXG4gKi9cclxuZXhwb3J0IHZhciBzZXQgPSB2ZWM0LnNldDtcclxuXHJcbi8qKlxyXG4gKiBBZGRzIHR3byBxdWF0J3NcclxuICpcclxuICogQHBhcmFtIHtxdWF0fSBvdXQgdGhlIHJlY2VpdmluZyBxdWF0ZXJuaW9uXHJcbiAqIEBwYXJhbSB7cXVhdH0gYSB0aGUgZmlyc3Qgb3BlcmFuZFxyXG4gKiBAcGFyYW0ge3F1YXR9IGIgdGhlIHNlY29uZCBvcGVyYW5kXHJcbiAqIEByZXR1cm5zIHtxdWF0fSBvdXRcclxuICogQGZ1bmN0aW9uXHJcbiAqL1xyXG5leHBvcnQgdmFyIGFkZCA9IHZlYzQuYWRkO1xyXG5cclxuLyoqXHJcbiAqIEFsaWFzIGZvciB7QGxpbmsgcXVhdC5tdWx0aXBseX1cclxuICogQGZ1bmN0aW9uXHJcbiAqL1xyXG5leHBvcnQgdmFyIG11bCA9IG11bHRpcGx5O1xyXG5cclxuLyoqXHJcbiAqIFNjYWxlcyBhIHF1YXQgYnkgYSBzY2FsYXIgbnVtYmVyXHJcbiAqXHJcbiAqIEBwYXJhbSB7cXVhdH0gb3V0IHRoZSByZWNlaXZpbmcgdmVjdG9yXHJcbiAqIEBwYXJhbSB7cXVhdH0gYSB0aGUgdmVjdG9yIHRvIHNjYWxlXHJcbiAqIEBwYXJhbSB7TnVtYmVyfSBiIGFtb3VudCB0byBzY2FsZSB0aGUgdmVjdG9yIGJ5XHJcbiAqIEByZXR1cm5zIHtxdWF0fSBvdXRcclxuICogQGZ1bmN0aW9uXHJcbiAqL1xyXG5leHBvcnQgdmFyIHNjYWxlID0gdmVjNC5zY2FsZTtcclxuXHJcbi8qKlxyXG4gKiBDYWxjdWxhdGVzIHRoZSBkb3QgcHJvZHVjdCBvZiB0d28gcXVhdCdzXHJcbiAqXHJcbiAqIEBwYXJhbSB7cXVhdH0gYSB0aGUgZmlyc3Qgb3BlcmFuZFxyXG4gKiBAcGFyYW0ge3F1YXR9IGIgdGhlIHNlY29uZCBvcGVyYW5kXHJcbiAqIEByZXR1cm5zIHtOdW1iZXJ9IGRvdCBwcm9kdWN0IG9mIGEgYW5kIGJcclxuICogQGZ1bmN0aW9uXHJcbiAqL1xyXG5leHBvcnQgdmFyIGRvdCA9IHZlYzQuZG90O1xyXG5cclxuLyoqXHJcbiAqIFBlcmZvcm1zIGEgbGluZWFyIGludGVycG9sYXRpb24gYmV0d2VlbiB0d28gcXVhdCdzXHJcbiAqXHJcbiAqIEBwYXJhbSB7cXVhdH0gb3V0IHRoZSByZWNlaXZpbmcgcXVhdGVybmlvblxyXG4gKiBAcGFyYW0ge3F1YXR9IGEgdGhlIGZpcnN0IG9wZXJhbmRcclxuICogQHBhcmFtIHtxdWF0fSBiIHRoZSBzZWNvbmQgb3BlcmFuZFxyXG4gKiBAcGFyYW0ge051bWJlcn0gdCBpbnRlcnBvbGF0aW9uIGFtb3VudCwgaW4gdGhlIHJhbmdlIFswLTFdLCBiZXR3ZWVuIHRoZSB0d28gaW5wdXRzXHJcbiAqIEByZXR1cm5zIHtxdWF0fSBvdXRcclxuICogQGZ1bmN0aW9uXHJcbiAqL1xyXG5leHBvcnQgdmFyIGxlcnAgPSB2ZWM0LmxlcnA7XHJcblxyXG4vKipcclxuICogQ2FsY3VsYXRlcyB0aGUgbGVuZ3RoIG9mIGEgcXVhdFxyXG4gKlxyXG4gKiBAcGFyYW0ge3F1YXR9IGEgdmVjdG9yIHRvIGNhbGN1bGF0ZSBsZW5ndGggb2ZcclxuICogQHJldHVybnMge051bWJlcn0gbGVuZ3RoIG9mIGFcclxuICovXHJcbmV4cG9ydCB2YXIgbGVuZ3RoID0gdmVjNC5sZW5ndGg7XHJcblxyXG4vKipcclxuICogQWxpYXMgZm9yIHtAbGluayBxdWF0Lmxlbmd0aH1cclxuICogQGZ1bmN0aW9uXHJcbiAqL1xyXG5leHBvcnQgdmFyIGxlbiA9IGxlbmd0aDtcclxuXHJcbi8qKlxyXG4gKiBDYWxjdWxhdGVzIHRoZSBzcXVhcmVkIGxlbmd0aCBvZiBhIHF1YXRcclxuICpcclxuICogQHBhcmFtIHtxdWF0fSBhIHZlY3RvciB0byBjYWxjdWxhdGUgc3F1YXJlZCBsZW5ndGggb2ZcclxuICogQHJldHVybnMge051bWJlcn0gc3F1YXJlZCBsZW5ndGggb2YgYVxyXG4gKiBAZnVuY3Rpb25cclxuICovXHJcbmV4cG9ydCB2YXIgc3F1YXJlZExlbmd0aCA9IHZlYzQuc3F1YXJlZExlbmd0aDtcclxuXHJcbi8qKlxyXG4gKiBBbGlhcyBmb3Ige0BsaW5rIHF1YXQuc3F1YXJlZExlbmd0aH1cclxuICogQGZ1bmN0aW9uXHJcbiAqL1xyXG5leHBvcnQgdmFyIHNxckxlbiA9IHNxdWFyZWRMZW5ndGg7XHJcblxyXG4vKipcclxuICogTm9ybWFsaXplIGEgcXVhdFxyXG4gKlxyXG4gKiBAcGFyYW0ge3F1YXR9IG91dCB0aGUgcmVjZWl2aW5nIHF1YXRlcm5pb25cclxuICogQHBhcmFtIHtxdWF0fSBhIHF1YXRlcm5pb24gdG8gbm9ybWFsaXplXHJcbiAqIEByZXR1cm5zIHtxdWF0fSBvdXRcclxuICogQGZ1bmN0aW9uXHJcbiAqL1xyXG5leHBvcnQgdmFyIG5vcm1hbGl6ZSA9IHZlYzQubm9ybWFsaXplO1xyXG5cclxuLyoqXHJcbiAqIFJldHVybnMgd2hldGhlciBvciBub3QgdGhlIHF1YXRlcm5pb25zIGhhdmUgZXhhY3RseSB0aGUgc2FtZSBlbGVtZW50cyBpbiB0aGUgc2FtZSBwb3NpdGlvbiAod2hlbiBjb21wYXJlZCB3aXRoID09PSlcclxuICpcclxuICogQHBhcmFtIHtxdWF0fSBhIFRoZSBmaXJzdCBxdWF0ZXJuaW9uLlxyXG4gKiBAcGFyYW0ge3F1YXR9IGIgVGhlIHNlY29uZCBxdWF0ZXJuaW9uLlxyXG4gKiBAcmV0dXJucyB7Qm9vbGVhbn0gVHJ1ZSBpZiB0aGUgdmVjdG9ycyBhcmUgZXF1YWwsIGZhbHNlIG90aGVyd2lzZS5cclxuICovXHJcbmV4cG9ydCB2YXIgZXhhY3RFcXVhbHMgPSB2ZWM0LmV4YWN0RXF1YWxzO1xyXG5cclxuLyoqXHJcbiAqIFJldHVybnMgd2hldGhlciBvciBub3QgdGhlIHF1YXRlcm5pb25zIGhhdmUgYXBwcm94aW1hdGVseSB0aGUgc2FtZSBlbGVtZW50cyBpbiB0aGUgc2FtZSBwb3NpdGlvbi5cclxuICpcclxuICogQHBhcmFtIHtxdWF0fSBhIFRoZSBmaXJzdCB2ZWN0b3IuXHJcbiAqIEBwYXJhbSB7cXVhdH0gYiBUaGUgc2Vjb25kIHZlY3Rvci5cclxuICogQHJldHVybnMge0Jvb2xlYW59IFRydWUgaWYgdGhlIHZlY3RvcnMgYXJlIGVxdWFsLCBmYWxzZSBvdGhlcndpc2UuXHJcbiAqL1xyXG5leHBvcnQgdmFyIGVxdWFscyA9IHZlYzQuZXF1YWxzO1xyXG5cclxuLyoqXHJcbiAqIFNldHMgYSBxdWF0ZXJuaW9uIHRvIHJlcHJlc2VudCB0aGUgc2hvcnRlc3Qgcm90YXRpb24gZnJvbSBvbmVcclxuICogdmVjdG9yIHRvIGFub3RoZXIuXHJcbiAqXHJcbiAqIEJvdGggdmVjdG9ycyBhcmUgYXNzdW1lZCB0byBiZSB1bml0IGxlbmd0aC5cclxuICpcclxuICogQHBhcmFtIHtxdWF0fSBvdXQgdGhlIHJlY2VpdmluZyBxdWF0ZXJuaW9uLlxyXG4gKiBAcGFyYW0ge3ZlYzN9IGEgdGhlIGluaXRpYWwgdmVjdG9yXHJcbiAqIEBwYXJhbSB7dmVjM30gYiB0aGUgZGVzdGluYXRpb24gdmVjdG9yXHJcbiAqIEByZXR1cm5zIHtxdWF0fSBvdXRcclxuICovXHJcbmV4cG9ydCB2YXIgcm90YXRpb25UbyA9IGZ1bmN0aW9uICgpIHtcclxuICB2YXIgdG1wdmVjMyA9IHZlYzMuY3JlYXRlKCk7XHJcbiAgdmFyIHhVbml0VmVjMyA9IHZlYzMuZnJvbVZhbHVlcygxLCAwLCAwKTtcclxuICB2YXIgeVVuaXRWZWMzID0gdmVjMy5mcm9tVmFsdWVzKDAsIDEsIDApO1xyXG5cclxuICByZXR1cm4gZnVuY3Rpb24gKG91dCwgYSwgYikge1xyXG4gICAgdmFyIGRvdCA9IHZlYzMuZG90KGEsIGIpO1xyXG4gICAgaWYgKGRvdCA8IC0wLjk5OTk5OSkge1xyXG4gICAgICB2ZWMzLmNyb3NzKHRtcHZlYzMsIHhVbml0VmVjMywgYSk7XHJcbiAgICAgIGlmICh2ZWMzLmxlbih0bXB2ZWMzKSA8IDAuMDAwMDAxKSB2ZWMzLmNyb3NzKHRtcHZlYzMsIHlVbml0VmVjMywgYSk7XHJcbiAgICAgIHZlYzMubm9ybWFsaXplKHRtcHZlYzMsIHRtcHZlYzMpO1xyXG4gICAgICBzZXRBeGlzQW5nbGUob3V0LCB0bXB2ZWMzLCBNYXRoLlBJKTtcclxuICAgICAgcmV0dXJuIG91dDtcclxuICAgIH0gZWxzZSBpZiAoZG90ID4gMC45OTk5OTkpIHtcclxuICAgICAgb3V0WzBdID0gMDtcclxuICAgICAgb3V0WzFdID0gMDtcclxuICAgICAgb3V0WzJdID0gMDtcclxuICAgICAgb3V0WzNdID0gMTtcclxuICAgICAgcmV0dXJuIG91dDtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHZlYzMuY3Jvc3ModG1wdmVjMywgYSwgYik7XHJcbiAgICAgIG91dFswXSA9IHRtcHZlYzNbMF07XHJcbiAgICAgIG91dFsxXSA9IHRtcHZlYzNbMV07XHJcbiAgICAgIG91dFsyXSA9IHRtcHZlYzNbMl07XHJcbiAgICAgIG91dFszXSA9IDEgKyBkb3Q7XHJcbiAgICAgIHJldHVybiBub3JtYWxpemUob3V0LCBvdXQpO1xyXG4gICAgfVxyXG4gIH07XHJcbn0oKTtcclxuXHJcbi8qKlxyXG4gKiBQZXJmb3JtcyBhIHNwaGVyaWNhbCBsaW5lYXIgaW50ZXJwb2xhdGlvbiB3aXRoIHR3byBjb250cm9sIHBvaW50c1xyXG4gKlxyXG4gKiBAcGFyYW0ge3F1YXR9IG91dCB0aGUgcmVjZWl2aW5nIHF1YXRlcm5pb25cclxuICogQHBhcmFtIHtxdWF0fSBhIHRoZSBmaXJzdCBvcGVyYW5kXHJcbiAqIEBwYXJhbSB7cXVhdH0gYiB0aGUgc2Vjb25kIG9wZXJhbmRcclxuICogQHBhcmFtIHtxdWF0fSBjIHRoZSB0aGlyZCBvcGVyYW5kXHJcbiAqIEBwYXJhbSB7cXVhdH0gZCB0aGUgZm91cnRoIG9wZXJhbmRcclxuICogQHBhcmFtIHtOdW1iZXJ9IHQgaW50ZXJwb2xhdGlvbiBhbW91bnQsIGluIHRoZSByYW5nZSBbMC0xXSwgYmV0d2VlbiB0aGUgdHdvIGlucHV0c1xyXG4gKiBAcmV0dXJucyB7cXVhdH0gb3V0XHJcbiAqL1xyXG5leHBvcnQgdmFyIHNxbGVycCA9IGZ1bmN0aW9uICgpIHtcclxuICB2YXIgdGVtcDEgPSBjcmVhdGUoKTtcclxuICB2YXIgdGVtcDIgPSBjcmVhdGUoKTtcclxuXHJcbiAgcmV0dXJuIGZ1bmN0aW9uIChvdXQsIGEsIGIsIGMsIGQsIHQpIHtcclxuICAgIHNsZXJwKHRlbXAxLCBhLCBkLCB0KTtcclxuICAgIHNsZXJwKHRlbXAyLCBiLCBjLCB0KTtcclxuICAgIHNsZXJwKG91dCwgdGVtcDEsIHRlbXAyLCAyICogdCAqICgxIC0gdCkpO1xyXG5cclxuICAgIHJldHVybiBvdXQ7XHJcbiAgfTtcclxufSgpO1xyXG5cclxuLyoqXHJcbiAqIFNldHMgdGhlIHNwZWNpZmllZCBxdWF0ZXJuaW9uIHdpdGggdmFsdWVzIGNvcnJlc3BvbmRpbmcgdG8gdGhlIGdpdmVuXHJcbiAqIGF4ZXMuIEVhY2ggYXhpcyBpcyBhIHZlYzMgYW5kIGlzIGV4cGVjdGVkIHRvIGJlIHVuaXQgbGVuZ3RoIGFuZFxyXG4gKiBwZXJwZW5kaWN1bGFyIHRvIGFsbCBvdGhlciBzcGVjaWZpZWQgYXhlcy5cclxuICpcclxuICogQHBhcmFtIHt2ZWMzfSB2aWV3ICB0aGUgdmVjdG9yIHJlcHJlc2VudGluZyB0aGUgdmlld2luZyBkaXJlY3Rpb25cclxuICogQHBhcmFtIHt2ZWMzfSByaWdodCB0aGUgdmVjdG9yIHJlcHJlc2VudGluZyB0aGUgbG9jYWwgXCJyaWdodFwiIGRpcmVjdGlvblxyXG4gKiBAcGFyYW0ge3ZlYzN9IHVwICAgIHRoZSB2ZWN0b3IgcmVwcmVzZW50aW5nIHRoZSBsb2NhbCBcInVwXCIgZGlyZWN0aW9uXHJcbiAqIEByZXR1cm5zIHtxdWF0fSBvdXRcclxuICovXHJcbmV4cG9ydCB2YXIgc2V0QXhlcyA9IGZ1bmN0aW9uICgpIHtcclxuICB2YXIgbWF0ciA9IG1hdDMuY3JlYXRlKCk7XHJcblxyXG4gIHJldHVybiBmdW5jdGlvbiAob3V0LCB2aWV3LCByaWdodCwgdXApIHtcclxuICAgIG1hdHJbMF0gPSByaWdodFswXTtcclxuICAgIG1hdHJbM10gPSByaWdodFsxXTtcclxuICAgIG1hdHJbNl0gPSByaWdodFsyXTtcclxuXHJcbiAgICBtYXRyWzFdID0gdXBbMF07XHJcbiAgICBtYXRyWzRdID0gdXBbMV07XHJcbiAgICBtYXRyWzddID0gdXBbMl07XHJcblxyXG4gICAgbWF0clsyXSA9IC12aWV3WzBdO1xyXG4gICAgbWF0cls1XSA9IC12aWV3WzFdO1xyXG4gICAgbWF0cls4XSA9IC12aWV3WzJdO1xyXG5cclxuICAgIHJldHVybiBub3JtYWxpemUob3V0LCBmcm9tTWF0MyhvdXQsIG1hdHIpKTtcclxuICB9O1xyXG59KCk7IiwiaW1wb3J0ICogYXMgZ2xNYXRyaXggZnJvbSBcIi4vY29tbW9uLmpzXCI7XHJcblxyXG4vKipcclxuICogMiBEaW1lbnNpb25hbCBWZWN0b3JcclxuICogQG1vZHVsZSB2ZWMyXHJcbiAqL1xyXG5cclxuLyoqXHJcbiAqIENyZWF0ZXMgYSBuZXcsIGVtcHR5IHZlYzJcclxuICpcclxuICogQHJldHVybnMge3ZlYzJ9IGEgbmV3IDJEIHZlY3RvclxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZSgpIHtcclxuICB2YXIgb3V0ID0gbmV3IGdsTWF0cml4LkFSUkFZX1RZUEUoMik7XHJcbiAgaWYgKGdsTWF0cml4LkFSUkFZX1RZUEUgIT0gRmxvYXQzMkFycmF5KSB7XHJcbiAgICBvdXRbMF0gPSAwO1xyXG4gICAgb3V0WzFdID0gMDtcclxuICB9XHJcbiAgcmV0dXJuIG91dDtcclxufVxyXG5cclxuLyoqXHJcbiAqIENyZWF0ZXMgYSBuZXcgdmVjMiBpbml0aWFsaXplZCB3aXRoIHZhbHVlcyBmcm9tIGFuIGV4aXN0aW5nIHZlY3RvclxyXG4gKlxyXG4gKiBAcGFyYW0ge3ZlYzJ9IGEgdmVjdG9yIHRvIGNsb25lXHJcbiAqIEByZXR1cm5zIHt2ZWMyfSBhIG5ldyAyRCB2ZWN0b3JcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBjbG9uZShhKSB7XHJcbiAgdmFyIG91dCA9IG5ldyBnbE1hdHJpeC5BUlJBWV9UWVBFKDIpO1xyXG4gIG91dFswXSA9IGFbMF07XHJcbiAgb3V0WzFdID0gYVsxXTtcclxuICByZXR1cm4gb3V0O1xyXG59XHJcblxyXG4vKipcclxuICogQ3JlYXRlcyBhIG5ldyB2ZWMyIGluaXRpYWxpemVkIHdpdGggdGhlIGdpdmVuIHZhbHVlc1xyXG4gKlxyXG4gKiBAcGFyYW0ge051bWJlcn0geCBYIGNvbXBvbmVudFxyXG4gKiBAcGFyYW0ge051bWJlcn0geSBZIGNvbXBvbmVudFxyXG4gKiBAcmV0dXJucyB7dmVjMn0gYSBuZXcgMkQgdmVjdG9yXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gZnJvbVZhbHVlcyh4LCB5KSB7XHJcbiAgdmFyIG91dCA9IG5ldyBnbE1hdHJpeC5BUlJBWV9UWVBFKDIpO1xyXG4gIG91dFswXSA9IHg7XHJcbiAgb3V0WzFdID0geTtcclxuICByZXR1cm4gb3V0O1xyXG59XHJcblxyXG4vKipcclxuICogQ29weSB0aGUgdmFsdWVzIGZyb20gb25lIHZlYzIgdG8gYW5vdGhlclxyXG4gKlxyXG4gKiBAcGFyYW0ge3ZlYzJ9IG91dCB0aGUgcmVjZWl2aW5nIHZlY3RvclxyXG4gKiBAcGFyYW0ge3ZlYzJ9IGEgdGhlIHNvdXJjZSB2ZWN0b3JcclxuICogQHJldHVybnMge3ZlYzJ9IG91dFxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGNvcHkob3V0LCBhKSB7XHJcbiAgb3V0WzBdID0gYVswXTtcclxuICBvdXRbMV0gPSBhWzFdO1xyXG4gIHJldHVybiBvdXQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBTZXQgdGhlIGNvbXBvbmVudHMgb2YgYSB2ZWMyIHRvIHRoZSBnaXZlbiB2YWx1ZXNcclxuICpcclxuICogQHBhcmFtIHt2ZWMyfSBvdXQgdGhlIHJlY2VpdmluZyB2ZWN0b3JcclxuICogQHBhcmFtIHtOdW1iZXJ9IHggWCBjb21wb25lbnRcclxuICogQHBhcmFtIHtOdW1iZXJ9IHkgWSBjb21wb25lbnRcclxuICogQHJldHVybnMge3ZlYzJ9IG91dFxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIHNldChvdXQsIHgsIHkpIHtcclxuICBvdXRbMF0gPSB4O1xyXG4gIG91dFsxXSA9IHk7XHJcbiAgcmV0dXJuIG91dDtcclxufVxyXG5cclxuLyoqXHJcbiAqIEFkZHMgdHdvIHZlYzInc1xyXG4gKlxyXG4gKiBAcGFyYW0ge3ZlYzJ9IG91dCB0aGUgcmVjZWl2aW5nIHZlY3RvclxyXG4gKiBAcGFyYW0ge3ZlYzJ9IGEgdGhlIGZpcnN0IG9wZXJhbmRcclxuICogQHBhcmFtIHt2ZWMyfSBiIHRoZSBzZWNvbmQgb3BlcmFuZFxyXG4gKiBAcmV0dXJucyB7dmVjMn0gb3V0XHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gYWRkKG91dCwgYSwgYikge1xyXG4gIG91dFswXSA9IGFbMF0gKyBiWzBdO1xyXG4gIG91dFsxXSA9IGFbMV0gKyBiWzFdO1xyXG4gIHJldHVybiBvdXQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBTdWJ0cmFjdHMgdmVjdG9yIGIgZnJvbSB2ZWN0b3IgYVxyXG4gKlxyXG4gKiBAcGFyYW0ge3ZlYzJ9IG91dCB0aGUgcmVjZWl2aW5nIHZlY3RvclxyXG4gKiBAcGFyYW0ge3ZlYzJ9IGEgdGhlIGZpcnN0IG9wZXJhbmRcclxuICogQHBhcmFtIHt2ZWMyfSBiIHRoZSBzZWNvbmQgb3BlcmFuZFxyXG4gKiBAcmV0dXJucyB7dmVjMn0gb3V0XHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gc3VidHJhY3Qob3V0LCBhLCBiKSB7XHJcbiAgb3V0WzBdID0gYVswXSAtIGJbMF07XHJcbiAgb3V0WzFdID0gYVsxXSAtIGJbMV07XHJcbiAgcmV0dXJuIG91dDtcclxufVxyXG5cclxuLyoqXHJcbiAqIE11bHRpcGxpZXMgdHdvIHZlYzInc1xyXG4gKlxyXG4gKiBAcGFyYW0ge3ZlYzJ9IG91dCB0aGUgcmVjZWl2aW5nIHZlY3RvclxyXG4gKiBAcGFyYW0ge3ZlYzJ9IGEgdGhlIGZpcnN0IG9wZXJhbmRcclxuICogQHBhcmFtIHt2ZWMyfSBiIHRoZSBzZWNvbmQgb3BlcmFuZFxyXG4gKiBAcmV0dXJucyB7dmVjMn0gb3V0XHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gbXVsdGlwbHkob3V0LCBhLCBiKSB7XHJcbiAgb3V0WzBdID0gYVswXSAqIGJbMF07XHJcbiAgb3V0WzFdID0gYVsxXSAqIGJbMV07XHJcbiAgcmV0dXJuIG91dDtcclxufVxyXG5cclxuLyoqXHJcbiAqIERpdmlkZXMgdHdvIHZlYzInc1xyXG4gKlxyXG4gKiBAcGFyYW0ge3ZlYzJ9IG91dCB0aGUgcmVjZWl2aW5nIHZlY3RvclxyXG4gKiBAcGFyYW0ge3ZlYzJ9IGEgdGhlIGZpcnN0IG9wZXJhbmRcclxuICogQHBhcmFtIHt2ZWMyfSBiIHRoZSBzZWNvbmQgb3BlcmFuZFxyXG4gKiBAcmV0dXJucyB7dmVjMn0gb3V0XHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gZGl2aWRlKG91dCwgYSwgYikge1xyXG4gIG91dFswXSA9IGFbMF0gLyBiWzBdO1xyXG4gIG91dFsxXSA9IGFbMV0gLyBiWzFdO1xyXG4gIHJldHVybiBvdXQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBNYXRoLmNlaWwgdGhlIGNvbXBvbmVudHMgb2YgYSB2ZWMyXHJcbiAqXHJcbiAqIEBwYXJhbSB7dmVjMn0gb3V0IHRoZSByZWNlaXZpbmcgdmVjdG9yXHJcbiAqIEBwYXJhbSB7dmVjMn0gYSB2ZWN0b3IgdG8gY2VpbFxyXG4gKiBAcmV0dXJucyB7dmVjMn0gb3V0XHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gY2VpbChvdXQsIGEpIHtcclxuICBvdXRbMF0gPSBNYXRoLmNlaWwoYVswXSk7XHJcbiAgb3V0WzFdID0gTWF0aC5jZWlsKGFbMV0pO1xyXG4gIHJldHVybiBvdXQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBNYXRoLmZsb29yIHRoZSBjb21wb25lbnRzIG9mIGEgdmVjMlxyXG4gKlxyXG4gKiBAcGFyYW0ge3ZlYzJ9IG91dCB0aGUgcmVjZWl2aW5nIHZlY3RvclxyXG4gKiBAcGFyYW0ge3ZlYzJ9IGEgdmVjdG9yIHRvIGZsb29yXHJcbiAqIEByZXR1cm5zIHt2ZWMyfSBvdXRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBmbG9vcihvdXQsIGEpIHtcclxuICBvdXRbMF0gPSBNYXRoLmZsb29yKGFbMF0pO1xyXG4gIG91dFsxXSA9IE1hdGguZmxvb3IoYVsxXSk7XHJcbiAgcmV0dXJuIG91dDtcclxufVxyXG5cclxuLyoqXHJcbiAqIFJldHVybnMgdGhlIG1pbmltdW0gb2YgdHdvIHZlYzInc1xyXG4gKlxyXG4gKiBAcGFyYW0ge3ZlYzJ9IG91dCB0aGUgcmVjZWl2aW5nIHZlY3RvclxyXG4gKiBAcGFyYW0ge3ZlYzJ9IGEgdGhlIGZpcnN0IG9wZXJhbmRcclxuICogQHBhcmFtIHt2ZWMyfSBiIHRoZSBzZWNvbmQgb3BlcmFuZFxyXG4gKiBAcmV0dXJucyB7dmVjMn0gb3V0XHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gbWluKG91dCwgYSwgYikge1xyXG4gIG91dFswXSA9IE1hdGgubWluKGFbMF0sIGJbMF0pO1xyXG4gIG91dFsxXSA9IE1hdGgubWluKGFbMV0sIGJbMV0pO1xyXG4gIHJldHVybiBvdXQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBSZXR1cm5zIHRoZSBtYXhpbXVtIG9mIHR3byB2ZWMyJ3NcclxuICpcclxuICogQHBhcmFtIHt2ZWMyfSBvdXQgdGhlIHJlY2VpdmluZyB2ZWN0b3JcclxuICogQHBhcmFtIHt2ZWMyfSBhIHRoZSBmaXJzdCBvcGVyYW5kXHJcbiAqIEBwYXJhbSB7dmVjMn0gYiB0aGUgc2Vjb25kIG9wZXJhbmRcclxuICogQHJldHVybnMge3ZlYzJ9IG91dFxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIG1heChvdXQsIGEsIGIpIHtcclxuICBvdXRbMF0gPSBNYXRoLm1heChhWzBdLCBiWzBdKTtcclxuICBvdXRbMV0gPSBNYXRoLm1heChhWzFdLCBiWzFdKTtcclxuICByZXR1cm4gb3V0O1xyXG59XHJcblxyXG4vKipcclxuICogTWF0aC5yb3VuZCB0aGUgY29tcG9uZW50cyBvZiBhIHZlYzJcclxuICpcclxuICogQHBhcmFtIHt2ZWMyfSBvdXQgdGhlIHJlY2VpdmluZyB2ZWN0b3JcclxuICogQHBhcmFtIHt2ZWMyfSBhIHZlY3RvciB0byByb3VuZFxyXG4gKiBAcmV0dXJucyB7dmVjMn0gb3V0XHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gcm91bmQob3V0LCBhKSB7XHJcbiAgb3V0WzBdID0gTWF0aC5yb3VuZChhWzBdKTtcclxuICBvdXRbMV0gPSBNYXRoLnJvdW5kKGFbMV0pO1xyXG4gIHJldHVybiBvdXQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBTY2FsZXMgYSB2ZWMyIGJ5IGEgc2NhbGFyIG51bWJlclxyXG4gKlxyXG4gKiBAcGFyYW0ge3ZlYzJ9IG91dCB0aGUgcmVjZWl2aW5nIHZlY3RvclxyXG4gKiBAcGFyYW0ge3ZlYzJ9IGEgdGhlIHZlY3RvciB0byBzY2FsZVxyXG4gKiBAcGFyYW0ge051bWJlcn0gYiBhbW91bnQgdG8gc2NhbGUgdGhlIHZlY3RvciBieVxyXG4gKiBAcmV0dXJucyB7dmVjMn0gb3V0XHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gc2NhbGUob3V0LCBhLCBiKSB7XHJcbiAgb3V0WzBdID0gYVswXSAqIGI7XHJcbiAgb3V0WzFdID0gYVsxXSAqIGI7XHJcbiAgcmV0dXJuIG91dDtcclxufVxyXG5cclxuLyoqXHJcbiAqIEFkZHMgdHdvIHZlYzIncyBhZnRlciBzY2FsaW5nIHRoZSBzZWNvbmQgb3BlcmFuZCBieSBhIHNjYWxhciB2YWx1ZVxyXG4gKlxyXG4gKiBAcGFyYW0ge3ZlYzJ9IG91dCB0aGUgcmVjZWl2aW5nIHZlY3RvclxyXG4gKiBAcGFyYW0ge3ZlYzJ9IGEgdGhlIGZpcnN0IG9wZXJhbmRcclxuICogQHBhcmFtIHt2ZWMyfSBiIHRoZSBzZWNvbmQgb3BlcmFuZFxyXG4gKiBAcGFyYW0ge051bWJlcn0gc2NhbGUgdGhlIGFtb3VudCB0byBzY2FsZSBiIGJ5IGJlZm9yZSBhZGRpbmdcclxuICogQHJldHVybnMge3ZlYzJ9IG91dFxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIHNjYWxlQW5kQWRkKG91dCwgYSwgYiwgc2NhbGUpIHtcclxuICBvdXRbMF0gPSBhWzBdICsgYlswXSAqIHNjYWxlO1xyXG4gIG91dFsxXSA9IGFbMV0gKyBiWzFdICogc2NhbGU7XHJcbiAgcmV0dXJuIG91dDtcclxufVxyXG5cclxuLyoqXHJcbiAqIENhbGN1bGF0ZXMgdGhlIGV1Y2xpZGlhbiBkaXN0YW5jZSBiZXR3ZWVuIHR3byB2ZWMyJ3NcclxuICpcclxuICogQHBhcmFtIHt2ZWMyfSBhIHRoZSBmaXJzdCBvcGVyYW5kXHJcbiAqIEBwYXJhbSB7dmVjMn0gYiB0aGUgc2Vjb25kIG9wZXJhbmRcclxuICogQHJldHVybnMge051bWJlcn0gZGlzdGFuY2UgYmV0d2VlbiBhIGFuZCBiXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gZGlzdGFuY2UoYSwgYikge1xyXG4gIHZhciB4ID0gYlswXSAtIGFbMF0sXHJcbiAgICAgIHkgPSBiWzFdIC0gYVsxXTtcclxuICByZXR1cm4gTWF0aC5zcXJ0KHggKiB4ICsgeSAqIHkpO1xyXG59XHJcblxyXG4vKipcclxuICogQ2FsY3VsYXRlcyB0aGUgc3F1YXJlZCBldWNsaWRpYW4gZGlzdGFuY2UgYmV0d2VlbiB0d28gdmVjMidzXHJcbiAqXHJcbiAqIEBwYXJhbSB7dmVjMn0gYSB0aGUgZmlyc3Qgb3BlcmFuZFxyXG4gKiBAcGFyYW0ge3ZlYzJ9IGIgdGhlIHNlY29uZCBvcGVyYW5kXHJcbiAqIEByZXR1cm5zIHtOdW1iZXJ9IHNxdWFyZWQgZGlzdGFuY2UgYmV0d2VlbiBhIGFuZCBiXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gc3F1YXJlZERpc3RhbmNlKGEsIGIpIHtcclxuICB2YXIgeCA9IGJbMF0gLSBhWzBdLFxyXG4gICAgICB5ID0gYlsxXSAtIGFbMV07XHJcbiAgcmV0dXJuIHggKiB4ICsgeSAqIHk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDYWxjdWxhdGVzIHRoZSBsZW5ndGggb2YgYSB2ZWMyXHJcbiAqXHJcbiAqIEBwYXJhbSB7dmVjMn0gYSB2ZWN0b3IgdG8gY2FsY3VsYXRlIGxlbmd0aCBvZlxyXG4gKiBAcmV0dXJucyB7TnVtYmVyfSBsZW5ndGggb2YgYVxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGxlbmd0aChhKSB7XHJcbiAgdmFyIHggPSBhWzBdLFxyXG4gICAgICB5ID0gYVsxXTtcclxuICByZXR1cm4gTWF0aC5zcXJ0KHggKiB4ICsgeSAqIHkpO1xyXG59XHJcblxyXG4vKipcclxuICogQ2FsY3VsYXRlcyB0aGUgc3F1YXJlZCBsZW5ndGggb2YgYSB2ZWMyXHJcbiAqXHJcbiAqIEBwYXJhbSB7dmVjMn0gYSB2ZWN0b3IgdG8gY2FsY3VsYXRlIHNxdWFyZWQgbGVuZ3RoIG9mXHJcbiAqIEByZXR1cm5zIHtOdW1iZXJ9IHNxdWFyZWQgbGVuZ3RoIG9mIGFcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBzcXVhcmVkTGVuZ3RoKGEpIHtcclxuICB2YXIgeCA9IGFbMF0sXHJcbiAgICAgIHkgPSBhWzFdO1xyXG4gIHJldHVybiB4ICogeCArIHkgKiB5O1xyXG59XHJcblxyXG4vKipcclxuICogTmVnYXRlcyB0aGUgY29tcG9uZW50cyBvZiBhIHZlYzJcclxuICpcclxuICogQHBhcmFtIHt2ZWMyfSBvdXQgdGhlIHJlY2VpdmluZyB2ZWN0b3JcclxuICogQHBhcmFtIHt2ZWMyfSBhIHZlY3RvciB0byBuZWdhdGVcclxuICogQHJldHVybnMge3ZlYzJ9IG91dFxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIG5lZ2F0ZShvdXQsIGEpIHtcclxuICBvdXRbMF0gPSAtYVswXTtcclxuICBvdXRbMV0gPSAtYVsxXTtcclxuICByZXR1cm4gb3V0O1xyXG59XHJcblxyXG4vKipcclxuICogUmV0dXJucyB0aGUgaW52ZXJzZSBvZiB0aGUgY29tcG9uZW50cyBvZiBhIHZlYzJcclxuICpcclxuICogQHBhcmFtIHt2ZWMyfSBvdXQgdGhlIHJlY2VpdmluZyB2ZWN0b3JcclxuICogQHBhcmFtIHt2ZWMyfSBhIHZlY3RvciB0byBpbnZlcnRcclxuICogQHJldHVybnMge3ZlYzJ9IG91dFxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGludmVyc2Uob3V0LCBhKSB7XHJcbiAgb3V0WzBdID0gMS4wIC8gYVswXTtcclxuICBvdXRbMV0gPSAxLjAgLyBhWzFdO1xyXG4gIHJldHVybiBvdXQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBOb3JtYWxpemUgYSB2ZWMyXHJcbiAqXHJcbiAqIEBwYXJhbSB7dmVjMn0gb3V0IHRoZSByZWNlaXZpbmcgdmVjdG9yXHJcbiAqIEBwYXJhbSB7dmVjMn0gYSB2ZWN0b3IgdG8gbm9ybWFsaXplXHJcbiAqIEByZXR1cm5zIHt2ZWMyfSBvdXRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBub3JtYWxpemUob3V0LCBhKSB7XHJcbiAgdmFyIHggPSBhWzBdLFxyXG4gICAgICB5ID0gYVsxXTtcclxuICB2YXIgbGVuID0geCAqIHggKyB5ICogeTtcclxuICBpZiAobGVuID4gMCkge1xyXG4gICAgLy9UT0RPOiBldmFsdWF0ZSB1c2Ugb2YgZ2xtX2ludnNxcnQgaGVyZT9cclxuICAgIGxlbiA9IDEgLyBNYXRoLnNxcnQobGVuKTtcclxuICAgIG91dFswXSA9IGFbMF0gKiBsZW47XHJcbiAgICBvdXRbMV0gPSBhWzFdICogbGVuO1xyXG4gIH1cclxuICByZXR1cm4gb3V0O1xyXG59XHJcblxyXG4vKipcclxuICogQ2FsY3VsYXRlcyB0aGUgZG90IHByb2R1Y3Qgb2YgdHdvIHZlYzInc1xyXG4gKlxyXG4gKiBAcGFyYW0ge3ZlYzJ9IGEgdGhlIGZpcnN0IG9wZXJhbmRcclxuICogQHBhcmFtIHt2ZWMyfSBiIHRoZSBzZWNvbmQgb3BlcmFuZFxyXG4gKiBAcmV0dXJucyB7TnVtYmVyfSBkb3QgcHJvZHVjdCBvZiBhIGFuZCBiXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gZG90KGEsIGIpIHtcclxuICByZXR1cm4gYVswXSAqIGJbMF0gKyBhWzFdICogYlsxXTtcclxufVxyXG5cclxuLyoqXHJcbiAqIENvbXB1dGVzIHRoZSBjcm9zcyBwcm9kdWN0IG9mIHR3byB2ZWMyJ3NcclxuICogTm90ZSB0aGF0IHRoZSBjcm9zcyBwcm9kdWN0IG11c3QgYnkgZGVmaW5pdGlvbiBwcm9kdWNlIGEgM0QgdmVjdG9yXHJcbiAqXHJcbiAqIEBwYXJhbSB7dmVjM30gb3V0IHRoZSByZWNlaXZpbmcgdmVjdG9yXHJcbiAqIEBwYXJhbSB7dmVjMn0gYSB0aGUgZmlyc3Qgb3BlcmFuZFxyXG4gKiBAcGFyYW0ge3ZlYzJ9IGIgdGhlIHNlY29uZCBvcGVyYW5kXHJcbiAqIEByZXR1cm5zIHt2ZWMzfSBvdXRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBjcm9zcyhvdXQsIGEsIGIpIHtcclxuICB2YXIgeiA9IGFbMF0gKiBiWzFdIC0gYVsxXSAqIGJbMF07XHJcbiAgb3V0WzBdID0gb3V0WzFdID0gMDtcclxuICBvdXRbMl0gPSB6O1xyXG4gIHJldHVybiBvdXQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBQZXJmb3JtcyBhIGxpbmVhciBpbnRlcnBvbGF0aW9uIGJldHdlZW4gdHdvIHZlYzInc1xyXG4gKlxyXG4gKiBAcGFyYW0ge3ZlYzJ9IG91dCB0aGUgcmVjZWl2aW5nIHZlY3RvclxyXG4gKiBAcGFyYW0ge3ZlYzJ9IGEgdGhlIGZpcnN0IG9wZXJhbmRcclxuICogQHBhcmFtIHt2ZWMyfSBiIHRoZSBzZWNvbmQgb3BlcmFuZFxyXG4gKiBAcGFyYW0ge051bWJlcn0gdCBpbnRlcnBvbGF0aW9uIGFtb3VudCwgaW4gdGhlIHJhbmdlIFswLTFdLCBiZXR3ZWVuIHRoZSB0d28gaW5wdXRzXHJcbiAqIEByZXR1cm5zIHt2ZWMyfSBvdXRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBsZXJwKG91dCwgYSwgYiwgdCkge1xyXG4gIHZhciBheCA9IGFbMF0sXHJcbiAgICAgIGF5ID0gYVsxXTtcclxuICBvdXRbMF0gPSBheCArIHQgKiAoYlswXSAtIGF4KTtcclxuICBvdXRbMV0gPSBheSArIHQgKiAoYlsxXSAtIGF5KTtcclxuICByZXR1cm4gb3V0O1xyXG59XHJcblxyXG4vKipcclxuICogR2VuZXJhdGVzIGEgcmFuZG9tIHZlY3RvciB3aXRoIHRoZSBnaXZlbiBzY2FsZVxyXG4gKlxyXG4gKiBAcGFyYW0ge3ZlYzJ9IG91dCB0aGUgcmVjZWl2aW5nIHZlY3RvclxyXG4gKiBAcGFyYW0ge051bWJlcn0gW3NjYWxlXSBMZW5ndGggb2YgdGhlIHJlc3VsdGluZyB2ZWN0b3IuIElmIG9tbWl0dGVkLCBhIHVuaXQgdmVjdG9yIHdpbGwgYmUgcmV0dXJuZWRcclxuICogQHJldHVybnMge3ZlYzJ9IG91dFxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIHJhbmRvbShvdXQsIHNjYWxlKSB7XHJcbiAgc2NhbGUgPSBzY2FsZSB8fCAxLjA7XHJcbiAgdmFyIHIgPSBnbE1hdHJpeC5SQU5ET00oKSAqIDIuMCAqIE1hdGguUEk7XHJcbiAgb3V0WzBdID0gTWF0aC5jb3MocikgKiBzY2FsZTtcclxuICBvdXRbMV0gPSBNYXRoLnNpbihyKSAqIHNjYWxlO1xyXG4gIHJldHVybiBvdXQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBUcmFuc2Zvcm1zIHRoZSB2ZWMyIHdpdGggYSBtYXQyXHJcbiAqXHJcbiAqIEBwYXJhbSB7dmVjMn0gb3V0IHRoZSByZWNlaXZpbmcgdmVjdG9yXHJcbiAqIEBwYXJhbSB7dmVjMn0gYSB0aGUgdmVjdG9yIHRvIHRyYW5zZm9ybVxyXG4gKiBAcGFyYW0ge21hdDJ9IG0gbWF0cml4IHRvIHRyYW5zZm9ybSB3aXRoXHJcbiAqIEByZXR1cm5zIHt2ZWMyfSBvdXRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiB0cmFuc2Zvcm1NYXQyKG91dCwgYSwgbSkge1xyXG4gIHZhciB4ID0gYVswXSxcclxuICAgICAgeSA9IGFbMV07XHJcbiAgb3V0WzBdID0gbVswXSAqIHggKyBtWzJdICogeTtcclxuICBvdXRbMV0gPSBtWzFdICogeCArIG1bM10gKiB5O1xyXG4gIHJldHVybiBvdXQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBUcmFuc2Zvcm1zIHRoZSB2ZWMyIHdpdGggYSBtYXQyZFxyXG4gKlxyXG4gKiBAcGFyYW0ge3ZlYzJ9IG91dCB0aGUgcmVjZWl2aW5nIHZlY3RvclxyXG4gKiBAcGFyYW0ge3ZlYzJ9IGEgdGhlIHZlY3RvciB0byB0cmFuc2Zvcm1cclxuICogQHBhcmFtIHttYXQyZH0gbSBtYXRyaXggdG8gdHJhbnNmb3JtIHdpdGhcclxuICogQHJldHVybnMge3ZlYzJ9IG91dFxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIHRyYW5zZm9ybU1hdDJkKG91dCwgYSwgbSkge1xyXG4gIHZhciB4ID0gYVswXSxcclxuICAgICAgeSA9IGFbMV07XHJcbiAgb3V0WzBdID0gbVswXSAqIHggKyBtWzJdICogeSArIG1bNF07XHJcbiAgb3V0WzFdID0gbVsxXSAqIHggKyBtWzNdICogeSArIG1bNV07XHJcbiAgcmV0dXJuIG91dDtcclxufVxyXG5cclxuLyoqXHJcbiAqIFRyYW5zZm9ybXMgdGhlIHZlYzIgd2l0aCBhIG1hdDNcclxuICogM3JkIHZlY3RvciBjb21wb25lbnQgaXMgaW1wbGljaXRseSAnMSdcclxuICpcclxuICogQHBhcmFtIHt2ZWMyfSBvdXQgdGhlIHJlY2VpdmluZyB2ZWN0b3JcclxuICogQHBhcmFtIHt2ZWMyfSBhIHRoZSB2ZWN0b3IgdG8gdHJhbnNmb3JtXHJcbiAqIEBwYXJhbSB7bWF0M30gbSBtYXRyaXggdG8gdHJhbnNmb3JtIHdpdGhcclxuICogQHJldHVybnMge3ZlYzJ9IG91dFxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIHRyYW5zZm9ybU1hdDMob3V0LCBhLCBtKSB7XHJcbiAgdmFyIHggPSBhWzBdLFxyXG4gICAgICB5ID0gYVsxXTtcclxuICBvdXRbMF0gPSBtWzBdICogeCArIG1bM10gKiB5ICsgbVs2XTtcclxuICBvdXRbMV0gPSBtWzFdICogeCArIG1bNF0gKiB5ICsgbVs3XTtcclxuICByZXR1cm4gb3V0O1xyXG59XHJcblxyXG4vKipcclxuICogVHJhbnNmb3JtcyB0aGUgdmVjMiB3aXRoIGEgbWF0NFxyXG4gKiAzcmQgdmVjdG9yIGNvbXBvbmVudCBpcyBpbXBsaWNpdGx5ICcwJ1xyXG4gKiA0dGggdmVjdG9yIGNvbXBvbmVudCBpcyBpbXBsaWNpdGx5ICcxJ1xyXG4gKlxyXG4gKiBAcGFyYW0ge3ZlYzJ9IG91dCB0aGUgcmVjZWl2aW5nIHZlY3RvclxyXG4gKiBAcGFyYW0ge3ZlYzJ9IGEgdGhlIHZlY3RvciB0byB0cmFuc2Zvcm1cclxuICogQHBhcmFtIHttYXQ0fSBtIG1hdHJpeCB0byB0cmFuc2Zvcm0gd2l0aFxyXG4gKiBAcmV0dXJucyB7dmVjMn0gb3V0XHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gdHJhbnNmb3JtTWF0NChvdXQsIGEsIG0pIHtcclxuICB2YXIgeCA9IGFbMF07XHJcbiAgdmFyIHkgPSBhWzFdO1xyXG4gIG91dFswXSA9IG1bMF0gKiB4ICsgbVs0XSAqIHkgKyBtWzEyXTtcclxuICBvdXRbMV0gPSBtWzFdICogeCArIG1bNV0gKiB5ICsgbVsxM107XHJcbiAgcmV0dXJuIG91dDtcclxufVxyXG5cclxuLyoqXHJcbiAqIFJvdGF0ZSBhIDJEIHZlY3RvclxyXG4gKiBAcGFyYW0ge3ZlYzJ9IG91dCBUaGUgcmVjZWl2aW5nIHZlYzJcclxuICogQHBhcmFtIHt2ZWMyfSBhIFRoZSB2ZWMyIHBvaW50IHRvIHJvdGF0ZVxyXG4gKiBAcGFyYW0ge3ZlYzJ9IGIgVGhlIG9yaWdpbiBvZiB0aGUgcm90YXRpb25cclxuICogQHBhcmFtIHtOdW1iZXJ9IGMgVGhlIGFuZ2xlIG9mIHJvdGF0aW9uXHJcbiAqIEByZXR1cm5zIHt2ZWMyfSBvdXRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiByb3RhdGUob3V0LCBhLCBiLCBjKSB7XHJcbiAgLy9UcmFuc2xhdGUgcG9pbnQgdG8gdGhlIG9yaWdpblxyXG4gIHZhciBwMCA9IGFbMF0gLSBiWzBdLFxyXG4gICAgICBwMSA9IGFbMV0gLSBiWzFdLFxyXG4gICAgICBzaW5DID0gTWF0aC5zaW4oYyksXHJcbiAgICAgIGNvc0MgPSBNYXRoLmNvcyhjKTtcclxuXHJcbiAgLy9wZXJmb3JtIHJvdGF0aW9uIGFuZCB0cmFuc2xhdGUgdG8gY29ycmVjdCBwb3NpdGlvblxyXG4gIG91dFswXSA9IHAwICogY29zQyAtIHAxICogc2luQyArIGJbMF07XHJcbiAgb3V0WzFdID0gcDAgKiBzaW5DICsgcDEgKiBjb3NDICsgYlsxXTtcclxuXHJcbiAgcmV0dXJuIG91dDtcclxufVxyXG5cclxuLyoqXHJcbiAqIEdldCB0aGUgYW5nbGUgYmV0d2VlbiB0d28gMkQgdmVjdG9yc1xyXG4gKiBAcGFyYW0ge3ZlYzJ9IGEgVGhlIGZpcnN0IG9wZXJhbmRcclxuICogQHBhcmFtIHt2ZWMyfSBiIFRoZSBzZWNvbmQgb3BlcmFuZFxyXG4gKiBAcmV0dXJucyB7TnVtYmVyfSBUaGUgYW5nbGUgaW4gcmFkaWFuc1xyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGFuZ2xlKGEsIGIpIHtcclxuICB2YXIgeDEgPSBhWzBdLFxyXG4gICAgICB5MSA9IGFbMV0sXHJcbiAgICAgIHgyID0gYlswXSxcclxuICAgICAgeTIgPSBiWzFdO1xyXG5cclxuICB2YXIgbGVuMSA9IHgxICogeDEgKyB5MSAqIHkxO1xyXG4gIGlmIChsZW4xID4gMCkge1xyXG4gICAgLy9UT0RPOiBldmFsdWF0ZSB1c2Ugb2YgZ2xtX2ludnNxcnQgaGVyZT9cclxuICAgIGxlbjEgPSAxIC8gTWF0aC5zcXJ0KGxlbjEpO1xyXG4gIH1cclxuXHJcbiAgdmFyIGxlbjIgPSB4MiAqIHgyICsgeTIgKiB5MjtcclxuICBpZiAobGVuMiA+IDApIHtcclxuICAgIC8vVE9ETzogZXZhbHVhdGUgdXNlIG9mIGdsbV9pbnZzcXJ0IGhlcmU/XHJcbiAgICBsZW4yID0gMSAvIE1hdGguc3FydChsZW4yKTtcclxuICB9XHJcblxyXG4gIHZhciBjb3NpbmUgPSAoeDEgKiB4MiArIHkxICogeTIpICogbGVuMSAqIGxlbjI7XHJcblxyXG4gIGlmIChjb3NpbmUgPiAxLjApIHtcclxuICAgIHJldHVybiAwO1xyXG4gIH0gZWxzZSBpZiAoY29zaW5lIDwgLTEuMCkge1xyXG4gICAgcmV0dXJuIE1hdGguUEk7XHJcbiAgfSBlbHNlIHtcclxuICAgIHJldHVybiBNYXRoLmFjb3MoY29zaW5lKTtcclxuICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBSZXR1cm5zIGEgc3RyaW5nIHJlcHJlc2VudGF0aW9uIG9mIGEgdmVjdG9yXHJcbiAqXHJcbiAqIEBwYXJhbSB7dmVjMn0gYSB2ZWN0b3IgdG8gcmVwcmVzZW50IGFzIGEgc3RyaW5nXHJcbiAqIEByZXR1cm5zIHtTdHJpbmd9IHN0cmluZyByZXByZXNlbnRhdGlvbiBvZiB0aGUgdmVjdG9yXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gc3RyKGEpIHtcclxuICByZXR1cm4gJ3ZlYzIoJyArIGFbMF0gKyAnLCAnICsgYVsxXSArICcpJztcclxufVxyXG5cclxuLyoqXHJcbiAqIFJldHVybnMgd2hldGhlciBvciBub3QgdGhlIHZlY3RvcnMgZXhhY3RseSBoYXZlIHRoZSBzYW1lIGVsZW1lbnRzIGluIHRoZSBzYW1lIHBvc2l0aW9uICh3aGVuIGNvbXBhcmVkIHdpdGggPT09KVxyXG4gKlxyXG4gKiBAcGFyYW0ge3ZlYzJ9IGEgVGhlIGZpcnN0IHZlY3Rvci5cclxuICogQHBhcmFtIHt2ZWMyfSBiIFRoZSBzZWNvbmQgdmVjdG9yLlxyXG4gKiBAcmV0dXJucyB7Qm9vbGVhbn0gVHJ1ZSBpZiB0aGUgdmVjdG9ycyBhcmUgZXF1YWwsIGZhbHNlIG90aGVyd2lzZS5cclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBleGFjdEVxdWFscyhhLCBiKSB7XHJcbiAgcmV0dXJuIGFbMF0gPT09IGJbMF0gJiYgYVsxXSA9PT0gYlsxXTtcclxufVxyXG5cclxuLyoqXHJcbiAqIFJldHVybnMgd2hldGhlciBvciBub3QgdGhlIHZlY3RvcnMgaGF2ZSBhcHByb3hpbWF0ZWx5IHRoZSBzYW1lIGVsZW1lbnRzIGluIHRoZSBzYW1lIHBvc2l0aW9uLlxyXG4gKlxyXG4gKiBAcGFyYW0ge3ZlYzJ9IGEgVGhlIGZpcnN0IHZlY3Rvci5cclxuICogQHBhcmFtIHt2ZWMyfSBiIFRoZSBzZWNvbmQgdmVjdG9yLlxyXG4gKiBAcmV0dXJucyB7Qm9vbGVhbn0gVHJ1ZSBpZiB0aGUgdmVjdG9ycyBhcmUgZXF1YWwsIGZhbHNlIG90aGVyd2lzZS5cclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBlcXVhbHMoYSwgYikge1xyXG4gIHZhciBhMCA9IGFbMF0sXHJcbiAgICAgIGExID0gYVsxXTtcclxuICB2YXIgYjAgPSBiWzBdLFxyXG4gICAgICBiMSA9IGJbMV07XHJcbiAgcmV0dXJuIE1hdGguYWJzKGEwIC0gYjApIDw9IGdsTWF0cml4LkVQU0lMT04gKiBNYXRoLm1heCgxLjAsIE1hdGguYWJzKGEwKSwgTWF0aC5hYnMoYjApKSAmJiBNYXRoLmFicyhhMSAtIGIxKSA8PSBnbE1hdHJpeC5FUFNJTE9OICogTWF0aC5tYXgoMS4wLCBNYXRoLmFicyhhMSksIE1hdGguYWJzKGIxKSk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBBbGlhcyBmb3Ige0BsaW5rIHZlYzIubGVuZ3RofVxyXG4gKiBAZnVuY3Rpb25cclxuICovXHJcbmV4cG9ydCB2YXIgbGVuID0gbGVuZ3RoO1xyXG5cclxuLyoqXHJcbiAqIEFsaWFzIGZvciB7QGxpbmsgdmVjMi5zdWJ0cmFjdH1cclxuICogQGZ1bmN0aW9uXHJcbiAqL1xyXG5leHBvcnQgdmFyIHN1YiA9IHN1YnRyYWN0O1xyXG5cclxuLyoqXHJcbiAqIEFsaWFzIGZvciB7QGxpbmsgdmVjMi5tdWx0aXBseX1cclxuICogQGZ1bmN0aW9uXHJcbiAqL1xyXG5leHBvcnQgdmFyIG11bCA9IG11bHRpcGx5O1xyXG5cclxuLyoqXHJcbiAqIEFsaWFzIGZvciB7QGxpbmsgdmVjMi5kaXZpZGV9XHJcbiAqIEBmdW5jdGlvblxyXG4gKi9cclxuZXhwb3J0IHZhciBkaXYgPSBkaXZpZGU7XHJcblxyXG4vKipcclxuICogQWxpYXMgZm9yIHtAbGluayB2ZWMyLmRpc3RhbmNlfVxyXG4gKiBAZnVuY3Rpb25cclxuICovXHJcbmV4cG9ydCB2YXIgZGlzdCA9IGRpc3RhbmNlO1xyXG5cclxuLyoqXHJcbiAqIEFsaWFzIGZvciB7QGxpbmsgdmVjMi5zcXVhcmVkRGlzdGFuY2V9XHJcbiAqIEBmdW5jdGlvblxyXG4gKi9cclxuZXhwb3J0IHZhciBzcXJEaXN0ID0gc3F1YXJlZERpc3RhbmNlO1xyXG5cclxuLyoqXHJcbiAqIEFsaWFzIGZvciB7QGxpbmsgdmVjMi5zcXVhcmVkTGVuZ3RofVxyXG4gKiBAZnVuY3Rpb25cclxuICovXHJcbmV4cG9ydCB2YXIgc3FyTGVuID0gc3F1YXJlZExlbmd0aDtcclxuXHJcbi8qKlxyXG4gKiBQZXJmb3JtIHNvbWUgb3BlcmF0aW9uIG92ZXIgYW4gYXJyYXkgb2YgdmVjMnMuXHJcbiAqXHJcbiAqIEBwYXJhbSB7QXJyYXl9IGEgdGhlIGFycmF5IG9mIHZlY3RvcnMgdG8gaXRlcmF0ZSBvdmVyXHJcbiAqIEBwYXJhbSB7TnVtYmVyfSBzdHJpZGUgTnVtYmVyIG9mIGVsZW1lbnRzIGJldHdlZW4gdGhlIHN0YXJ0IG9mIGVhY2ggdmVjMi4gSWYgMCBhc3N1bWVzIHRpZ2h0bHkgcGFja2VkXHJcbiAqIEBwYXJhbSB7TnVtYmVyfSBvZmZzZXQgTnVtYmVyIG9mIGVsZW1lbnRzIHRvIHNraXAgYXQgdGhlIGJlZ2lubmluZyBvZiB0aGUgYXJyYXlcclxuICogQHBhcmFtIHtOdW1iZXJ9IGNvdW50IE51bWJlciBvZiB2ZWMycyB0byBpdGVyYXRlIG92ZXIuIElmIDAgaXRlcmF0ZXMgb3ZlciBlbnRpcmUgYXJyYXlcclxuICogQHBhcmFtIHtGdW5jdGlvbn0gZm4gRnVuY3Rpb24gdG8gY2FsbCBmb3IgZWFjaCB2ZWN0b3IgaW4gdGhlIGFycmF5XHJcbiAqIEBwYXJhbSB7T2JqZWN0fSBbYXJnXSBhZGRpdGlvbmFsIGFyZ3VtZW50IHRvIHBhc3MgdG8gZm5cclxuICogQHJldHVybnMge0FycmF5fSBhXHJcbiAqIEBmdW5jdGlvblxyXG4gKi9cclxuZXhwb3J0IHZhciBmb3JFYWNoID0gZnVuY3Rpb24gKCkge1xyXG4gIHZhciB2ZWMgPSBjcmVhdGUoKTtcclxuXHJcbiAgcmV0dXJuIGZ1bmN0aW9uIChhLCBzdHJpZGUsIG9mZnNldCwgY291bnQsIGZuLCBhcmcpIHtcclxuICAgIHZhciBpID0gdm9pZCAwLFxyXG4gICAgICAgIGwgPSB2b2lkIDA7XHJcbiAgICBpZiAoIXN0cmlkZSkge1xyXG4gICAgICBzdHJpZGUgPSAyO1xyXG4gICAgfVxyXG5cclxuICAgIGlmICghb2Zmc2V0KSB7XHJcbiAgICAgIG9mZnNldCA9IDA7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGNvdW50KSB7XHJcbiAgICAgIGwgPSBNYXRoLm1pbihjb3VudCAqIHN0cmlkZSArIG9mZnNldCwgYS5sZW5ndGgpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgbCA9IGEubGVuZ3RoO1xyXG4gICAgfVxyXG5cclxuICAgIGZvciAoaSA9IG9mZnNldDsgaSA8IGw7IGkgKz0gc3RyaWRlKSB7XHJcbiAgICAgIHZlY1swXSA9IGFbaV07dmVjWzFdID0gYVtpICsgMV07XHJcbiAgICAgIGZuKHZlYywgdmVjLCBhcmcpO1xyXG4gICAgICBhW2ldID0gdmVjWzBdO2FbaSArIDFdID0gdmVjWzFdO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBhO1xyXG4gIH07XHJcbn0oKTsiLCIvKiFcbiAqIEBtYXB0YWxrcy9nbHRmLWxvYWRlciB2MC4xLjZcbiAqIExJQ0VOU0UgOiBVTkxJQ0VOU0VEXG4gKiAoYykgMjAxNi0yMDE5IG1hcHRhbGtzLm9yZ1xuICovXG5pbXBvcnQgZSBmcm9tXCJ6b3VzYW5cIjtpbXBvcnR7cXVhdCBhcyB0LG1hdDQgYXMgcn1mcm9tXCJnbC1tYXRyaXhcIjtsZXQgczt2YXIgbj1zPVwidW5kZWZpbmVkXCIhPXR5cGVvZiBQcm9taXNlP1Byb21pc2U6ZTtjb25zdCBpPXtnZXQ6ZnVuY3Rpb24oZSx0KXtjb25zdCByPWkuX2dldENsaWVudCgpLHM9bmV3IG4oKHMsbik9PntpZihyLm9wZW4oXCJHRVRcIixlLCEwKSx0KXtmb3IoY29uc3QgZSBpbiB0LmhlYWRlcnMpci5zZXRSZXF1ZXN0SGVhZGVyKGUsdC5oZWFkZXJzW2VdKTtyLndpdGhDcmVkZW50aWFscz1cImluY2x1ZGVcIj09PXQuY3JlZGVudGlhbHMsdC5yZXNwb25zZVR5cGUmJihyLnJlc3BvbnNlVHlwZT10LnJlc3BvbnNlVHlwZSl9ci5vbnJlYWR5c3RhdGVjaGFuZ2U9aS5fd3JhcENhbGxiYWNrKHIsZnVuY3Rpb24oZSx0KXtlP24oZSk6cyh0KX0pLHIuc2VuZChudWxsKX0pO3JldHVybiBzLnhocj1yLHN9LF93cmFwQ2FsbGJhY2s6ZnVuY3Rpb24oZSx0KXtyZXR1cm4gZnVuY3Rpb24oKXtpZig0PT09ZS5yZWFkeVN0YXRlKWlmKDIwMD09PWUuc3RhdHVzKWlmKFwiYXJyYXlidWZmZXJcIj09PWUucmVzcG9uc2VUeXBlKXswPT09ZS5yZXNwb25zZS5ieXRlTGVuZ3RoP3QobmV3IEVycm9yKFwiaHR0cCBzdGF0dXMgMjAwIHJldHVybmVkIHdpdGhvdXQgY29udGVudC5cIikpOnQobnVsbCx7ZGF0YTplLnJlc3BvbnNlLGNhY2hlQ29udHJvbDplLmdldFJlc3BvbnNlSGVhZGVyKFwiQ2FjaGUtQ29udHJvbFwiKSxleHBpcmVzOmUuZ2V0UmVzcG9uc2VIZWFkZXIoXCJFeHBpcmVzXCIpLGNvbnRlbnRUeXBlOmUuZ2V0UmVzcG9uc2VIZWFkZXIoXCJDb250ZW50LVR5cGVcIil9KX1lbHNlIHQobnVsbCxlLnJlc3BvbnNlVGV4dCk7ZWxzZXtpZigwPT09ZS5zdGF0dXMpcmV0dXJuO3QobmV3IEVycm9yKGUuc3RhdHVzVGV4dCtcIixcIitlLnN0YXR1cykpfX19LF9nZXRDbGllbnQ6ZnVuY3Rpb24oKXtsZXQgZTt0cnl7ZT1uZXcgWE1MSHR0cFJlcXVlc3R9Y2F0Y2godCl7dHJ5e2U9bmV3IEFjdGl2ZVhPYmplY3QoXCJNc3htbDIuWE1MSFRUUFwiKX1jYXRjaCh0KXt0cnl7ZT1uZXcgQWN0aXZlWE9iamVjdChcIk1pY3Jvc29mdC5YTUxIVFRQXCIpfWNhdGNoKGUpe319fXJldHVybiBlfSxnZXRBcnJheUJ1ZmZlcjooZSx0KT0+KHR8fCh0PXt9KSx0LnJlc3BvbnNlVHlwZT1cImFycmF5YnVmZmVyXCIsaS5nZXQoZSx0KSl9O2Z1bmN0aW9uIGEoZSl7cmV0dXJuIG51bGw9PWV9ZnVuY3Rpb24gbyhlKXtyZXR1cm4hYShlKX1mdW5jdGlvbiB1KGUpe3JldHVyblwibnVtYmVyXCI9PXR5cGVvZiBlJiZpc0Zpbml0ZShlKX1mdW5jdGlvbiBoKGUpe2ZvcihsZXQgdD0xO3Q8YXJndW1lbnRzLmxlbmd0aDt0Kyspe2NvbnN0IHI9YXJndW1lbnRzW3RdO2Zvcihjb25zdCB0IGluIHIpZVt0XT1yW3RdfXJldHVybiBlfWkuZ2V0SlNPTj1mdW5jdGlvbihlLHQpe2NvbnN0IHI9aS5nZXQoZSx0KSxzPXIudGhlbihlPT5lP0pTT04ucGFyc2UoZSk6bnVsbCk7cmV0dXJuIHMueGhyPXIueGhyLHN9O2NsYXNzIGx7Y29uc3RydWN0b3IoZSx0KXt0aGlzLnJvb3RQYXRoPWUsdGhpcy5nbHRmPXR9aXRlcmF0ZShlLHQpe2NvbnN0IHI9dGhpcy5nbHRmW3RdO2lmKCFyKXJldHVybjtsZXQgcz0wO2Zvcihjb25zdCB0IGluIHIpZSh0LHJbdF0scysrKX1jcmVhdGVOb2RlKGUsdCl7Y29uc3Qgcj17fTtyZXR1cm4gbyhlLm5hbWUpJiYoci5uYW1lPWUubmFtZSksbyhlLmNoaWxkcmVuKSYmKHIuY2hpbGRyZW49ZS5jaGlsZHJlbiksbyhlLmpvaW50TmFtZSkmJihyLmpvaW50TmFtZT1lLmpvaW50TmFtZSksbyhlLm1hdHJpeCkmJihyLm1hdHJpeD1lLm1hdHJpeCksbyhlLnJvdGF0aW9uKSYmKHIucm90YXRpb249ZS5yb3RhdGlvbiksbyhlLnNjYWxlKSYmKHIuc2NhbGU9ZS5zY2FsZSksbyhlLnRyYW5zbGF0aW9uKSYmKHIudHJhbnNsYXRpb249ZS50cmFuc2xhdGlvbiksbyhlLmV4dHJhcykmJihyLmV4dHJhcz1lLmV4dHJhcyksbyhlLm1lc2hlcykmJihyLm1lc2hlcz1lLm1lc2hlcy5tYXAoZT0+dFtlXSkpLHJ9Z2V0QmFzZUNvbG9yVGV4dHVyZShlKXtjb25zdCB0PXRoaXMuZ2x0Zi5tYXRlcmlhbHNbZV07bGV0IHIscztpZih2b2lkIDA9PT0ocz10Lmluc3RhbmNlVGVjaG5pcXVlJiZ0Lmluc3RhbmNlVGVjaG5pcXVlLnZhbHVlcz8ocj10Lmluc3RhbmNlVGVjaG5pcXVlKS52YWx1ZXMuZGlmZnVzZToocj10KS52YWx1ZXMudGV4fHxyLnZhbHVlcy5kaWZmdXNlKXx8dm9pZCAwPT09dGhpcy5nbHRmLnRleHR1cmVzKXJldHVybiBudWxsO2NvbnN0IG49dGhpcy5nbHRmLnRleHR1cmVzW3NdO2lmKCFuKXJldHVybiBudWxsO2NvbnN0IGk9dGhpcy5nbHRmLnNhbXBsZXJzW24uc2FtcGxlcl07cmV0dXJue2Zvcm1hdDpuLmZvcm1hdHx8NjQwOCxpbnRlcm5hbEZvcm1hdDpuLmludGVybmFsRm9ybWF0fHw2NDA4LHR5cGU6bi50eXBlfHw1MTIxLHNhbXBsZXI6aSxzb3VyY2U6dGhpcy5nbHRmLmltYWdlc1tuLnNvdXJjZV19fWdldE1hdGVyaWFsKCl7cmV0dXJuIG51bGx9Z2V0QW5pbWF0aW9ucygpe3JldHVybiBudWxsfX1jb25zdCBmPVtcIlNDQUxBUlwiLDEsXCJWRUMyXCIsMixcIlZFQzNcIiwzLFwiVkVDNFwiLDQsXCJNQVQyXCIsNCxcIk1BVDNcIiw5LFwiTUFUNFwiLDE2XTtjbGFzcyBje2NvbnN0cnVjdG9yKGUsdCxyKXt0aGlzLnJvb3RQYXRoPWUsdGhpcy5nbHRmPXQsdGhpcy5nbGJCdWZmZXI9cix0aGlzLmJ1ZmZlcnM9e30sdGhpcy5yZXF1ZXN0cz17fX1fcmVxdWVzdERhdGEoZSx0KXtjb25zdCByPXRoaXMuZ2x0ZixzPXIuYWNjZXNzb3JzW3RdLGE9ci5idWZmZXJWaWV3c1tzLmJ1ZmZlclZpZXddLG89ci5idWZmZXJzW2EuYnVmZmVyXTtpZihcImJpbmFyeV9nbFRGXCIhPT1hLmJ1ZmZlciYmXCJLSFJfYmluYXJ5X2dsVEZcIiE9PWEuYnVmZmVyJiZvLnVyaSl7Y29uc3Qgcj1vLnVyaSxzPTA9PT1vLnVyaS5pbmRleE9mKFwiZGF0YTphcHBsaWNhdGlvbi9cIik/by51cmk6dGhpcy5yb290UGF0aCtcIi9cIityO3JldHVybiB0aGlzLnJlcXVlc3RzW3NdP3RoaXMucmVxdWVzdHNbc10udGhlbigoKT0+e2NvbnN0e2FycmF5OnIsaXRlbVNpemU6bn09dGhpcy5fdG9UeXBlZEFycmF5KHQsdGhpcy5idWZmZXJzW3NdKTtyZXR1cm57bmFtZTplLGFjY2Vzc29yTmFtZTp0LGFycmF5OnIsaXRlbVNpemU6bn19KTp0aGlzLnJlcXVlc3RzW3NdPWkuZ2V0QXJyYXlCdWZmZXIocyxudWxsKS50aGVuKHI9Pntjb25zdCBuPXIuZGF0YTt0aGlzLmJ1ZmZlcnNbc109bjtjb25zdHthcnJheTppLGl0ZW1TaXplOmF9PXRoaXMuX3RvVHlwZWRBcnJheSh0LG4pO3JldHVybntuYW1lOmUsYWNjZXNzb3JOYW1lOnQsYXJyYXk6aSxpdGVtU2l6ZTphfX0pfXtjb25zdHthcnJheTpyLGl0ZW1TaXplOnN9PXRoaXMuX3RvVHlwZWRBcnJheSh0LHRoaXMuZ2xiQnVmZmVyLmJ1ZmZlcix0aGlzLmdsYkJ1ZmZlci5ieXRlT2Zmc2V0KTtyZXR1cm4gbi5yZXNvbHZlKHtuYW1lOmUsYWNjZXNzb3JOYW1lOnQsYXJyYXk6cixpdGVtU2l6ZTpzfSl9fV90b1R5cGVkQXJyYXkoZSx0LHI9MCl7Y29uc3Qgcz10aGlzLmdsdGYsbj1zLmFjY2Vzc29yc1tlXTtsZXQgaT0ocy5idWZmZXJWaWV3c1tuLmJ1ZmZlclZpZXddLmJ5dGVPZmZzZXR8fDApKyhuLmJ5dGVPZmZzZXR8fDApK3I7Y29uc3QgYT10aGlzLl9nZXRUeXBlSXRlbVNpemUobi50eXBlKSxvPXRoaXMuX2dldEFycmF5Q3RvcihuLmNvbXBvbmVudFR5cGUpLHU9bi5ieXRlU3RyaWRlO3JldHVybiB1JiZ1IT09YSpvLkJZVEVTX1BFUl9FTEVNRU5UPyhjb25zb2xlLndhcm4oXCJHTFRGIGludGVybGVhdmVkIGFjY2Vzc29ycyBub3Qgc3VwcG9ydGVkXCIpLG5ldyBvKFtdKSk6KGklby5CWVRFU19QRVJfRUxFTUVOVCE9MCYmKHQ9dC5zbGljZShpLGkrbi5jb3VudCphKm8uQllURVNfUEVSX0VMRU1FTlQpLGk9MCkse2FycmF5Om5ldyBvKHQsaSxuLmNvdW50KmEpLGl0ZW1TaXplOmF9KX1fZ2V0QXJyYXlDdG9yKGUpe3N3aXRjaChlKXtjYXNlIDUxMjA6cmV0dXJuIEludDhBcnJheTtjYXNlIDUxMjE6cmV0dXJuIFVpbnQ4QXJyYXk7Y2FzZSA1MTIyOnJldHVybiBJbnQxNkFycmF5O2Nhc2UgNTEyMzpyZXR1cm4gVWludDE2QXJyYXk7Y2FzZSA1MTI0OnJldHVybiBJbnQzMkFycmF5O2Nhc2UgNTEyNTpyZXR1cm4gVWludDMyQXJyYXk7Y2FzZSA1MTI2OnJldHVybiBGbG9hdDMyQXJyYXl9dGhyb3cgbmV3IEVycm9yKFwidW5zdXBwb3J0ZWQgYnVmZmVyVmlldydzIGNvbXBvbmVuZyB0eXBlOiBcIitlKX1fZ2V0VHlwZUl0ZW1TaXplKGUpe2NvbnN0IHQ9Zi5pbmRleE9mKGUpO3JldHVybiBmW3QrMV19fWNsYXNzIGd7Y29uc3RydWN0b3IoZSx0LHIscyl7dGhpcy5yb290UGF0aD1lLHRoaXMuZ2x0Zj10LHRoaXMuZ2xiQnVmZmVyPXIsdGhpcy5idWZmZXJzPXt9LHRoaXMucmVxdWVzdHM9e30sdGhpcy5fcmVxdWVzdEltYWdlPXMsdGhpcy5hY2Nlc3Nvcj1uZXcgYyhlLHQscil9aXRlcmF0ZShlLHQpe2NvbnN0IHI9dGhpcy5nbHRmW3RdO2lmKHIpZm9yKGxldCB0PTA7dDxyLmxlbmd0aDt0KyspZSh0LHJbdF0sdCl9Y3JlYXRlTm9kZShlLHQscil7Y29uc3Qgcz17fTtyZXR1cm4gaChzLGUpLG8oZS5tZXNoKSYmKHMubWVzaGVzPVt0W2UubWVzaF1dKSxvKGUuc2tpbikmJihzLnNraW49cltlLnNraW5dLHMuc2tpbkluZGV4PWUuc2tpbiksc31nZXRNYXRlcmlhbChlKXtjb25zdCB0PXRoaXMuZ2x0Zi5tYXRlcmlhbHNbZV0scj10LnBick1ldGFsbGljUm91Z2huZXNzLHM9dC5ub3JtYWxUZXh0dXJlLGk9dC5vY2NsdXNpb25UZXh0dXJlLGE9dC5lbWlzc2l2ZVRleHR1cmUsbz1bXTtyZXR1cm4gciYmby5wdXNoKHRoaXMuX2dldFBick1ldGFsbGljUm91Z2huZXNzKHIpKSxzJiZvLnB1c2godGhpcy5fZ2V0VGV4dHVyZUluZm8ocyxcIm5vcm1hbFRleHR1cmVcIikpLGkmJm8ucHVzaCh0aGlzLl9nZXRUZXh0dXJlSW5mbyhpLFwib2NjbHVzaW9uVGV4dHVyZVwiKSksYSYmby5wdXNoKHRoaXMuX2dldFRleHR1cmVJbmZvKGEsXCJlbWlzc2l2ZVRleHR1cmVcIikpLG4uYWxsKG8pLnRoZW4oZT0+e2NvbnN0IHI9e307aChyLHQpO2ZvcihsZXQgdD0wO3Q8ZS5sZW5ndGg7dCsrKXJbZVt0XS5uYW1lXT1lW3RdO3JldHVybnttYXRlcmlhbDpyfX0pfV9nZXRQYnJNZXRhbGxpY1JvdWdobmVzcyhlKXtjb25zdCB0PWUuYmFzZUNvbG9yVGV4dHVyZSxyPWUubWV0YWxsaWNSb3VnaG5lc3NUZXh0dXJlO2UubmFtZT1cInBick1ldGFsbGljUm91Z2huZXNzXCI7Y29uc3Qgcz1bXTtyZXR1cm4gdCYmcy5wdXNoKHRoaXMuX2dldFRleHR1cmVJbmZvKHQsXCJiYXNlQ29sb3JUZXh0dXJlXCIpKSxyJiZzLnB1c2godGhpcy5fZ2V0VGV4dHVyZUluZm8ocixcIm1ldGFsbGljUm91Z2huZXNzVGV4dHVyZVwiKSksbi5hbGwocykudGhlbih0PT57Y29uc3Qgcj17fTtoKHIsZSk7Zm9yKGxldCBlPTA7ZTx0Lmxlbmd0aDtlKyspZGVsZXRlIHRbZV0uaW5kZXgsclt0W2VdLm5hbWVdPXRbZV07cmV0dXJuIHJ9KX1fZ2V0VGV4dHVyZUluZm8oZSx0KXtjb25zdCByPWUuaW5kZXg7cmV0dXJuIG8ocik/KGUubmFtZT10LHRoaXMuX2dldFRleHR1cmUocikudGhlbih0PT57Y29uc3Qgcj17dGV4dHVyZTp0fTtyZXR1cm4gaChyLGUpLGRlbGV0ZSByLmluZGV4LHJ9KSk6bnVsbH1fZ2V0VGV4dHVyZShlKXtjb25zdCB0PXRoaXMuZ2x0Zi50ZXh0dXJlc1tlXTtpZighdClyZXR1cm4gbnVsbDtjb25zdCByPXRoaXMuZ2x0Zi5pbWFnZXNbdC5zb3VyY2VdO3JldHVybiB0aGlzLl9sb2FkSW1hZ2UocikudGhlbihlPT57Y29uc3Qgcz17aW1hZ2U6e2FycmF5OmUuZGF0YSx3aWR0aDplLndpZHRoLGhlaWdodDplLmhlaWdodCxpbmRleDp0LnNvdXJjZSxtaW1lVHlwZTpyLm1pbWVUeXBlLG5hbWU6ci5uYW1lLGV4dGVuc2lvbnM6ci5leHRlbnNpb25zLGV4dHJhczpyLmV4dHJhc319O2gocyx0KSxkZWxldGUgcy5zYW1wbGVyO2NvbnN0IG49byh0LnNhbXBsZXIpP3RoaXMuZ2x0Zi5zYW1wbGVyc1t0LnNhbXBsZXJdOnZvaWQgMDtyZXR1cm4gbiYmKHMuc2FtcGxlcj1uKSxzfSl9X2xvYWRJbWFnZShlKXtpZighbyhlLmJ1ZmZlclZpZXcpKXtjb25zdCB0PWUudXJpLHI9MD09PXQuaW5kZXhPZihcImRhdGE6aW1hZ2UvXCIpP3Q6dGhpcy5yb290UGF0aCtcIi9cIit0O3JldHVybiB0aGlzLl9yZXF1ZXN0RnJvbVVybChyKX17Y29uc3QgdD10aGlzLmdsdGYuYnVmZmVyVmlld3NbZS5idWZmZXJWaWV3XTtpZih0aGlzLmJ1ZmZlcnNbZS5idWZmZXJWaWV3XSlyZXR1cm4gbi5yZXNvbHZlKHRoaXMuYnVmZmVyc1tlLmJ1ZmZlclZpZXddKTtjb25zdCByPXRoaXMuZ2x0Zi5idWZmZXJzW3QuYnVmZmVyXTtpZihyLnVyaSlyZXR1cm4gdGhpcy5fcmVxdWVzdEZyb21BcnJheUJ1ZmZlcihyLnVyaSx0LGUpO2lmKHRoaXMuZ2xiQnVmZmVyKXJldHVybiB0aGlzLl9yZXF1ZXN0RnJvbUdsYkJ1ZmZlcih0LGUpfXJldHVybiBudWxsfV9yZXF1ZXN0RnJvbVVybChlKXtpZih0aGlzLnJlcXVlc3RzW2VdKXJldHVybiB0aGlzLnJlcXVlc3RzW2VdLnRoZW4oKCk9PnRoaXMuYnVmZmVyc1tlXSk7cmV0dXJuIHRoaXMucmVxdWVzdHNbZV09dGhpcy5fZ2V0SW1hZ2VJbmZvKGUsZSl9X3JlcXVlc3RGcm9tQXJyYXlCdWZmZXIoZSx0LHIpe2NvbnN0IHM9ci5idWZmZXJWaWV3O3JldHVybiB0aGlzLnJlcXVlc3RzW2VdP3RoaXMucmVxdWVzdHNbZV0udGhlbigoKT0+dGhpcy5idWZmZXJzW3NdKTppLmdldEFycmF5QnVmZmVyKGUsbnVsbCkudGhlbihlPT57Y29uc3Qgbj1lLmRhdGEsaT10aGlzLl9jcmVhdGVEYXRhVmlldyh0LG4pLGE9bmV3IEJsb2IoW2ldLHt0eXBlOnIubWltZVR5cGV9KSxvPVVSTC5jcmVhdGVPYmplY3RVUkwoYSk7cmV0dXJuIHRoaXMuX2dldEltYWdlSW5mbyhzLG8pfSl9X3JlcXVlc3RGcm9tR2xiQnVmZmVyKGUsdCl7Y29uc3Qgcj10aGlzLl9jcmVhdGVEYXRhVmlldyhlLHRoaXMuZ2xiQnVmZmVyLmJ1ZmZlcix0aGlzLmdsYkJ1ZmZlci5ieXRlT2Zmc2V0KSxzPW5ldyBCbG9iKFtyXSx7dHlwZTp0Lm1pbWVUeXBlfSksbj1VUkwuY3JlYXRlT2JqZWN0VVJMKHMpO3JldHVybiB0aGlzLl9nZXRJbWFnZUluZm8odC5idWZmZXJWaWV3LG4pfV9nZXRJbWFnZUluZm8oZSx0KXtyZXR1cm4gbmV3IG4oKHIscyk9Pnt0aGlzLl9yZXF1ZXN0SW1hZ2UodCwodCxuKT0+e3Q/cyh0KToodGhpcy5idWZmZXJzW2VdPW4scih0aGlzLmJ1ZmZlcnNbZV0pKX0pfSl9X2NyZWF0ZURhdGFWaWV3KGUsdCxyKXtyPXJ8fDA7Y29uc3Qgcz1lLmJ5dGVPZmZzZXQrcixuPWUuYnl0ZUxlbmd0aDtyZXR1cm4gdC5zbGljZShzLHMrbil9X3RyYW5zZm9ybUFycmF5QnVmZmVyVG9CYXNlNjQoZSx0KXtjb25zdCByPW5ldyBBcnJheShlLmJ5dGVMZW5ndGgpO2ZvcihsZXQgdD0wO3Q8ZS5ieXRlTGVuZ3RoO3QrKylyW3RdPVN0cmluZy5mcm9tQ2hhckNvZGUoZVt0XSk7cmV0dXJuIHIuam9pbihcIlwiKSxcImRhdGE6XCIrKHQ9dHx8XCJpbWFnZS9wbmdcIikrXCI7YmFzZTY0LFwiK3dpbmRvdy5idG9hKHVuZXNjYXBlKGVuY29kZVVSSUNvbXBvbmVudChyKSkpfWdldEFuaW1hdGlvbnMoZSl7Y29uc3QgdD1bXTtyZXR1cm4gZS5mb3JFYWNoKGU9Pnt0LnB1c2godGhpcy5nZXRTYW1wbGVycyhlLnNhbXBsZXJzKSl9KSxuLmFsbCh0KS50aGVuKHQ9Pntmb3IobGV0IHI9MDtyPHQubGVuZ3RoO3IrKyllW3JdLnNhbXBsZXJzPXRbcl07cmV0dXJuIGV9KX1nZXRTYW1wbGVycyhlKXtjb25zdCB0PVtdO2ZvcihsZXQgcj0wO3I8ZS5sZW5ndGg7cisrKShvKGVbcl0uaW5wdXQpfHxvKGVbcl0ub3V0cHV0KSkmJih0LnB1c2godGhpcy5hY2Nlc3Nvci5fcmVxdWVzdERhdGEoXCJpbnB1dFwiLGVbcl0uaW5wdXQpKSx0LnB1c2godGhpcy5hY2Nlc3Nvci5fcmVxdWVzdERhdGEoXCJvdXRwdXRcIixlW3JdLm91dHB1dCkpKTtyZXR1cm4gbi5hbGwodCkudGhlbih0PT57Zm9yKGxldCByPTA7cjx0Lmxlbmd0aC8yO3IrKyllW3JdLmlucHV0PXRbMipyXSxlW3JdLm91dHB1dD10WzIqcisxXSxlW3JdLmludGVycG9sYXRpb258fChlW3JdLmludGVycG9sYXRpb249XCJMSU5FQVJcIik7cmV0dXJuIGV9KX19Y29uc3QgbT1cInVuZGVmaW5lZFwiIT10eXBlb2YgVGV4dERlY29kZXI/bmV3IFRleHREZWNvZGVyKFwidXRmLThcIik6bnVsbCxwPTEyLGQ9e0pTT046MTMxMzgyMTUxNCxCSU46NTEzMDU2Mn07Y2xhc3MgYntzdGF0aWMgcmVhZChlLHQ9MCl7Y29uc3Qgcj1uZXcgRGF0YVZpZXcoZSx0KSxzPXIuZ2V0VWludDMyKDQsITApO2lmKDE9PT1zKXJldHVybiBiLnJlYWRWMShyLHQpO2lmKDI9PT1zKXJldHVybiBiLnJlYWRWMihlLHQpO3Rocm93IG5ldyBFcnJvcihcIlVuc3VwcG9ydGVkIGdsYiB2ZXJzaW9uIDogXCIrcyl9c3RhdGljIHJlYWRWMShlLHQpe2NvbnN0IHI9ZS5nZXRVaW50MzIoOCwhMCkscz1lLmdldFVpbnQzMigxMiwhMCk7aWYociE9PWUuYnVmZmVyLmJ5dGVMZW5ndGgtdCl0aHJvdyBuZXcgRXJyb3IoXCJMZW5ndGggaW4gR0xCIGhlYWRlciBpcyBpbmNvbnNpc3RlbnQgd2l0aCBnbGIncyBieXRlIGxlbmd0aC5cIik7Y29uc3Qgbj14KGUuYnVmZmVyLDIwK3Qscyk7cmV0dXJue2pzb246SlNPTi5wYXJzZShuKSxnbGJCdWZmZXI6e2J5dGVPZmZzZXQ6MjArdCtzLGJ1ZmZlcjplLmJ1ZmZlcn19fXN0YXRpYyByZWFkVjIoZSx0KXtsZXQgcixzO2NvbnN0IG49bmV3IERhdGFWaWV3KGUscCk7bGV0IGk9MDtmb3IoO2k8bi5ieXRlTGVuZ3RoOyl7Y29uc3QgdD1uLmdldFVpbnQzMihpLCEwKTtpKz00O2NvbnN0IGE9bi5nZXRVaW50MzIoaSwhMCk7aWYoaSs9NCxhPT09ZC5KU09OKXI9eChlLHAraSx0KTtlbHNlIGlmKGE9PT1kLkJJTil7Y29uc3Qgcj1wK2k7cz1lLnNsaWNlKHIscit0KX1pKz10fXJldHVybntqc29uOkpTT04ucGFyc2UociksZ2xiQnVmZmVyOntieXRlT2Zmc2V0OnQsYnVmZmVyOnN9fX19ZnVuY3Rpb24geChlLHQscil7aWYobSl7Y29uc3Qgcz1uZXcgVWludDhBcnJheShlLHQscik7cmV0dXJuIG0uZGVjb2RlKHMpfXJldHVybiBmdW5jdGlvbihlKXtjb25zdCB0PWUubGVuZ3RoO2xldCByPVwiXCI7Zm9yKGxldCBzPTA7czx0Oyl7bGV0IG49ZVtzKytdO2lmKDEyOCZuKXtsZXQgcj1fW24+PjMmN107aWYoISg2NCZuKXx8IXJ8fHMrcj50KXJldHVybiBudWxsO2ZvcihuJj02Mz4+cjtyPjA7ci09MSl7Y29uc3QgdD1lW3MrK107aWYoMTI4IT0oMTkyJnQpKXJldHVybiBudWxsO249bjw8Nnw2MyZ0fX1yKz1TdHJpbmcuZnJvbUNoYXJDb2RlKG4pfXJldHVybiByfShuZXcgVWludDhBcnJheShlLHQscikpfWNvbnN0IF89WzEsMSwxLDEsMiwyLDMsMF07Y29uc3QgeT17X2dldFRSU1coZSx0LHIscyl7cmV0dXJuIGUuYW5pbWF0aW9ucy5mb3JFYWNoKGU9Pntjb25zdCBuPWUuY2hhbm5lbHM7Zm9yKGxldCBpPTA7aTxuLmxlbmd0aDtpKyspe2NvbnN0IGE9bltpXTthLnRhcmdldC5ub2RlPT09ciYmKFwidHJhbnNsYXRpb25cIj09PWEudGFyZ2V0LnBhdGg/dC5UPXRoaXMuX2dldEFuaW1hdGVEYXRhKHQuVCxlLnNhbXBsZXJzW2Euc2FtcGxlcl0scywxKTpcInJvdGF0aW9uXCI9PT1hLnRhcmdldC5wYXRoP3QuUj10aGlzLl9nZXRRdWF0ZXJuaW9uKHQuUixlLnNhbXBsZXJzW2Euc2FtcGxlcl0scywxKTpcInNjYWxlXCI9PT1hLnRhcmdldC5wYXRoP3QuUz10aGlzLl9nZXRBbmltYXRlRGF0YSh0LlMsZS5zYW1wbGVyc1thLnNhbXBsZXJdLHMsMSk6XCJ3ZWlnaHRzXCI9PT1hLnRhcmdldC5wYXRoJiYodC5XPXRoaXMuX2dldEFuaW1hdGVEYXRhKHQuVyxlLnNhbXBsZXJzW2Euc2FtcGxlcl0scyx0LlcubGVuZ3RoKSkpfX0pLHR9LF9nZXRBbmltYXRlRGF0YShlLHQscixzKXtzd2l0Y2godC5pbnRlcnBvbGF0aW9uKXtjYXNlXCJMSU5FQVJcIjp7Y29uc3Qgbj10aGlzLl9nZXRQcmVOZXh0KHQsciwxKnMpO24mJihlPWZ1bmN0aW9uKGUsdCxyLHMpe3JldHVybiBlPWUubWFwKChlLG4pPT50W25dK3MqKHJbbl0tdFtuXSkpfShlLG4ucHJldmlvdXMsbi5uZXh0LG4uaW50ZXJwb2xhdGlvbi52YWx1ZSkpO2JyZWFrfWNhc2VcIlNURVBcIjp7Y29uc3Qgbj10aGlzLl9nZXRQcmVOZXh0KHQsciwxKnMpO24mJihlPW4ucHJldmlvdXMpO2JyZWFrfWNhc2VcIkNVQklDU1BMSU5FXCI6e2NvbnN0IG49dGhpcy5fZ2V0UHJlTmV4dCh0LHIsMypzKTtuJiYoZT10aGlzLl9nZXRDdWJpY1NwbGluZShuLmludGVycG9sYXRpb24sbi5wcmV2aW91cyxuLm5leHQsdC5pbnB1dC5hcnJheSwzKnMpKTticmVha319cmV0dXJuIGV9LF9nZXRRdWF0ZXJuaW9uKGUscixzKXtzd2l0Y2goci5pbnRlcnBvbGF0aW9uKXtjYXNlXCJMSU5FQVJcIjp7Y29uc3Qgbj10aGlzLl9nZXRQcmVOZXh0KHIscywxKTtuJiZ0LnNsZXJwKGUsbi5wcmV2aW91cyxuLm5leHQsbi5pbnRlcnBvbGF0aW9uLnZhbHVlKTticmVha31jYXNlXCJTVEVQXCI6e2NvbnN0IHQ9dGhpcy5fZ2V0UHJlTmV4dChyLHMsMSk7dCYmKGU9dC5wcmV2aW91cyk7YnJlYWt9Y2FzZVwiQ1VCSUNTUExJTkVcIjp7Y29uc3QgdD10aGlzLl9nZXRQcmVOZXh0KHIscywzKTt0JiYodC5wcmV2aW91cz10LnByZXZpb3VzLm1hcChlPT5NYXRoLmFjb3MoZSkpLHQubmV4dD10Lm5leHQubWFwKGU9Pk1hdGguYWNvcyhlKSksZT0oZT10aGlzLl9nZXRDdWJpY1NwbGluZSh0LmludGVycG9sYXRpb24sdC5wcmV2aW91cyx0Lm5leHQsci5pbnB1dC5hcnJheSwzKSkubWFwKGU9Pk1hdGguY29zKGUpKSk7YnJlYWt9fXJldHVybiBlfSxfZ2V0UHJlTmV4dChlLHQscil7Y29uc3Qgcz1lLmlucHV0LmFycmF5LG49ZS5vdXRwdXQuYXJyYXksaT1lLm91dHB1dC5pdGVtU2l6ZSxhPXRoaXMuX2dldEludGVycG9sYXRpb24ocyx0KTtyZXR1cm4gYT97cHJldmlvdXM6bi5zbGljZShhLnByZUluZGV4KmkqciwoYS5wcmVJbmRleCsxKSppKnIpLG5leHQ6bi5zbGljZShhLm5leHRJbmRleCppKnIsKGEubmV4dEluZGV4KzEpKmkqciksaW50ZXJwb2xhdGlvbjphfTpudWxsfSxfZ2V0SW50ZXJwb2xhdGlvbihlLHQpeyh0PGVbMF18fHQ+ZVtlLmxlbmd0aC0xXSkmJih0PU1hdGgubWF4KGVbMF0sTWF0aC5taW4oZVtlLmxlbmd0aC0xXSx0KSkpLHQ9PT1lW2UubGVuZ3RoLTFdJiYodD1lWzBdKTtmb3IobGV0IHI9MDtyPGUubGVuZ3RoLTE7cisrKWlmKHQ+PWVbcl0mJnQ8ZVtyKzFdKXtjb25zdCBzPWVbcl07cmV0dXJue3ByZUluZGV4OnIsbmV4dEluZGV4OnIrMSx2YWx1ZToodC1zKS8oZVtyKzFdLXMpfX1yZXR1cm4gbnVsbH0sX2dldEN1YmljU3BsaW5lKGUsdCxyLHMsbil7Y29uc3QgaT1lLnZhbHVlLGE9dC5zbGljZShuLDIqbiksbz10LnNsaWNlKDIqbiwzKm4pLHU9c1tlLnByZUluZGV4XSxoPXNbZS5uZXh0SW5kZXhdLGw9ci5zbGljZSgwLG4pLGY9ci5zbGljZSgzLDIqbiksYz1bXTtmb3IobGV0IGU9MDtlPDM7ZSsrKXtjb25zdCB0PWFbZV0scj0oaC11KSpvW2VdLHM9ZltlXSxuPShoLXUpKmxbZV0sZz0oMipNYXRoLnBvdyhpLDMpLTMqTWF0aC5wb3coaSwyKSsxKSp0KyhNYXRoLnBvdyhpLDMpLTIqTWF0aC5wb3coaSwyKStpKSpyKygyKi1NYXRoLnBvdyhpLDMpKzMqTWF0aC5wb3coaSwyKSkqcysoTWF0aC5wb3coaSwzKS1NYXRoLnBvdyhpLDIpKSpuO2MucHVzaChnKX1yZXR1cm4gY30sZ2V0QW5pbWF0aW9uQ2xpcChlLHQscyl7Y29uc3Qgbj1lLm5vZGVzW3RdLndlaWdodHN8fChlLm5vZGVzW3RdLm1lc2hlcz9lLm5vZGVzW3RdLm1lc2hlc1swXS53ZWlnaHRzOnZvaWQgMCksaT10aGlzLl9nZXRUUlNXKGUse1Q6WzAsMCwwXSxSOlswLDAsMCwxXSxTOlsxLDEsMV0sVzpufSx0LHMpO3JldHVybnt0cnM6ci5mcm9tUm90YXRpb25UcmFuc2xhdGlvblNjYWxlKFtdLGkuUixpLlQsaS5TKSx3ZWlnaHRzOmkuV319LGdldFRpbWVTcGFuKGUpe2lmKCFlLmFuaW1hdGlvbnMpcmV0dXJuIG51bGw7bGV0IHQ9LTEvMCxyPTEvMDtyZXR1cm4gZS5hbmltYXRpb25zLmZvckVhY2goZT0+e2NvbnN0IHM9ZS5jaGFubmVscztmb3IobGV0IG49MDtuPHMubGVuZ3RoO24rKyl7Y29uc3QgaT1zW25dLGE9ZS5zYW1wbGVyc1tpLnNhbXBsZXJdLmlucHV0LmFycmF5O2FbYS5sZW5ndGgtMV0+dCYmKHQ9YVthLmxlbmd0aC0xXSksYVswXTxyJiYocj1hWzBdKX19KSx7bWF4OnQsbWluOnJ9fX0sdz1cInVuZGVmaW5lZFwiPT10eXBlb2YgZG9jdW1lbnQ/bnVsbDpkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiY2FudmFzXCIpO2NsYXNzIFR7Y29uc3RydWN0b3IoZSx0LHIpe2lmKHRoaXMub3B0aW9ucz1yfHx7fSx0LmJ1ZmZlciBpbnN0YW5jZW9mIEFycmF5QnVmZmVyKXtjb25zdHtqc29uOnIsZ2xiQnVmZmVyOnN9PWIucmVhZCh0LmJ1ZmZlcix0LmJ5dGVPZmZzZXQpO3RoaXMuX2luaXQoZSxyLHMpfWVsc2UgdGhpcy5faW5pdChlLHQpfWxvYWQoKXtjb25zdCBlPXRoaXMuX2xvYWRTY2VuZSgpLHQ9dGhpcy5fbG9hZEFuaW1hdGlvbnMoKTtyZXR1cm4gbi5hbGwoW2UsdF0pLnRoZW4oZT0+KGVbMF0uYW5pbWF0aW9ucz1lWzFdLGVbMF0pKX1zdGF0aWMgZ2V0QW5pbWF0aW9uQ2xpcChlLHQscil7cmV0dXJuIHkuZ2V0QW5pbWF0aW9uQ2xpcChlLHQscil9c3RhdGljIGdldEFuaW1hdGlvblRpbWVTcGFuKGUpe3JldHVybiB5LmdldFRpbWVTcGFuKGUpfV9pbml0KGUsdCxyKXt0aGlzLmdsdGY9dCx0aGlzLnZlcnNpb249dC5hc3NldD8rdC5hc3NldC52ZXJzaW9uOjEsdGhpcy5yb290UGF0aD1lLHRoaXMuZ2xiQnVmZmVyPXIsdGhpcy5idWZmZXJzPXt9LHRoaXMucmVxdWVzdHM9e30sdGhpcy5hY2Nlc3Nvcj1uZXcgYyhlLHQsciksdGhpcy5vcHRpb25zLnJlcXVlc3RJbWFnZT10aGlzLm9wdGlvbnMucmVxdWVzdEltYWdlfHxJLDI9PT10aGlzLnZlcnNpb24/dGhpcy5hZGFwdGVyPW5ldyBnKGUsdCxyLHRoaXMub3B0aW9ucy5yZXF1ZXN0SW1hZ2UpOnRoaXMuYWRhcHRlcj1uZXcgbChlLHQpfV9wYXJzZU5vZGVzKGUsdCl7aWYoZS5jaGlsZHJlbiYmZS5jaGlsZHJlbi5sZW5ndGg+MCl7aWYoIXUoZS5jaGlsZHJlblswXSkmJihhKHI9ZS5jaGlsZHJlblswXSl8fFwic3RyaW5nXCIhPXR5cGVvZiByJiYobnVsbD09PXIuY29uc3RydWN0b3J8fHIuY29uc3RydWN0b3IhPT1TdHJpbmcpKSlyZXR1cm4gZTtjb25zdCBzPWUuY2hpbGRyZW4ubWFwKGU9Pntjb25zdCByPXRbZV07cmV0dXJuIHIubm9kZUluZGV4PWUsdGhpcy5fcGFyc2VOb2RlcyhyLHQpfSk7ZS5jaGlsZHJlbj1zfXZhciByO2lmKG8oZS5za2luKSl7Y29uc3Qgcj1lLnNraW4uam9pbnRzO2lmKHImJnIubGVuZ3RoJiZ1KHJbMF0pKXtjb25zdCByPWUuc2tpbi5qb2ludHMubWFwKGU9PnRbZV0pO2Uuc2tpbi5qb2ludHM9cn19cmV0dXJuIGV9X2xvYWRTY2VuZSgpe3JldHVybiB0aGlzLl9sb2FkTm9kZXMoKS50aGVuKGU9Pntjb25zdCB0PXRoaXMuc2NlbmVzPVtdO2xldCByO2Zvcihjb25zdCB0IGluIGUpZVt0XT10aGlzLl9wYXJzZU5vZGVzKGVbdF0sZSksZVt0XS5ub2RlSW5kZXg9TnVtYmVyKHQpP051bWJlcih0KTp0O3RoaXMuYWRhcHRlci5pdGVyYXRlKChzLG4saSk9Pntjb25zdCBhPXt9O24ubmFtZSYmKGEubmFtZT1uLm5hbWUpLG4ubm9kZXMmJihhLm5vZGVzPW4ubm9kZXMubWFwKHQ9PmVbdF0pKSx0aGlzLmdsdGYuc2NlbmU9PT1zJiYocj1pKSx0LnB1c2goYSl9LFwic2NlbmVzXCIpO2NvbnN0IHM9e3NjZW5lOnIsc2NlbmVzOnQsbm9kZXM6ZSxtZXNoZXM6dGhpcy5tZXNoZXMsc2tpbnM6dGhpcy5za2luc307cmV0dXJuIHRoaXMuZ2x0Zi5leHRlbnNpb25zJiYocy5leHRlbnNpb25zPXRoaXMuZ2x0Zi5leHRlbnNpb25zKSxzfSl9X2xvYWROb2Rlcygpe3JldHVybiB0aGlzLl9sb2FkTWVzaGVzKCkudGhlbigoKT0+e2NvbnN0IGU9dGhpcy5ub2Rlcz17fTtyZXR1cm4gdGhpcy5hZGFwdGVyLml0ZXJhdGUoKHQscik9Pntjb25zdCBzPXRoaXMuYWRhcHRlci5jcmVhdGVOb2RlKHIsdGhpcy5tZXNoZXMsdGhpcy5za2lucyk7ZVt0XT1zfSxcIm5vZGVzXCIpLGV9KX1fbG9hZFNraW5zKCl7dGhpcy5za2lucz17fTtjb25zdCBlPVtdO3JldHVybiB0aGlzLmFkYXB0ZXIuaXRlcmF0ZSgodCxyLHMpPT57ZS5wdXNoKHRoaXMuX2xvYWRTa2luKHIpLnRoZW4oZT0+e2UuaW5kZXg9cyx0aGlzLnNraW5zW3RdPWV9KSl9LFwic2tpbnNcIiksZX1fbG9hZFNraW4oZSl7Y29uc3QgdD1lLmludmVyc2VCaW5kTWF0cmljZXM7cmV0dXJuIHRoaXMuYWNjZXNzb3IuX3JlcXVlc3REYXRhKFwiaW52ZXJzZUJpbmRNYXRyaWNlc1wiLHQpLnRoZW4odD0+KGUuaW52ZXJzZUJpbmRNYXRyaWNlcz10LGUpKX1fbG9hZEFuaW1hdGlvbnMoKXtjb25zdCBlPXRoaXMuZ2x0Zi5hbmltYXRpb25zO3JldHVybiBvKGUpP3RoaXMuYWRhcHRlci5nZXRBbmltYXRpb25zKGUpOm51bGx9X2xvYWRNZXNoZXMoKXt0aGlzLm1lc2hlcz17fTtsZXQgZT1bXTtyZXR1cm4gdGhpcy5hZGFwdGVyLml0ZXJhdGUoKHQscixzKT0+e2UucHVzaCh0aGlzLl9sb2FkTWVzaChyKS50aGVuKGU9PntlLmluZGV4PXMsdGhpcy5tZXNoZXNbdF09ZX0pKX0sXCJtZXNoZXNcIiksZT1lLmNvbmNhdCh0aGlzLl9sb2FkU2tpbnMoKSksbi5hbGwoZSl9X2xvYWRNZXNoKGUpe2NvbnN0IHQ9ZS5wcmltaXRpdmVzLm1hcChlPT50aGlzLl9sb2FkUHJpbWl0aXZlKGUpKTtyZXR1cm4gbi5hbGwodCkudGhlbih0PT57Y29uc3Qgcj17fTtyZXR1cm4gaChyLGUpLHIucHJpbWl0aXZlcz10LHJ9KX1fbG9hZFByaW1pdGl2ZShlKXtjb25zdCB0PVtdLHI9ZS5hdHRyaWJ1dGVzLHM9dGhpcy5fbG9hZE1hdGVyaWFsKGUpO3MmJnQucHVzaChzKTtsZXQgaT1udWxsO2Zvcihjb25zdCBlIGluIHIpe2NvbnN0IHM9dGhpcy5hY2Nlc3Nvci5fcmVxdWVzdERhdGEoZSxyW2VdKTtzJiZ0LnB1c2gocyl9aWYobyhlLmluZGljZXMpKXtjb25zdCByPXRoaXMuYWNjZXNzb3IuX3JlcXVlc3REYXRhKFwiaW5kaWNlc1wiLGUuaW5kaWNlcyk7ciYmdC5wdXNoKHIpfWlmKG8oZS50YXJnZXRzKSlmb3IobGV0IHI9MDtyPGUudGFyZ2V0cy5sZW5ndGg7cisrKXtjb25zdCBzPWUudGFyZ2V0c1tyXTtmb3IoY29uc3QgZSBpbiBzKXtjb25zdCBuPXRoaXMuYWNjZXNzb3IuX3JlcXVlc3REYXRhKGAke2V9XyR7cn1gLHNbZV0pO24mJnQucHVzaChuKX19cmV0dXJuIG4uYWxsKHQpLnRoZW4odD0+e2xldCByO3RoaXMudHJhbnNmZXJhYmxlcz1bXTtjb25zdCBzPXthdHRyaWJ1dGVzOnQucmVkdWNlKChlLHQpPT4odC5tYXRlcmlhbD8oaT10Lm1hdGVyaWFsLHQudHJhbnNmZXJhYmxlcyYmdC50cmFuc2ZlcmFibGVzLmZvckVhY2goZT0+e3RoaXMudHJhbnNmZXJhYmxlcy5pbmRleE9mKGUpPDAmJnRoaXMudHJhbnNmZXJhYmxlcy5wdXNoKGUpfSkpOihcImluZGljZXNcIj09PXQubmFtZT9yPXQuYXJyYXk6ZVt0Lm5hbWVdPXthcnJheTp0LmFycmF5LGl0ZW1TaXplOnQuaXRlbVNpemUsYWNjZXNzb3JOYW1lOnQuYWNjZXNzb3JOYW1lfSx0aGlzLnRyYW5zZmVyYWJsZXMuaW5kZXhPZih0LmFycmF5LmJ1ZmZlcik8MCYmdGhpcy50cmFuc2ZlcmFibGVzLnB1c2godC5hcnJheS5idWZmZXIpKSxlKSx7fSksbWF0ZXJpYWw6aX07cmV0dXJuIHImJihzLmluZGljZXM9cikscy5tb2RlPW8oZS5tb2RlKT9lLm1vZGU6NCxvKGUuZXh0cmFzKSYmKHMuZXh0cmFzPWUuZXh0cmFzKSxzfSl9X2xvYWRNYXRlcmlhbChlKXtjb25zdCB0PWUubWF0ZXJpYWw7aWYoMj09PXRoaXMudmVyc2lvbil7aWYoIW8odCkpcmV0dXJuIG51bGw7cmV0dXJuIHRoaXMuYWRhcHRlci5nZXRNYXRlcmlhbCh0KX1jb25zdCByPXRoaXMuYWRhcHRlci5nZXRCYXNlQ29sb3JUZXh0dXJlKHQpO3JldHVybiByP3RoaXMuX2xvYWRJbWFnZShyLnNvdXJjZSkudGhlbihlPT57Y29uc3Qgcz1bZS5idWZmZXJdLG49ci5zb3VyY2U7ZS5pbmRleD1uLGgoci5zb3VyY2Usbiksci5zb3VyY2UuaW1hZ2U9ZTtjb25zdCBpPXtiYXNlQ29sb3JUZXh0dXJlOnJ9O3JldHVybiB0Lm5hbWUmJihpLm5hbWU9dC5uYW1lKSx0LmV4dGVuc2lvbnMmJihpLmV4dGVuc2lvbnM9dC5leHRlbnNpb25zKSxpLmV4dGVuc2lvbnMmJihkZWxldGUgaS5leHRlbnNpb25zLktIUl9iaW5hcnlfZ2xURixkZWxldGUgaS5leHRlbnNpb25zLmJpbmFyeV9nbFRGLDA9PT1PYmplY3Qua2V5cyhpLmV4dGVuc2lvbnMpLmxlbmd0aCYmZGVsZXRlIGkuZXh0ZW5zaW9ucyksdC5leHRyYXMmJihpLmV4dHJhcz10LmV4dHJhcykse21hdGVyaWFsOmksdHJhbnNmZXJhYmxlczpzfX0pOm51bGx9X2xvYWRJbWFnZShlKXtpZihlLmJ1ZmZlclZpZXd8fGUuZXh0ZW5zaW9ucyYmKGUuZXh0ZW5zaW9ucy5LSFJfYmluYXJ5X2dsVEZ8fGUuZXh0ZW5zaW9ucy5iaW5hcnlfZ2xURikpe2NvbnN0IHQ9ZS5idWZmZXJWaWV3P2U6ZS5leHRlbnNpb25zLktIUl9iaW5hcnlfZ2xURnx8ZS5leHRlbnNpb25zLmJpbmFyeV9nbFRGO2lmKGUuZXh0ZW5zaW9ucyYmKGUubWltZVR5cGU9dC5taW1lVHlwZSxlLndpZHRoPXQud2lkdGgsZS5oZWlnaHQ9dC5oZWlnaHQpLHRoaXMuYnVmZmVyc1t0LmJ1ZmZlclZpZXddKXJldHVybiBuLnJlc29sdmUodGhpcy5idWZmZXJzW3QuYnVmZmVyVmlld10pO2NvbnN0IHI9dGhpcy5nbHRmLmJ1ZmZlclZpZXdzW3QuYnVmZmVyVmlld10scz0oci5ieXRlT2Zmc2V0fHwwKSt0aGlzLmdsYkJ1ZmZlci5ieXRlT2Zmc2V0LGk9ci5ieXRlTGVuZ3RoLGE9dGhpcy5idWZmZXJzW3QuYnVmZmVyVmlld109bmV3IFVpbnQ4QXJyYXkodGhpcy5nbGJCdWZmZXIuYnVmZmVyLHMsaSk7cmV0dXJuIG4ucmVzb2x2ZShhKX17Y29uc3QgdD1lLnVyaSxyPXRoaXMucm9vdFBhdGgrXCIvXCIrdDtyZXR1cm4gdGhpcy5yZXF1ZXN0c1tyXT90aGlzLnJlcXVlc3RzW3JdLnRoZW4oKCk9PnRoaXMuYnVmZmVyc1tyXSk6dGhpcy5yZXF1ZXN0c1tyXT1pLmdldEFycmF5QnVmZmVyKHIsbnVsbCkudGhlbihlPT57Y29uc3QgdD1lLmRhdGE7cmV0dXJuIHRoaXMuYnVmZmVyc1tyXT10LG5ldyBVaW50OEFycmF5KHQpfSl9fX1mdW5jdGlvbiBJKGUsdCl7Y29uc3Qgcj1uZXcgSW1hZ2U7ci5vbmxvYWQ9KCgpPT57aWYoIXcpcmV0dXJuIHZvaWQgdChuZXcgRXJyb3IoXCJUaGVyZSBpcyBubyBjYW52YXMgdG8gZHJhdyBpbWFnZSFcIikpO3cud2lkdGg9ci53aWR0aCx3LmhlaWdodD1yLmhlaWdodDtjb25zdCBlPXcuZ2V0Q29udGV4dChcIjJkXCIpO2UuZHJhd0ltYWdlKHIsMCwwLHIud2lkdGgsci5oZWlnaHQpO2NvbnN0IHM9ZS5nZXRJbWFnZURhdGEoMCwwLHIud2lkdGgsci5oZWlnaHQpLG49e3dpZHRoOnIud2lkdGgsaGVpZ2h0OnIuaGVpZ2h0LGRhdGE6bmV3IFVpbnQ4QXJyYXkocy5kYXRhKX07dChudWxsLG4pfSksci5vbmVycm9yPWZ1bmN0aW9uKGUpe3QoZSl9LHIuc3JjPWV9ZXhwb3J0e1QgYXMgR0xURkxvYWRlcixpIGFzIEFqYXh9O1xuIiwiLyohXHJcbiogQ29udGFpbnMgY29kZSBmcm9tIFRIUkVFLmpzXHJcbiogTUlUIExpY2Vuc2VcclxuKiBodHRwczovL2dpdGh1Yi5jb20vbXJkb29iL3RocmVlLmpzXHJcbiovXHJcblxyXG52YXIgcGxhbmVzID0gW107XHJcbmZvciAodmFyIGkgPSAwOyBpIDwgNjsgaSsrKSB7XHJcbiAgICBwbGFuZXNbaV0gPSBbXTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGludGVyc2VjdHNTcGhlcmUobWF0cml4LCBzcGhlcmUsIG1hc2spIHtcclxuICAgIHNldFBsYW5lcyhtYXRyaXgpO1xyXG4gICAgdmFyIGNlbnRlciA9IHNwaGVyZVswXTtcclxuICAgIHZhciBuZWdSYWRpdXMgPSAtc3BoZXJlWzFdO1xyXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCA2OyBpKyspIHtcclxuICAgICAgICBpZiAobWFzayAmJiBtYXNrLmNoYXJBdChpKSA9PT0gJzAnKSB7XHJcbiAgICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgIH1cclxuICAgICAgICB2YXIgZGlzdGFuY2UgPSBkaXN0YW5jZVRvUG9pbnQocGxhbmVzW2ldLCBjZW50ZXIpO1xyXG4gICAgICAgIGlmIChkaXN0YW5jZSA8IG5lZ1JhZGl1cykge1xyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIHRydWU7XHJcbn1cclxuXHJcbnZhciBwID0gW107XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gaW50ZXJzZWN0c0JveChtYXRyaXgsIGJveCwgbWFzaykge1xyXG4gICAgc2V0UGxhbmVzKG1hdHJpeCk7XHJcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IDY7IGkrKykge1xyXG4gICAgICAgIGlmIChtYXNrICYmIG1hc2suY2hhckF0KGkpID09PSAnMCcpIHtcclxuICAgICAgICAgICAgY29udGludWU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHZhciBwbGFuZSA9IHBsYW5lc1tpXTtcclxuICAgICAgICAvLyBjb3JuZXIgYXQgbWF4IGRpc3RhbmNlXHJcbiAgICAgICAgcFswXSA9IHBsYW5lWzBdID4gMCA/IGJveFsxXVswXSA6IGJveFswXVswXTtcclxuICAgICAgICBwWzFdID0gcGxhbmVbMV0gPiAwID8gYm94WzFdWzFdIDogYm94WzBdWzFdO1xyXG4gICAgICAgIHBbMl0gPSBwbGFuZVsyXSA+IDAgPyBib3hbMV1bMl0gOiBib3hbMF1bMl07XHJcblxyXG4gICAgICAgIGlmIChkaXN0YW5jZVRvUG9pbnQocGxhbmUsIHApIDwgMCkge1xyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiB0cnVlO1xyXG59XHJcblxyXG5mdW5jdGlvbiBzZXRQbGFuZXMobSkge1xyXG4gICAgdmFyIG1lID0gbTtcclxuICAgIHZhciBtZTAgPSBtZVswXSwgbWUxID0gbWVbMV0sIG1lMiA9IG1lWzJdLCBtZTMgPSBtZVszXTtcclxuICAgIHZhciBtZTQgPSBtZVs0XSwgbWU1ID0gbWVbNV0sIG1lNiA9IG1lWzZdLCBtZTcgPSBtZVs3XTtcclxuICAgIHZhciBtZTggPSBtZVs4XSwgbWU5ID0gbWVbOV0sIG1lMTAgPSBtZVsxMF0sIG1lMTEgPSBtZVsxMV07XHJcbiAgICB2YXIgbWUxMiA9IG1lWzEyXSwgbWUxMyA9IG1lWzEzXSwgbWUxNCA9IG1lWzE0XSwgbWUxNSA9IG1lWzE1XTtcclxuXHJcbiAgICAvL3JpZ2h0XHJcbiAgICBzZXRDb21wb25lbnRzKHBsYW5lc1swXSwgbWUzIC0gbWUwLCBtZTcgLSBtZTQsIG1lMTEgLSBtZTgsIG1lMTUgLSBtZTEyKTtcclxuICAgIC8vbGVmdFxyXG4gICAgc2V0Q29tcG9uZW50cyhwbGFuZXNbMV0sIG1lMyArIG1lMCwgbWU3ICsgbWU0LCBtZTExICsgbWU4LCBtZTE1ICsgbWUxMik7XHJcbiAgICAvL2JvdHRvbVxyXG4gICAgc2V0Q29tcG9uZW50cyhwbGFuZXNbMl0sIG1lMyArIG1lMSwgbWU3ICsgbWU1LCBtZTExICsgbWU5LCBtZTE1ICsgbWUxMyk7XHJcbiAgICAvL3RvcFxyXG4gICAgc2V0Q29tcG9uZW50cyhwbGFuZXNbM10sIG1lMyAtIG1lMSwgbWU3IC0gbWU1LCBtZTExIC0gbWU5LCBtZTE1IC0gbWUxMyk7XHJcbiAgICAvL3otZmFyXHJcbiAgICBzZXRDb21wb25lbnRzKHBsYW5lc1s0XSwgbWUzIC0gbWUyLCBtZTcgLSBtZTYsIG1lMTEgLSBtZTEwLCBtZTE1IC0gbWUxNCk7XHJcbiAgICAvL3otbmVhclxyXG4gICAgc2V0Q29tcG9uZW50cyhwbGFuZXNbNV0sIG1lMyArIG1lMiwgbWU3ICsgbWU2LCBtZTExICsgbWUxMCwgbWUxNSArIG1lMTQpO1xyXG59XHJcblxyXG52YXIgbm9ybWFsTGVuZ3RoID0gMS4wIC8gNjtcclxuZnVuY3Rpb24gc2V0Q29tcG9uZW50cyhvdXQsIHgsIHksIHosIHcpIHtcclxuICAgIG91dFswXSA9IHggKiBub3JtYWxMZW5ndGg7XHJcbiAgICBvdXRbMV0gPSB5ICogbm9ybWFsTGVuZ3RoO1xyXG4gICAgb3V0WzJdID0geiAqIG5vcm1hbExlbmd0aDtcclxuICAgIG91dFszXSA9IHcgKiBub3JtYWxMZW5ndGg7XHJcbiAgICByZXR1cm4gb3V0O1xyXG59XHJcblxyXG5mdW5jdGlvbiBkaXN0YW5jZVRvUG9pbnQocGxhbmUsIHApIHtcclxuICAgIHJldHVybiBwbGFuZVswXSAqIHBbMF0gKyBwbGFuZVsxXSAqIHBbMV0gKyBwbGFuZVsyXSAqIHBbMl0gKyBwbGFuZVszXTtcclxufVxyXG4iLCJjb25zdCBTSEFERVJfTUFQID0ge307XHJcblxyXG5leHBvcnQgZGVmYXVsdCBTSEFERVJfTUFQO1xyXG4iLCJpbXBvcnQgeyBtYXQ0IH0gZnJvbSAnQG1hcHRhbGtzL2dsJztcclxuXHJcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFNraW4ge1xyXG4gICAgY29uc3RydWN0b3Ioam9pbnRzLCBpbnZlcnNlQmluZE1hdHJpeERhdGEsIGpvaW50VGV4dHVyZSkge1xyXG4gICAgICAgIHRoaXMuam9pbnRzID0gam9pbnRzO1xyXG4gICAgICAgIHRoaXMuaW52ZXJzZUJpbmRNYXRyaWNlcyA9IFtdO1xyXG4gICAgICAgIHRoaXMuam9pbnRNYXRyaWNlcyA9IFtdO1xyXG4gICAgICAgIHRoaXMuam9pbnREYXRhID0gbmV3IEZsb2F0MzJBcnJheShqb2ludHMubGVuZ3RoICogMTYpO1xyXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgam9pbnRzLmxlbmd0aDsgKytpKSB7XHJcbiAgICAgICAgICAgIHRoaXMuaW52ZXJzZUJpbmRNYXRyaWNlcy5wdXNoKG5ldyBGbG9hdDMyQXJyYXkoXHJcbiAgICAgICAgICAgICAgICBpbnZlcnNlQmluZE1hdHJpeERhdGEuYnVmZmVyLFxyXG4gICAgICAgICAgICAgICAgaW52ZXJzZUJpbmRNYXRyaXhEYXRhLmJ5dGVPZmZzZXQgKyBGbG9hdDMyQXJyYXkuQllURVNfUEVSX0VMRU1FTlQgKiAxNiAqIGksXHJcbiAgICAgICAgICAgICAgICAxNikpO1xyXG4gICAgICAgICAgICB0aGlzLmpvaW50TWF0cmljZXMucHVzaChuZXcgRmxvYXQzMkFycmF5KFxyXG4gICAgICAgICAgICAgICAgdGhpcy5qb2ludERhdGEuYnVmZmVyLFxyXG4gICAgICAgICAgICAgICAgRmxvYXQzMkFycmF5LkJZVEVTX1BFUl9FTEVNRU5UICogMTYgKiBpLFxyXG4gICAgICAgICAgICAgICAgMTYpKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5qb2ludFRleHR1cmUgPSBqb2ludFRleHR1cmU7XHJcbiAgICAgICAgdGhpcy5qb2ludFRleHR1cmVTaXplID0gWzQsIDZdO1xyXG4gICAgfVxyXG5cclxuICAgIHVwZGF0ZShub2RlTWF0cml4KSB7XHJcbiAgICAgICAgY29uc3QgZ2xvYmFsV29ybGRJbnZlcnNlID0gW107XHJcbiAgICAgICAgbWF0NC5pbnZlcnQoZ2xvYmFsV29ybGRJbnZlcnNlLCBub2RlTWF0cml4KTtcclxuICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IHRoaXMuam9pbnRzLmxlbmd0aDsgKytqKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGpvaW50ID0gdGhpcy5qb2ludHNbal07XHJcbiAgICAgICAgICAgIGNvbnN0IGRzdCA9IHRoaXMuam9pbnRNYXRyaWNlc1tqXTtcclxuICAgICAgICAgICAgbWF0NC5tdWx0aXBseShkc3QsIGdsb2JhbFdvcmxkSW52ZXJzZSwgam9pbnQubm9kZU1hdHJpeCk7XHJcbiAgICAgICAgICAgIG1hdDQubXVsdGlwbHkoZHN0LCBkc3QsIHRoaXMuaW52ZXJzZUJpbmRNYXRyaWNlc1tqXSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMuam9pbnRUZXh0dXJlKHtcclxuICAgICAgICAgICAgd2lkdGggOiA0LFxyXG4gICAgICAgICAgICB0eXBlIDogJ2Zsb2F0JyxcclxuICAgICAgICAgICAgaGVpZ2h0IDogdGhpcy5qb2ludHMubGVuZ3RoLFxyXG4gICAgICAgICAgICBkYXRhIDogdGhpcy5qb2ludERhdGFcclxuICAgICAgICB9KTtcclxuICAgIH1cclxufVxyXG4iLCJpbXBvcnQgeyBtYXQ0IH0gZnJvbSAnQG1hcHRhbGtzL2dsJztcclxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgVFJTIHtcclxuICAgIGNvbnN0cnVjdG9yKHRyYW5zbGF0aW9uID0gWzAsIDAsIDBdLCByb3RhdGlvbiA9IFswLCAwLCAwLCAxXSwgc2NhbGUgPSBbMSwgMSwgMV0pIHtcclxuICAgICAgICB0aGlzLnRyYW5zbGF0aW9uID0gdHJhbnNsYXRpb247XHJcbiAgICAgICAgdGhpcy5yb3RhdGlvbiA9IHJvdGF0aW9uO1xyXG4gICAgICAgIHRoaXMuc2NhbGUgPSBzY2FsZTtcclxuICAgIH1cclxuICAgIHNldE1hdHJpeChkc3QpIHtcclxuICAgICAgICBkc3QgPSBkc3QgfHwgbmV3IEZsb2F0MzJBcnJheSgxNik7XHJcbiAgICAgICAgbWF0NC5mcm9tUm90YXRpb25UcmFuc2xhdGlvblNjYWxlKGRzdCwgdGhpcy5yb3RhdGlvbiwgdGhpcy50cmFuc2xhdGlvbiwgdGhpcy5zY2FsZSk7XHJcbiAgICAgICAgcmV0dXJuIGRzdDtcclxuICAgIH1cclxufVxyXG4iLCLvu79pbXBvcnQgKiBhcyBtYXB0YWxrcyBmcm9tICdtYXB0YWxrcyc7XHJcbmltcG9ydCB7IGRlZmluZWQsIGlzRW1wdHlPYmplY3QsIGRlY29tcG9zZSB9IGZyb20gJy4vY29tbW9uL1V0aWwnO1xyXG5pbXBvcnQgeyBjcmVhdGVSRUdMLCBtYXQ0LCB2ZWM0LCByZXNoYWRlciB9IGZyb20gJ0BtYXB0YWxrcy9nbCc7XHJcbmltcG9ydCAqIGFzIGdsdGYgZnJvbSAnQG1hcHRhbGtzL2dsdGYtbG9hZGVyJztcclxuaW1wb3J0IHsgaW50ZXJzZWN0c0JveCB9IGZyb20gJ2ZydXN0dW0taW50ZXJzZWN0cyc7XHJcbmltcG9ydCBTSEFERVJfTUFQIGZyb20gJy4vY29tbW9uL1NoYWRlck1hcCc7XHJcbmltcG9ydCBTa2luIGZyb20gJy4vTm9kZS9Ta2luJztcclxuaW1wb3J0IFRSUyBmcm9tICcuL05vZGUvVFJTJztcclxuXHJcbmxldCBBTklNQVRJT05fVElNRSA9IDAuMDtcclxuY29uc3QgcGlja2luZ1ZlcnQgPSBgXHJcbiAgICAgICAgYXR0cmlidXRlIHZlYzMgUE9TSVRJT047XHJcbiAgICAgICAgdW5pZm9ybSBtYXQ0IHByb2pWaWV3TWF0cml4O1xyXG4gICAgICAgIHVuaWZvcm0gbWF0NCBtb2RlbE1hdHJpeDtcclxuXHJcbiAgICAgICAgI2lmZGVmIFVTRV9JTlNUQU5DRVxyXG4gICAgICAgICNpbmNsdWRlIDxpbnN0YW5jZV92ZXJ0PlxyXG4gICAgICAgICNlbmRpZlxyXG4gICAgICAgIC8v5byV5YWlZmJvIHBpY2tpbmfnmoR2ZXJ055u45YWz5Ye95pWwXHJcbiAgICAgICAgI2luY2x1ZGUgPGZib19waWNraW5nX3ZlcnQ+XHJcblxyXG4gICAgICAgIHZvaWQgbWFpbigpXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgICAjaWZkZWYgVVNFX0lOU1RBTkNFXHJcbiAgICAgICAgICAgICAgICBnbF9Qb3NpdGlvbiA9IGluc3RhbmNlX2RyYXdJbnN0YW5jZShQT1NJVElPTiwgcHJvalZpZXdNYXRyaXgpO1xyXG4gICAgICAgICAgICAjZWxzZVxyXG4gICAgICAgICAgICAgICAgbWF0NCBwcm9qVmlld01vZGVsTWF0cml4ID0gcHJvalZpZXdNYXRyaXggKiBtb2RlbE1hdHJpeDtcclxuICAgICAgICAgICAgICAgIGdsX1Bvc2l0aW9uID0gcHJvalZpZXdNb2RlbE1hdHJpeCAqIHZlYzQoUE9TSVRJT04sIDEuMCk7XHJcbiAgICAgICAgICAgICNlbmRpZlxyXG4gICAgICAgICAgICAvL+S8oOWFpWdsX1Bvc2l0aW9u55qEZGVwdGjlgLxcclxuICAgICAgICAgICAgZmJvX3BpY2tpbmdfc2V0RGF0YShnbF9Qb3NpdGlvbi53LCB0cnVlKTtcclxuICAgICAgICB9YDtcclxuY29uc3QgbW9ycGhWUyA9IGBcclxuYXR0cmlidXRlIHZlYzMgUE9TSVRJT047XHJcbiAgICAgICAgYXR0cmlidXRlIHZlYzMgUE9TSVRJT05fMDtcclxuICAgICAgICBhdHRyaWJ1dGUgdmVjMyBQT1NJVElPTl8xO1xyXG4gICAgICAgIC8vIGF0dHJpYnV0ZSB2ZWMzIE5PUk1BTDtcclxuICAgICAgICAjaWZkZWYgVVNFX0JBU0VDT0xPUlRFWFRVUkVcclxuICAgICAgICAgICAgYXR0cmlidXRlIHZlYzIgVEVYQ09PUkRfMDtcclxuICAgICAgICAgICAgdmFyeWluZyB2ZWMyIHZUZXhDb29yZHM7XHJcbiAgICAgICAgI2VuZGlmXHJcbiAgICAgICAgdW5pZm9ybSBtYXQ0IHByb2pWaWV3TWF0cml4O1xyXG4gICAgICAgIC8vIHVuaWZvcm0gbWF0NCBub3JtYWxNYXRyaXg7XHJcbiAgICAgICAgdW5pZm9ybSBtYXQ0IG1vZGVsTWF0cml4O1xyXG4gICAgICAgIHVuaWZvcm0gdmVjMiB3ZWlnaHRzO1xyXG4gICAgICAgIHZhcnlpbmcgdmVjNCB2RnJhZ1BvcztcclxuICAgICAgICAvLyB2YXJ5aW5nIHZlYzMgdk5vcm1hbDtcclxuXHJcbiAgICAgICAgdm9pZCBtYWluKCkge1xyXG4gICAgICAgICAgICBnbF9Qb3NpdGlvbiA9IHByb2pWaWV3TWF0cml4ICogbW9kZWxNYXRyaXggKiB2ZWM0KFBPU0lUSU9OICsgd2VpZ2h0cy54ICogUE9TSVRJT05fMCArIHdlaWdodHMueSAqIFBPU0lUSU9OXzEsIDEuMCk7XHJcbiAgICAgICAgICAgIHZGcmFnUG9zID0gbW9kZWxNYXRyaXggKiB2ZWM0KFBPU0lUSU9OLCAxLjApO1xyXG4gICAgICAgICAgICAvLyB2Tm9ybWFsID0gbm9ybWFsaXplKHZlYzMobm9ybWFsTWF0cml4ICogdmVjNChOT1JNQUwsIDEuMCkpKTtcclxuICAgICAgICAgICAgI2lmZGVmIFVTRV9CQVNFQ09MT1JURVhUVVJFXHJcbiAgICAgICAgICAgICAgICB2VGV4Q29vcmRzID0gVEVYQ09PUkRfMDtcclxuICAgICAgICAgICAgI2VuZGlmXHJcbiAgICAgICAgfVxyXG5gO1xyXG5jb25zdCBtb3JwaEZTID0gYFxyXG52b2lkIG1haW4oKSB7XHJcbiAgICBnbF9GcmFnQ29sb3IgPSB2ZWM0KDEuMCwgMC4wLCAwLjAsIDEuMCk7XHJcbn1cclxuYDtcclxuXHJcbmNvbnN0IFYwID0gW10sIFYxID0gW107XHJcbmNvbnN0IE1PREVTID0gWydwb2ludHMnLCAnbGluZXMnLCAnbGluZSBzdHJpcCcsICdsaW5lIGxvb3AnLCAndHJpYW5nbGVzJywgJ3RyaWFuZ2xlIHN0cmlwJywgJ3RyaWFuZ2xlIGZhbiddO1xyXG4vL+WwhkdMVEbop4TojIPph4zpnaLnmoRzYW1wbGVy5pWw56CB5pig5bCE5YiwcmVnbOaOpeWPo+eahHNhbXBsZXJcclxuY29uc3QgVEVYVFVSRV9TQU1QTEVSID0ge1xyXG4gICAgJzk3MjgnOiAnbmVhcmVzdCcsXHJcbiAgICAnOTcyOSc6ICdsaW5lYXInLFxyXG4gICAgJzk5ODQnOiAnbmVhcmVzdCBtaXBtYXAgbmVhcmVzdCcsXHJcbiAgICAnOTk4NSc6ICdsaW5lYXIgbWlwbWFwIG5lYXJlc3QnLFxyXG4gICAgJzk5ODYnOiAnbmVhcmVzdCBtaXBtYXAgbGluZWFyJyxcclxuICAgICc5OTg3JzogJ2xpbmVhciBtaXBtYXAgbGluZWFyJyxcclxuICAgICczMzA3MSc6ICdjbGFtcCBybyBlZGdlJyxcclxuICAgICczMzY4NCc6ICdtaXJyb3JlZCByZXBlYXQnLFxyXG4gICAgJzEwNDk3JzogJ3JlcGVhdCdcclxufTtcclxuXHJcbmNvbnN0IFBSRUZJTFRFUl9DVUJFX1NJWkUgPSA1MTI7XHJcblxyXG5jbGFzcyBHTFRGTGF5ZXJSZW5kZXJlciBleHRlbmRzIG1hcHRhbGtzLnJlbmRlcmVyLkNhbnZhc1JlbmRlcmVyIHtcclxuXHJcbiAgICBjb25zdHJ1Y3RvcihsYXllcikge1xyXG4gICAgICAgIHN1cGVyKGxheWVyKTtcclxuICAgICAgICB0aGlzLmdsdGZTY2VuZXMgPSB7fTtcclxuICAgICAgICB0aGlzLl9nZW9tZXRyaWVzID0ge307XHJcbiAgICAgICAgdGhpcy5fc2hhZGVyTGlzdCA9IHt9O1xyXG4gICAgICAgIHRoaXMuc2lnbiA9IDEuMDtcclxuICAgICAgICB0aGlzLl9pbml0U2hhZGVyKCk7XHJcbiAgICB9XHJcblxyXG4gICAgZHJhdyh0aW1lc3RhbXApIHtcclxuICAgICAgICBBTklNQVRJT05fVElNRSA9IHRpbWVzdGFtcDtcclxuICAgICAgICB0aGlzLnByZXBhcmVDYW52YXMoKTtcclxuICAgICAgICB0aGlzLl9yZW5kZXJTY2VuZSgpO1xyXG4gICAgfVxyXG5cclxuICAgIGRyYXdPbkludGVyYWN0aW5nKGUsIHRpbWVzdGFtcCkge1xyXG4gICAgICAgIEFOSU1BVElPTl9USU1FID0gdGltZXN0YW1wO1xyXG4gICAgICAgIHRoaXMuX3JlbmRlclNjZW5lKCk7XHJcbiAgICB9XHJcblxyXG4gICAgbmVlZFRvUmVkcmF3KCkge1xyXG4gICAgICAgIGZvciAoY29uc3QgdWlkIGluIHRoaXMubGF5ZXIuX21hcmtlck1hcCkge1xyXG4gICAgICAgICAgICBjb25zdCBtYXJrZXIgPSB0aGlzLmxheWVyLl9tYXJrZXJNYXBbdWlkXTtcclxuICAgICAgICAgICAgaWYgKG1hcmtlci5pc0RpcnR5KCkpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBzdXBlci5uZWVkVG9SZWRyYXcoKTtcclxuICAgIH1cclxuXHJcbiAgICBoaXREZXRlY3QoKSB7XHJcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfVxyXG5cclxuICAgIGNyZWF0ZUNvbnRleHQoKSB7XHJcbiAgICAgICAgaWYgKHRoaXMuY2FudmFzLmdsICYmIHRoaXMuY2FudmFzLmdsLndyYXApIHtcclxuICAgICAgICAgICAgdGhpcy5nbCA9IHRoaXMuY2FudmFzLmdsLndyYXAoKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBjb25zdCBsYXllciA9IHRoaXMubGF5ZXI7XHJcbiAgICAgICAgICAgIGNvbnN0IGF0dHJpYnV0ZXMgPSBsYXllci5vcHRpb25zLmdsT3B0aW9ucyB8fCB7XHJcbiAgICAgICAgICAgICAgICBhbHBoYTogdHJ1ZSxcclxuICAgICAgICAgICAgICAgIGRlcHRoOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgLy9hbnRpYWxpYXM6IHRydWUsXHJcbiAgICAgICAgICAgICAgICBzdGVuY2lsOiB0cnVlXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIHRoaXMuZ2xPcHRpb25zID0gYXR0cmlidXRlcztcclxuICAgICAgICAgICAgdGhpcy5nbCA9IHRoaXMuZ2wgfHwgdGhpcy5fY3JlYXRlR0xDb250ZXh0KHRoaXMuY2FudmFzLCBhdHRyaWJ1dGVzKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5yZWdsID0gY3JlYXRlUkVHTCh7XHJcbiAgICAgICAgICAgIGdsOiB0aGlzLmdsLFxyXG4gICAgICAgICAgICBleHRlbnNpb25zOiBbXHJcbiAgICAgICAgICAgICAgICAnQU5HTEVfaW5zdGFuY2VkX2FycmF5cycsXHJcbiAgICAgICAgICAgICAgICAnT0VTX3RleHR1cmVfZmxvYXQnLFxyXG4gICAgICAgICAgICAgICAgLy8gJ09FU190ZXh0dXJlX2Zsb2F0X2xpbmVhcicsXHJcbiAgICAgICAgICAgICAgICAnT0VTX2VsZW1lbnRfaW5kZXhfdWludCcsXHJcbiAgICAgICAgICAgICAgICAnT0VTX3N0YW5kYXJkX2Rlcml2YXRpdmVzJyxcclxuICAgICAgICAgICAgICAgICdFWFRfc2hhZGVyX3RleHR1cmVfbG9kJ1xyXG4gICAgICAgICAgICBdLFxyXG4gICAgICAgICAgICBvcHRpb25hbEV4dGVuc2lvbnM6IHRoaXMubGF5ZXIub3B0aW9uc1snZ2xFeHRlbnNpb25zJ10gfHwgW11cclxuICAgICAgICB9KTtcclxuICAgICAgICB0aGlzLl9pbml0UmVuZGVyZXIoKTtcclxuICAgICAgICB0aGlzLmxheWVyLmZpcmUoJ2NvbnRleHRjcmVhdGUnLCB7IGNvbnRleHQ6IHRoaXMuZ2wgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgX2luaXRSZW5kZXJlcigpIHtcclxuICAgICAgICBjb25zdCBtYXAgPSB0aGlzLmxheWVyLmdldE1hcCgpO1xyXG4gICAgICAgIGNvbnN0IHJlbmRlcmVyID0gbmV3IHJlc2hhZGVyLlJlbmRlcmVyKHRoaXMucmVnbCk7XHJcbiAgICAgICAgdGhpcy5yZW5kZXJlciA9IHJlbmRlcmVyO1xyXG4gICAgICAgIHRoaXMuX3VuaWZvcm1zID0ge1xyXG4gICAgICAgICAgICAncHJvak1hdHJpeCc6IG1hcC5wcm9qTWF0cml4LFxyXG4gICAgICAgICAgICAncHJvalZpZXdNYXRyaXgnOiBtYXAucHJvalZpZXdNYXRyaXgsXHJcbiAgICAgICAgICAgICd2aWV3TWF0cml4JzogbWFwLnZpZXdNYXRyaXgsXHJcbiAgICAgICAgICAgICd2aWV3UG9zJzogbWFwLmNhbWVyYVBvc2l0aW9uLFxyXG4gICAgICAgIH07XHJcbiAgICAgICAgdGhpcy5waWNraW5nRkJPID0gdGhpcy5yZWdsLmZyYW1lYnVmZmVyKG1hcC53aWR0aCwgbWFwLmhlaWdodCk7XHJcbiAgICAgICAgdGhpcy5fcGlja2luZyA9IG5ldyByZXNoYWRlci5GQk9SYXlQaWNraW5nKFxyXG4gICAgICAgICAgICByZW5kZXJlcixcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgdmVydDogcGlja2luZ1ZlcnQsXHJcbiAgICAgICAgICAgICAgICB1bmlmb3JtczogW1xyXG4gICAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogJ3Byb2pWaWV3TW9kZWxNYXRyaXgnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnZnVuY3Rpb24nLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBmbjogZnVuY3Rpb24gKGNvbnRleHQsIHByb3BzKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gbWF0NC5tdWx0aXBseShbXSwgcHJvcHNbJ3Byb2pWaWV3TWF0cml4J10sIHByb3BzWydtb2RlbE1hdHJpeCddKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgJ3Byb2pWaWV3TWF0cml4JyxcclxuICAgICAgICAgICAgICAgICAgICAndVBpY2tpbmdJZCdcclxuICAgICAgICAgICAgICAgIF0sXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHRoaXMucGlja2luZ0ZCT1xyXG4gICAgICAgICk7XHJcbiAgICB9XHJcblxyXG4gICAgX2luaXRTaGFkZXIoKSB7XHJcbiAgICAgICAgLy/pgY3ljoZzaGFkZXLnm67lvZXvvIzkuLvopoHljIXlkKvpu5jorqRzaGFkZXLlkozpooTlhYjms6jlhoznmoRzaGFkZXJcclxuICAgICAgICBjb25zdCBzaGFkZXJNYXAgPSBTSEFERVJfTUFQO1xyXG4gICAgICAgIGZvciAoY29uc3QgbmFtZSBpbiBzaGFkZXJNYXApIHtcclxuICAgICAgICAgICAgY29uc3Qgc2hhZGVyID0gc2hhZGVyTWFwW25hbWVdO1xyXG4gICAgICAgICAgICB0aGlzLl9yZWdpc3RlclNoYWRlcihzaGFkZXIubmFtZSwgc2hhZGVyLnR5cGUsIHNoYWRlci5jb25maWcsIHNoYWRlci51bmlmb3Jtcyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGNvbnN0IHZpZXdwb3J0ID0ge1xyXG4gICAgICAgICAgICB4OiAwLFxyXG4gICAgICAgICAgICB5OiAwLFxyXG4gICAgICAgICAgICB3aWR0aDogKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuY2FudmFzID8gdGhpcy5jYW52YXMud2lkdGggOiAxO1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBoZWlnaHQ6ICgpID0+IHtcclxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmNhbnZhcyA/IHRoaXMuY2FudmFzLmhlaWdodCA6IDE7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9O1xyXG4gICAgICAgIHRoaXMuX21vcnBoU2hhZGVyID0gbmV3IHJlc2hhZGVyLk1lc2hTaGFkZXIoe1xyXG4gICAgICAgICAgICB2ZXJ0IDogbW9ycGhWUyxcclxuICAgICAgICAgICAgZnJhZyA6IG1vcnBoRlMsXHJcbiAgICAgICAgICAgIHVuaWZvcm1zIDogW1xyXG4gICAgICAgICAgICAgICAgJ3Byb2pWaWV3TWF0cml4JyxcclxuICAgICAgICAgICAgICAgICd2aWV3UG9zJyxcclxuICAgICAgICAgICAgICAgICd3ZWlnaHRzJyxcclxuICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICBuYW1lIDogJ3Byb2pWaWV3TW9kZWxNYXRyaXgnLFxyXG4gICAgICAgICAgICAgICAgICAgIHR5cGUgOiAnZnVuY3Rpb24nLFxyXG4gICAgICAgICAgICAgICAgICAgIGZuIDogZnVuY3Rpb24gKGNvbnRleHQsIHByb3BzKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBtYXQ0Lm11bHRpcGx5KFtdLCBwcm9wc1sncHJvalZpZXdNYXRyaXgnXSwgcHJvcHNbJ21vZGVsTWF0cml4J10pO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXSxcclxuICAgICAgICAgICAgZGVmaW5lcyA6IHtcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgZXh0cmFDb21tYW5kUHJvcHMgOiB7IHZpZXdwb3J0IH1cclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBfdXBkYXRlR2VvbWV0cmllcyhtYXJrZXIpIHtcclxuICAgICAgICBjb25zdCBzaGFkZXIgPSBtYXJrZXIuZ2V0U2hhZGVyKCk7XHJcbiAgICAgICAgY29uc3QgZ2VvbWV0cnlPYmplY3QgPSB0aGlzLl9nZW9tZXRyaWVzW21hcmtlci5nZXRVcmwoKV07XHJcbiAgICAgICAgaWYgKHNoYWRlciA9PT0gJ3dpcmVmcmFtZScgJiYgZ2VvbWV0cnlPYmplY3QpIHtcclxuICAgICAgICAgICAgZ2VvbWV0cnlPYmplY3QuZ2VvbWV0cmllcy5mb3JFYWNoKGdlb09iamVjdCA9PiB7XHJcbiAgICAgICAgICAgICAgICBnZW9PYmplY3QuZ2VvbWV0cnkuYnVpbGRVbmlxdWVWZXJ0ZXgoKTtcclxuICAgICAgICAgICAgICAgIC8v5Yib5bu6YmFyeWNlbnRyaWPlsZ7mgKfmlbDmja7vvIzlj4LmlbDmmK9hdHRyaWJ1dGXlkI3lrZdcclxuICAgICAgICAgICAgICAgIGlmICghZ2VvT2JqZWN0Lmdlb21ldHJ5LmRhdGEuYUJhcnljZW50cmljKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgZ2VvT2JqZWN0Lmdlb21ldHJ5LmNyZWF0ZUJhcnljZW50cmljKCdhQmFyeWNlbnRyaWMnKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIF9yZWdpc3RlclNoYWRlcihuYW1lLCB0eXBlLCBjb25maWcsIG1hdGVyaWFsKSB7XHJcbiAgICAgICAgY29uc3Qgdmlld3BvcnQgPSB7XHJcbiAgICAgICAgICAgIHg6IDAsXHJcbiAgICAgICAgICAgIHk6IDAsXHJcbiAgICAgICAgICAgIHdpZHRoOiAoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5jYW52YXMgPyB0aGlzLmNhbnZhcy53aWR0aCA6IDE7XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIGhlaWdodDogKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuY2FudmFzID8gdGhpcy5jYW52YXMuaGVpZ2h0IDogMTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH07XHJcbiAgICAgICAgaWYgKCFjb25maWcuZXh0cmFDb21tYW5kUHJvcHMpIHtcclxuICAgICAgICAgICAgY29uZmlnLmV4dHJhQ29tbWFuZFByb3BzID0ge307XHJcbiAgICAgICAgfVxyXG4gICAgICAgIC8v5a+5c2hhZGVybWFw6L+b6KGM5aSN5Yi277yM5Lul5YWN5b2x5ZON5YWo5bGAc2hhZGVybWFwXHJcbiAgICAgICAgY29uc3QgY29weUNvbmZpZyA9IG1hcHRhbGtzLlV0aWwuZXh0ZW5kKHt9LCBjb25maWcpO1xyXG4gICAgICAgIGNvcHlDb25maWcuZXh0cmFDb21tYW5kUHJvcHMgPSBtYXB0YWxrcy5VdGlsLmV4dGVuZCh7fSwgY29uZmlnLmV4dHJhQ29tbWFuZFByb3BzKTtcclxuICAgICAgICBjb3B5Q29uZmlnLmV4dHJhQ29tbWFuZFByb3BzLnZpZXdwb3J0ID0gdmlld3BvcnQ7XHJcbiAgICAgICAgbGV0IGNvcHlVbmlmb3JtcyA9IG51bGw7XHJcbiAgICAgICAgaWYgKCEobWF0ZXJpYWwgaW5zdGFuY2VvZiByZXNoYWRlci5NYXRlcmlhbCkpIHtcclxuICAgICAgICAgICAgY29weVVuaWZvcm1zID0gbWFwdGFsa3MuVXRpbC5leHRlbmQoe30sIG1hdGVyaWFsKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgbGV0IHNoYWRlcjtcclxuICAgICAgICAvL+WkhOeQhuW4puacieWRveWQjeepuumXtOexu+Wei+eahHNoYWRlclxyXG4gICAgICAgIGlmICh0eXBlLmluZGV4T2YoJy4nKSA+IC0xKSB7XHJcbiAgICAgICAgICAgIHR5cGUgPSB0eXBlLnNwbGl0KCcuJyk7XHJcbiAgICAgICAgICAgIGNvbnN0IG5hbWVzcGFjZSA9IHR5cGVbMF07XHJcbiAgICAgICAgICAgIHR5cGUgPSB0eXBlWzFdO1xyXG4gICAgICAgICAgICBzaGFkZXIgPSBuZXcgcmVzaGFkZXJbbmFtZXNwYWNlXVt0eXBlXShjb3B5Q29uZmlnKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBzaGFkZXIgPSBuZXcgcmVzaGFkZXJbdHlwZV0oY29weUNvbmZpZyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMuX3NoYWRlckxpc3RbbmFtZV0gPSB7XHJcbiAgICAgICAgICAgIHNoYWRlcixcclxuICAgICAgICAgICAgbWF0ZXJpYWwsXHJcbiAgICAgICAgICAgIHVuaWZvcm1zOiBjb3B5VW5pZm9ybXNcclxuICAgICAgICB9O1xyXG4gICAgICAgIHRoaXMuc2hhZGVyTGlzdFRlc3QgPSB0aGlzLl9zaGFkZXJMaXN0O1xyXG4gICAgfVxyXG5cclxuICAgIGNsZWFyQ2FudmFzKCkge1xyXG4gICAgICAgIGlmICghdGhpcy5jYW52YXMpIHtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLnJlZ2wuY2xlYXIoe1xyXG4gICAgICAgICAgICBjb2xvcjogWzAsIDAsIDAsIDBdLFxyXG4gICAgICAgICAgICBkZXB0aDogMSxcclxuICAgICAgICAgICAgc3RlbmNpbDogMFxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIHN1cGVyLmNsZWFyQ2FudmFzKCk7XHJcbiAgICB9XHJcblxyXG4gICAgcmVzaXplQ2FudmFzKHNpemUpIHtcclxuICAgICAgICBzdXBlci5yZXNpemVDYW52YXMoc2l6ZSk7XHJcbiAgICAgICAgaWYgKHRoaXMucGlja2luZ0ZCTykge1xyXG4gICAgICAgICAgICB0aGlzLnBpY2tpbmdGQk8ucmVzaXplKHRoaXMuY2FudmFzLndpZHRoLCB0aGlzLmNhbnZhcy5oZWlnaHQpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvL+WcuuaZr+a4suafk+WHveaVsFxyXG4gICAgX3JlbmRlclNjZW5lKCkge1xyXG4gICAgICAgIGxldCByZW5kZXJDb3VudCA9IDA7XHJcbiAgICAgICAgLy/lpoLmnpxtZXNo5pWw5o2u6L+Y5rKh5Yid5aeL5YyW5a6M5oiQ77yM5YiZ5LiN5b+F6KaB6L+b6KGM5Zy65pmv55qE5riy5p+TXHJcbiAgICAgICAgaWYgKGlzRW1wdHlPYmplY3QodGhpcy5nbHRmU2NlbmVzKSB8fCAhdGhpcy5faWJsVW5pZm9ybXMpIHtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgICAvL+S7pXNoYWRlcuS4uuW+queOr+a4suafk+Wvueixoe+8jOiAjOS4jemHh+eUqOS7pW1hcmtlcuS4uua4suafk+Wvueixoe+8jOaYr+WboOS4uuS4gOiIrOadpeivtOi/kOeUqOWIsOeahHNoYWRlcumDveaYr+aciemZkOeahOWHoOS4qu+8jOiAjG1hcmtlcuWcqOWbvuWxguS4reaVsOmHj1xyXG4gICAgICAgIC8v5Y+v6IO95Lya6Z2e5bi45bqe5aSn77yM6aKR57mB55qE5Y67cmVuZGVyLOS8muWkp+mHj+iwg+eUqGdsLnVzZVByb2dyYW1cclxuICAgICAgICBmb3IgKGNvbnN0IG5hbWUgaW4gdGhpcy5fc2hhZGVyTGlzdCkge1xyXG4gICAgICAgICAgICBjb25zdCB2aXNpYmxlTWFya2VycyA9IHRoaXMubGF5ZXIuX21hcmtlckxpc3QuZmlsdGVyKG1hcmtlciA9PiB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gbWFya2VyLmlzVmlzaWJsZSgpICYmIG1hcmtlci5nZXRTaGFkZXIoKSA9PT0gbmFtZTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIGlmICghdmlzaWJsZU1hcmtlcnMubGVuZ3RoKSB7XHJcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB0aGlzLl9jaGVja01hcmtlcnNEaXJ0eSh2aXNpYmxlTWFya2Vycyk7XHJcbiAgICAgICAgICAgIC8v5Yib5bu66KeG6ZSl5L2T6IyD5Zu05YaF55qE5Zy65pmvXHJcbiAgICAgICAgICAgIHRoaXMuX3RvUmVuZGVyU2NlbmUgPSB0aGlzLl9jcmVhdGVTY2VuZUluRnJ1c3R1bSh2aXNpYmxlTWFya2Vycyk7XHJcbiAgICAgICAgICAgIGlmICghdGhpcy5fdG9SZW5kZXJTY2VuZSkge1xyXG4gICAgICAgICAgICAgICAgY29udGludWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgdGhpcy5yZW5kZXJlci5yZW5kZXIodGhpcy5fc2hhZGVyTGlzdFtuYW1lXS5zaGFkZXIsIHRoaXMuX3VuaWZvcm1zLCB0aGlzLl90b1JlbmRlclNjZW5lLCBudWxsKTtcclxuICAgICAgICAgICAgLy/mtYvor5Vtb3JwaFxyXG4gICAgICAgICAgICAvLyB0aGlzLnJlbmRlcmVyLnJlbmRlcih0aGlzLl9tb3JwaFNoYWRlciwgdGhpcy5fdW5pZm9ybXMsIHRoaXMuX3RvUmVuZGVyU2NlbmUsIG51bGwpO1xyXG4gICAgICAgICAgICByZW5kZXJDb3VudCsrO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLl9uZWVkUmVmcmVzaFBpY2tpbmcgPSB0cnVlO1xyXG4gICAgICAgIC8v5rWL6K+V5LqL5Lu2XHJcbiAgICAgICAgdGhpcy5sYXllci5maXJlKCdyZW5kZXJjb21wbGV0ZS1kZWJ1ZycsIHsgY291bnQ6IHJlbmRlckNvdW50IH0pO1xyXG4gICAgICAgIHRoaXMuY29tcGxldGVSZW5kZXIoKTtcclxuICAgIH1cclxuXHJcbiAgICBfY2hlY2tNYXJrZXJzRGlydHkobWFya2Vycykge1xyXG4gICAgICAgIG1hcmtlcnMuZm9yRWFjaChtYXJrZXIgPT4ge1xyXG4gICAgICAgICAgICBpZiAobWFya2VyLmlzRGlydHkoKSkge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgdWlkID0gbWFya2VyLl91aWQ7XHJcbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMuZ2x0ZlNjZW5lc1t1aWRdKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgdGhpcy5fdXBkYXRlU2NlbmVNYXRyaXgodWlkKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAvL+WmguaenOaVsOaNrumHjOmdouayoeacieWKqOeUu+aIluiAheWKqOeUu+ayoeacieaJk+W8gO+8jOWImeaKimdsdGZtYXJrZXLnmoRpc0RpcnR56YeN572u77yMXHJcbiAgICAgICAgICAgIC8v6L+Z5oSP5ZGz552A77yM5a+55Yqo55S76ICM6KiA5LiN5YaN6L+b6KGM6YeN57uY5pON5L2cKOS9huS4jeiDveS/neivgeWQjumdoueahOefqemYteWPmOWMluS8muS4jeS8muWwhmlzRGlydHnorr7kuLp0cnVlKVxyXG4gICAgICAgICAgICBpZiAobWFya2VyLmlzQW5pbWF0ZWQoKSB8fCBtYXJrZXIuaGFzRnVuY3Rpb25EZWZpbml0aW9uKCkpIHtcclxuICAgICAgICAgICAgICAgIG1hcmtlci5zZXREaXJ0eSh0cnVlKTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIG1hcmtlci5zZXREaXJ0eShmYWxzZSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICAvL+WIm+W7uuaWsOeahOeUqOS6jua4suafk+eahG1lc2jvvIzkuI5GcnVzdHVt55u45Lqk55qEbWVzaOaJjee7mOWItlxyXG4gICAgX2NyZWF0ZVNjZW5lSW5GcnVzdHVtKG1hcmtlcnMpIHtcclxuICAgICAgICBjb25zdCB2aXNpYmxlcyA9IFtdO1xyXG4gICAgICAgIGNvbnN0IG1hcCA9IHRoaXMubGF5ZXIuZ2V0TWFwKCk7XHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtYXJrZXJzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IG1hcmtlciA9IG1hcmtlcnNbaV07XHJcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gdGhpcy5nbHRmU2NlbmVzW21hcmtlci5fdWlkXTtcclxuICAgICAgICAgICAgaWYgKCFzY2VuZSkge1xyXG4gICAgICAgICAgICAgICAgLy9jcmVhdGVTY2VuZeaYr+S4gOS4quW8guatpeeahOi/h+eoi++8jOacieWPr+iDvW1hcmtlcnPlt7Lnu4/lhajpg6jliqDovb3liLDkuoblm77lsYLkuIrvvIzkvYbmmK/lr7nlupTnmoRtZXNo6L+Y5rKh5Yib5bu65a6M5oiQXHJcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBjb25zdCBtZXNoZXMgPSBzY2VuZS5tb2RlbE1lc2hlcztcclxuICAgICAgICAgICAgZm9yIChsZXQgaWkgPSAwOyBpaSA8IG1lc2hlcy5sZW5ndGg7IGlpKyspIHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IG1lc2ggPSBtZXNoZXNbaWldO1xyXG4gICAgICAgICAgICAgICAgLy/mm7TmlrBtZXNo55qEdW5pZm9ybXNcclxuICAgICAgICAgICAgICAgIGNvbnN0IHVuaWZvcm1zID0gbWFya2VyLmdldFVuaWZvcm1zKCk7XHJcbiAgICAgICAgICAgICAgICB0aGlzLl9zZXRNZXNoVW5pZm9ybXMobWVzaCwgdW5pZm9ybXMpO1xyXG4gICAgICAgICAgICAgICAgY29uc3QgbWF0ZXJpYWwgPSBtYXJrZXIuZ2V0TWF0ZXJpYWwoKTtcclxuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgbSBpbiBtYXRlcmlhbCkge1xyXG4gICAgICAgICAgICAgICAgICAgIG1lc2gubWF0ZXJpYWwuc2V0KG0sIG1hdGVyaWFsW21dKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIC8vVE9ETywg5q2k5aSE5LiN5YGa5LiORnJ1c3R1beeahOebuOS6pOWIpOaWre+8jOS8muacieS4gOmDqOWIhuaAp+iDveeahOaNn+iAl++8jOmcgOimgeWBmuS4gOS6m+aAp+iDveeahOS8mOWMllxyXG4gICAgICAgICAgICAgICAgaWYgKG1lc2ggaW5zdGFuY2VvZiByZXNoYWRlci5JbnN0YW5jZWRNZXNoKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmlzaWJsZXMucHVzaChtZXNoKTtcclxuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGNvbnN0IGJveCA9IG1lc2guZ2VvbWV0cnkuYm91bmRpbmdCb3g7XHJcbiAgICAgICAgICAgICAgICBjb25zdCB7IG1pbiwgbWF4IH0gPSBib3g7XHJcbiAgICAgICAgICAgICAgICB2ZWM0LnNldChWMCwgbWluWzBdLCBtaW5bMV0sIG1pblsyXSwgMSk7XHJcbiAgICAgICAgICAgICAgICB2ZWM0LnNldChWMSwgbWF4WzBdLCBtYXhbMV0sIG1heFsyXSwgMSk7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBib3hNaW4gPSB2ZWM0LnRyYW5zZm9ybU1hdDQoVjAsIFYwLCBtZXNoLmxvY2FsVHJhbnNmb3JtKSxcclxuICAgICAgICAgICAgICAgICAgICBib3hNYXggPSB2ZWM0LnRyYW5zZm9ybU1hdDQoVjEsIFYxLCBtZXNoLmxvY2FsVHJhbnNmb3JtKTtcclxuICAgICAgICAgICAgICAgIGlmIChpbnRlcnNlY3RzQm94KG1hcC5wcm9qVmlld01hdHJpeCwgW2JveE1pbiwgYm94TWF4XSkpIHtcclxuICAgICAgICAgICAgICAgICAgICBtZXNoLnNldFVuaWZvcm0oJ3RpbWUnLCBBTklNQVRJT05fVElNRSAqIDAuMDAxKTtcclxuICAgICAgICAgICAgICAgICAgICB2aXNpYmxlcy5wdXNoKG1lc2gpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiB2aXNpYmxlcy5sZW5ndGggPyBuZXcgcmVzaGFkZXIuU2NlbmUodmlzaWJsZXMpIDogbnVsbDtcclxuICAgIH1cclxuXHJcbiAgICAvL+WcqGRlZmluZXPph4zpnaLlrprkuYliYXNlVGV4dHVyZVxyXG4gICAgX3ByZXBhcmVNZXNoKGdlb09iamVjdCwgdWlkLCBzaGFkZXJOYW1lLCB1bmlmb3Jtcykge1xyXG4gICAgICAgIGNvbnN0IG1hcmtlciA9IHRoaXMubGF5ZXIuX21hcmtlck1hcFt1aWRdO1xyXG4gICAgICAgIGNvbnN0IGdlb21ldHJ5ID0gZ2VvT2JqZWN0Lmdlb21ldHJ5O1xyXG4gICAgICAgIC8v5aaC5p6cbWFya2Vy6K6+572u5oiQ5LqGd2lyZWZyYW1l55qEc2hhZGVyXHJcbiAgICAgICAgaWYgKHNoYWRlck5hbWUgPT09ICd3aXJlZnJhbWUnICYmICFnZW9tZXRyeS5kYXRhLmFCYXJ5Y2VudHJpYykge1xyXG4gICAgICAgICAgICAvL+mHjeaWsOe7hOe7h2F0dHJpYnV0ZeaVsOaNru+8jOiuqeavj+S4qumhtueCueacieeLrOeri+eahOaVsOaNrlxyXG4gICAgICAgICAgICBnZW9tZXRyeS5idWlsZFVuaXF1ZVZlcnRleCgpO1xyXG4gICAgICAgICAgICAvL+WIm+W7umJhcnljZW50cmlj5bGe5oCn5pWw5o2u77yM5Y+C5pWw5pivYXR0cmlidXRl5ZCN5a2XXHJcbiAgICAgICAgICAgIGdlb21ldHJ5LmNyZWF0ZUJhcnljZW50cmljKCdhQmFyeWNlbnRyaWMnKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgLy8gY29uc3QgbW9kZWxNZXNoID0gbmV3IHJlc2hhZGVyLk1lc2goZ2VvbWV0cnkpO1xyXG4gICAgICAgIGNvbnN0IG1vZGVsTWVzaCA9IHRoaXMuX2J1aWxkTWVzaCh1aWQsIGdlb09iamVjdCk7XHJcbiAgICAgICAgLy/lsIZ1UGlja2luZ0lk6K6+572u5oiQdWlk77yM55So5LqO5qih5Z6L5ou+5Y+WXHJcbiAgICAgICAgdW5pZm9ybXMudVBpY2tpbmdJZCA9IHVpZDtcclxuICAgICAgICB0aGlzLl9zZXRNZXNoVW5pZm9ybXMobW9kZWxNZXNoLCB1bmlmb3Jtcyk7XHJcbiAgICAgICAgdGhpcy5fc2V0TWVzaERlZmluZXMoc2hhZGVyTmFtZSwgbW9kZWxNZXNoLCAgbWFya2VyLmdldFR5cGUoKSk7XHJcbiAgICAgICAgLy/ov5vooYznurnnkIborr7nva5cclxuICAgICAgICBpZiAoc2hhZGVyTmFtZSA9PT0gJ3Bob25nJykge1xyXG4gICAgICAgICAgICAvL+eBr+WFieS9jee9rueahHVuaWZvcm3orr7nva5cclxuICAgICAgICAgICAgY29uc3QgcG9zaXRpb24gPSBtYXJrZXIuX2dldFBvc2l0aW9uKCkgfHwgdGhpcy5sYXllci5nZXRNYXAoKS5nZXRDZW50ZXIoKTtcclxuICAgICAgICAgICAgbW9kZWxNZXNoLnNldFVuaWZvcm0oJ2xpZ2h0UG9zaXRpb24nLCBbcG9zaXRpb25bMF0gKyB1bmlmb3Jtc1snbGlnaHRQb3NpdGlvbiddWzBdLCBwb3NpdGlvblsxXSArIHVuaWZvcm1zWydsaWdodFBvc2l0aW9uJ11bMV0sIHVuaWZvcm1zWydsaWdodFBvc2l0aW9uJ11bMl1dKTtcclxuICAgICAgICAgICAgaWYgKG1vZGVsTWVzaC5wcmltaXRpdmUpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuX3NldFBob25nVGV4dHVyZShtb2RlbE1lc2gpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgbW9kZWxNZXNoLnNldFVuaWZvcm0oJ2Jhc2VDb2xvckZhY3RvcicsIFsxLjAsIDEuMCwgMS4wLCAxLjBdKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5faXNQQlJTaGFkZXIoc2hhZGVyTmFtZSkpIHtcclxuICAgICAgICAgICAgY29uc3QgbWF0ZXJpYWxNYXBUYWJsZSA9IHsgbGl0IDogJ0xpdE1hdGVyaWFsJywgc3Vic3VyZmFjZSA6ICdTdWJzdXJmYWNlTWF0ZXJpYWwnLCBjbG90aCA6ICdDbG90aE1hdGVyaWFsJyB9O1xyXG4gICAgICAgICAgICAvLyBtb2RlbE1lc2guZ2VvbWV0cnkuY3JlYXRlVGFuZ2VudCgnVEFOR0VOVCcpO1xyXG4gICAgICAgICAgICBjb25zdCBtYXRlcmlhbCA9IG1hcmtlci5nZXRNYXRlcmlhbCgpIHx8IHRoaXMuX3NoYWRlckxpc3Rbc2hhZGVyTmFtZV0ubWF0ZXJpYWw7XHJcbiAgICAgICAgICAgIGNvbnN0IG1hdGVyaWFsVW5pZm9ybXMgPSB0aGlzLl9zZXRQQlJUZXh0dXJlKG1vZGVsTWVzaC5wcmltaXRpdmUpO1xyXG4gICAgICAgICAgICBpZiAobWF0ZXJpYWxVbmlmb3Jtcykge1xyXG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCB1IGluIG1hdGVyaWFsVW5pZm9ybXMpIHtcclxuICAgICAgICAgICAgICAgICAgICBpZiAobWF0ZXJpYWwuc2V0KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG1hdGVyaWFsLnNldCh1LCBtYXRlcmlhbFVuaWZvcm1zW3VdKTtcclxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBtYXRlcmlhbFt1XSA9IG1hdGVyaWFsVW5pZm9ybXNbdV07XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIG1vZGVsTWVzaC5tYXRlcmlhbCA9IG1hdGVyaWFsIGluc3RhbmNlb2YgcmVzaGFkZXIuTWF0ZXJpYWwgPyBtYXRlcmlhbCA6IG5ldyByZXNoYWRlci5wYnJbbWF0ZXJpYWxNYXBUYWJsZVtzaGFkZXJOYW1lXV0obWF0ZXJpYWwpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gbW9kZWxNZXNoO1xyXG4gICAgfVxyXG5cclxuICAgIF9zZXRNZXNoRGVmaW5lcyhzaGFkZXJOYW1lLCBtb2RlbE1lc2gsIG1hcmtlclR5cGUpIHtcclxuICAgICAgICAvL+iuvue9rlVTRV9QSUNLSU5HX0lE5Li6Mu+8jOeUqOadpeaMh+ekukZCT1JheVBpY2tpbmfmuLLmn5Pml7bor7vlj5Z1bmlmb3Jt6YeM6Z2i55qEdVBpY2tpbmdJZFxyXG4gICAgICAgIGxldCBkZWZpbmVzID0gbW9kZWxNZXNoLmdldERlZmluZXMoKTtcclxuICAgICAgICBkZWZpbmVzLlVTRV9QSUNLSU5HX0lEID0gMjtcclxuICAgICAgICBpZiAobW9kZWxNZXNoLm5vZGUgJiYgbW9kZWxNZXNoLm5vZGUubWVzaC5za2luKSB7XHJcbiAgICAgICAgICAgIGRlZmluZXMuVVNFX1NLSU4gPSAxO1xyXG4gICAgICAgIH1cclxuICAgICAgICBkZWZpbmVzID0gbWFwdGFsa3MuVXRpbC5leHRlbmQoe30sIHRoaXMuX2dldEdlb21ldHJ5RGVmaW5lcyhtb2RlbE1lc2guZ2VvbWV0cnksIHNoYWRlck5hbWUpLCBkZWZpbmVzKTtcclxuICAgICAgICBtb2RlbE1lc2guc2V0RGVmaW5lcyhkZWZpbmVzKTtcclxuICAgICAgICBpZiAobWFya2VyVHlwZSA9PT0gJ2dyb3VwZ2x0Zm1hcmtlcicpIHtcclxuICAgICAgICAgICAgY29uc3QgZGVmaW5lcyA9IG1vZGVsTWVzaC5nZXREZWZpbmVzKCk7XHJcbiAgICAgICAgICAgIGRlZmluZXMuVVNFX0lOU1RBTkNFID0gMTtcclxuICAgICAgICAgICAgLy/orr7nva5VU0VfUElDS0lOR19JROS4ujLvvIznlKjmnaXmjIfnpLpGQk9SYXlQaWNraW5n5riy5p+T5pe26K+75Y+WYXR0cmlidXRlc+mHjOmdoueahGFQaWNraW5nSWRcclxuICAgICAgICAgICAgZGVmaW5lcy5VU0VfUElDS0lOR19JRCA9IDE7XHJcbiAgICAgICAgICAgIG1vZGVsTWVzaC5zZXREZWZpbmVzKG1hcHRhbGtzLlV0aWwuZXh0ZW5kKHsgVVNFX0lOU1RBTkNFOiAxIH0sIGRlZmluZXMpKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgX2J1aWxkTWVzaCh1aWQsIGdlb09iamVjdCkge1xyXG4gICAgICAgIGNvbnN0IGdlb21ldHJ5ID0gZ2VvT2JqZWN0Lmdlb21ldHJ5O1xyXG4gICAgICAgIGNvbnN0IG1hcmtlciA9IHRoaXMubGF5ZXIuX21hcmtlck1hcFt1aWRdO1xyXG4gICAgICAgIGNvbnN0IHR5cGUgPSBtYXJrZXIuZ2V0VHlwZSgpO1xyXG4gICAgICAgIGlmICh0eXBlID09PSAnZ3JvdXBnbHRmbWFya2VyJykge1xyXG4gICAgICAgICAgICBjb25zdCBhdHRyaWJ1dGVzID0gbWFya2VyLl9nZXRJbnN0YW5jZUF0dHJpYnV0ZXNEYXRhKCk7XHJcbiAgICAgICAgICAgIGNvbnN0IGNvdW50ID0gbWFya2VyLmdldENvdW50KCk7XHJcbiAgICAgICAgICAgIGNvbnN0IGluc3RhbmNlTWVzaCA9IG5ldyByZXNoYWRlci5JbnN0YW5jZWRNZXNoKGF0dHJpYnV0ZXMsIGNvdW50LCBnZW9tZXRyeSk7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLnJlZ2wpIHtcclxuICAgICAgICAgICAgICAgIGluc3RhbmNlTWVzaC5nZW5lcmF0ZUluc3RhbmNlZEJ1ZmZlcnModGhpcy5yZWdsKTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHRoaXMubGF5ZXIub24oJ2NvbnRleHRjcmVhdGUnLCAoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgaW5zdGFuY2VNZXNoLmdlbmVyYXRlSW5zdGFuY2VkQnVmZmVycyh0aGlzLnJlZ2wpO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIGluc3RhbmNlTWVzaDtcclxuICAgICAgICB9XHJcbiAgICAgICAgY29uc3QgbW9kZWxNZXNoID0gbmV3IHJlc2hhZGVyLk1lc2goZ2VvbWV0cnkpO1xyXG4gICAgICAgIG1vZGVsTWVzaC5wcm9wZXJ0aWVzLm5vZGVJbmRleCA9IGdlb09iamVjdC5ub2RlSW5kZXg7XHJcbiAgICAgICAgbW9kZWxNZXNoLnByb3BlcnRpZXMubWFya2VySWQgPSB1aWQ7XHJcbiAgICAgICAgbW9kZWxNZXNoLl9ub2RlTWF0cml4ID0gZ2VvT2JqZWN0Lm1hdHJpeDtcclxuICAgICAgICBtb2RlbE1lc2gubm9kZSA9IGdlb09iamVjdC5ub2RlO1xyXG4gICAgICAgIG1vZGVsTWVzaC5wcmltaXRpdmUgPSBnZW9PYmplY3QucHJpbWl0aXZlO1xyXG4gICAgICAgIGNvbnN0IG1lc2ggPSBnZW9PYmplY3QubWVzaDtcclxuICAgICAgICBpZiAobWVzaCAmJiBtZXNoLnNraW4pIHtcclxuICAgICAgICAgICAgbW9kZWxNZXNoLnNraW4gPSBtZXNoLnNraW47XHJcbiAgICAgICAgICAgIG1vZGVsTWVzaC5zZXRVbmlmb3JtKCdqb2ludFRleHR1cmUnLCBtZXNoLnNraW4uam9pbnRUZXh0dXJlKTtcclxuICAgICAgICAgICAgbW9kZWxNZXNoLnNldFVuaWZvcm0oJ2pvaW50VGV4dHVyZVNpemUnLCBtZXNoLnNraW4uam9pbnRUZXh0dXJlU2l6ZSk7XHJcbiAgICAgICAgICAgIG1vZGVsTWVzaC5zZXRVbmlmb3JtKCdudW1Kb2ludHMnLCBtZXNoLnNraW4uam9pbnRzLmxlbmd0aCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBtb2RlbE1lc2g7XHJcbiAgICB9XHJcblxyXG4gICAgX2dldEdlb21ldHJ5RGVmaW5lcyhnZW9tZXRyeSwgc2hhZGVyTmFtZSkge1xyXG4gICAgICAgIGxldCBkZWZpbmVzID0ge307XHJcbiAgICAgICAgY29uc3Qgc2hhZGVyID0gdGhpcy5fc2hhZGVyTGlzdFtzaGFkZXJOYW1lXS5zaGFkZXI7XHJcbiAgICAgICAgaWYgKHNoYWRlci5nZXRHZW9tZXRyeURlZmluZXMpIHtcclxuICAgICAgICAgICAgZGVmaW5lcyA9IHNoYWRlci5nZXRHZW9tZXRyeURlZmluZXMoZ2VvbWV0cnkpO1xyXG4gICAgICAgICAgICBkZWZpbmVzWydIQVNfRElSRUNUSU9OQUxfTElHSFRJTkcnXSA9IDE7XHJcbiAgICAgICAgICAgIGRlZmluZXNbJ0lCTF9NQVhfTUlQX0xFVkVMJ10gPSAoTWF0aC5sb2coUFJFRklMVEVSX0NVQkVfU0laRSkgLyBNYXRoLmxvZygyKSkgKyAnLjAnO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gZGVmaW5lcztcclxuICAgIH1cclxuXHJcbiAgICBfZXh0ZW5kVW5pZm9ybXMobWFya2VyKSB7XHJcbiAgICAgICAgY29uc3QgbWFya2VyVW5pZm9ybXMgPSBtYXJrZXIuZ2V0VW5pZm9ybXMoKTtcclxuICAgICAgICBjb25zdCBzaGFkZXJOYW1lID0gbWFya2VyLmdldFNoYWRlcigpO1xyXG4gICAgICAgIGNvbnN0IGRlZmF1bHRVbmlmb3JtcyA9IHRoaXMuX3NoYWRlckxpc3Rbc2hhZGVyTmFtZV0udW5pZm9ybXM7XHJcbiAgICAgICAgLy9tYXJrZXLorr7nva7nmoR1bmlmb3Jtc+WSjOazqOWGjOaXtuWAmeeahHVuaWZvcm1z6L+b6KGM5ZCI5bm2XHJcbiAgICAgICAgY29uc3QgdW5pZm9ybXMgPSBtYXB0YWxrcy5VdGlsLmV4dGVuZCh7fSwgZGVmYXVsdFVuaWZvcm1zLCBtYXJrZXJVbmlmb3Jtcyk7XHJcbiAgICAgICAgcmV0dXJuIHVuaWZvcm1zO1xyXG4gICAgfVxyXG5cclxuICAgIC8v5qC55o2uZ2x0ZueahOaVsOaNrue7k+aehO+8jOWIm+W7uueUqOS6jue7mOWItueahG1lc2hcclxuICAgIF9jcmVhdGVTY2VuZShtYXJrZXIpIHtcclxuICAgICAgICBjb25zdCB1aWQgPSBtYXJrZXIuX3VpZDtcclxuICAgICAgICBjb25zdCB1cmwgPSBtYXJrZXIuZ2V0VXJsKCk7XHJcbiAgICAgICAgbGV0IG1vZGVsTWVzaGVzID0gW107XHJcbiAgICAgICAgY29uc3Qgc2hhZGVyTmFtZSA9IG1hcmtlci5nZXRTaGFkZXIoKTtcclxuICAgICAgICBjb25zdCB1bmlmb3JtcyA9IHRoaXMuX2V4dGVuZFVuaWZvcm1zKG1hcmtlcik7XHJcbiAgICAgICAgY29uc3Qgc2hhcmVkR2VvbWV0cnkgPSB0aGlzLl9nZW9tZXRyaWVzW3VybF07XHJcbiAgICAgICAgLy/lpoLmnpxzaGFyZWRHZW9tZXRyeeWPr+mHjeWkjeS9v+eUqO+8jOWImeebtOaOpeWIm+W7um1lc2jvvIzlkKbliJnvvIzpnIDopoHop6PmnpBnbHRm57uT5p6EXHJcbiAgICAgICAgaWYgKHNoYXJlZEdlb21ldHJ5KSB7XHJcbiAgICAgICAgICAgIHNoYXJlZEdlb21ldHJ5Lmdlb21ldHJpZXMuZm9yRWFjaChnZW9PYmplY3QgPT4ge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgbW9kZWxNZXNoID0gdGhpcy5fcHJlcGFyZU1lc2goZ2VvT2JqZWN0LCB1aWQsIHNoYWRlck5hbWUsIHVuaWZvcm1zKTtcclxuICAgICAgICAgICAgICAgIG1vZGVsTWVzaGVzLnB1c2gobW9kZWxNZXNoKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIHNoYXJlZEdlb21ldHJ5LmNvdW50ICs9IDE7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgY29uc3QganNvbiA9IG1hcmtlci5fZ2V0R0xURkRhdGEoKTtcclxuICAgICAgICAgICAgdGhpcy5fZ2VvbWV0cmllc1t1cmxdID0geyB1aWQsIGpzb24sIGdlb21ldHJpZXM6IFtdLCBjb3VudDogMSB9O1xyXG4gICAgICAgICAgICBpZiAoIWpzb24uc2NlbmVzKSB7XHJcbiAgICAgICAgICAgICAgICBtb2RlbE1lc2hlcyA9IHRoaXMuX2NyZWF0ZVNpbXBsZVNjZW5lKGpzb24sIHVpZCwgdXJsLCBzaGFkZXJOYW1lLCB1bmlmb3Jtcyk7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBtb2RlbE1lc2hlcyA9IHRoaXMuX2NyZWF0ZUdMVEZTY2VuZShqc29uLCB1aWQsIHVybCwgc2hhZGVyTmFtZSwgdW5pZm9ybXMpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMuZ2x0ZlNjZW5lc1t1aWRdID0geyB1aWQsIG1vZGVsTWVzaGVzIH07XHJcbiAgICAgICAgbWFya2VyLnNldERpcnR5KHRydWUpO1xyXG4gICAgICAgIHRoaXMuc2V0VG9SZWRyYXcoKTtcclxuICAgIH1cclxuXHJcbiAgICBfY3JlYXRlR0xURlNjZW5lKGpzb24sIHVpZCwgdXJsLCBzaGFkZXJOYW1lLCB1bmlmb3Jtcykge1xyXG4gICAgICAgIGNvbnN0IG1vZGVsTWVzaGVzID0gW107XHJcbiAgICAgICAgY29uc3QgbWVzaGVzID0gW107XHJcbiAgICAgICAgY29uc3Qgbm9kZXMgPSBqc29uLnNjZW5lc1swXS5ub2RlcztcclxuICAgICAgICAvL+agueaNrnNjZW5lIGdyYXBoaWPvvIzmioptZXNo5YWo6YOo6Kej5p6Q5Ye65p2lXHJcbiAgICAgICAgbm9kZXMuZm9yRWFjaCgobm9kZSkgPT4ge1xyXG4gICAgICAgICAgICB0aGlzLl9wYXJzZXJOb2RlKG5vZGUsIG1lc2hlcyk7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgbWVzaGVzLmZvckVhY2gobWVzaCA9PiB7XHJcbiAgICAgICAgICAgIG1lc2gucHJpbWl0aXZlcy5mb3JFYWNoKHByaW1pdGl2ZSA9PiB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBtb2RlbEdlb21ldHJ5ID0gdGhpcy5fY3JlYXRlR2VvbWV0cnkocHJpbWl0aXZlKTtcclxuICAgICAgICAgICAgICAgIGNvbnN0IGdlb09iamVjdCA9IHtcclxuICAgICAgICAgICAgICAgICAgICBub2RlSW5kZXg6IG1lc2gubm9kZUluZGV4LFxyXG4gICAgICAgICAgICAgICAgICAgIG1hcmtlcklkOiB1aWQsXHJcbiAgICAgICAgICAgICAgICAgICAgbWF0cml4OiBtZXNoLm5vZGVNYXRyaXgsXHJcbiAgICAgICAgICAgICAgICAgICAgZ2VvbWV0cnk6IG1vZGVsR2VvbWV0cnksXHJcbiAgICAgICAgICAgICAgICAgICAgcHJpbWl0aXZlLFxyXG4gICAgICAgICAgICAgICAgICAgIG5vZGUgOiBtZXNoLm5vZGUsXHJcbiAgICAgICAgICAgICAgICAgICAgbWVzaFxyXG4gICAgICAgICAgICAgICAgfTsvL1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fZ2VvbWV0cmllc1t1cmxdLmdlb21ldHJpZXMucHVzaChnZW9PYmplY3QpO1xyXG4gICAgICAgICAgICAgICAgLy9tb2RlbEdlb21ldHJ5LmdlbmVyYXRlQnVmZmVycyh0aGlzLnJlZ2wpOy8v5Lya5oqbZWxlbWVudHMgbXVzdCBiZSBhcnJheSB0byBidWlsZCB1bmlxdWUgdmVydGV4LueahOW8guW4uO+8jFxyXG4gICAgICAgICAgICAgICAgY29uc3QgbW9kZWxNZXNoID0gdGhpcy5fcHJlcGFyZU1lc2goZ2VvT2JqZWN0LCB1aWQsIHNoYWRlck5hbWUsIHVuaWZvcm1zKTtcclxuICAgICAgICAgICAgICAgIGlmIChtZXNoLndlaWdodHMpIHtcclxuICAgICAgICAgICAgICAgICAgICBtb2RlbE1lc2guc2V0VW5pZm9ybSgnd2VpZ2h0cycsIG1lc2gud2VpZ2h0cyk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBtb2RlbE1lc2hlcy5wdXNoKG1vZGVsTWVzaCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIHJldHVybiBtb2RlbE1lc2hlcztcclxuICAgIH1cclxuXHJcbiAgICBfcGFyc2VyTm9kZShub2RlLCBtZXNoZXMpIHtcclxuICAgICAgICBpZiAobm9kZS5pc1BhcnNlZCkge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIG5vZGUubm9kZU1hdHJpeCA9IG5vZGUubm9kZU1hdHJpeCB8fCBtYXQ0LmlkZW50aXR5KFtdKTtcclxuICAgICAgICBub2RlLmxvY2FsTWF0cml4ID0gbm9kZS5sb2NhbE1hdHJpeCB8fCBtYXQ0LmlkZW50aXR5KFtdKTtcclxuICAgICAgICBpZiAobm9kZS5tYXRyaXgpIHtcclxuICAgICAgICAgICAgbm9kZS50cnMgPSBuZXcgVFJTKCk7XHJcbiAgICAgICAgICAgIG5vZGUudHJzLnNldE1hdHJpeChub2RlLm1hdHJpeCk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgbm9kZS50cnMgPSBuZXcgVFJTKG5vZGUudHJhbnNsYXRpb24sIG5vZGUucm90YXRpb24sIG5vZGUuc2NhbGUpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAobm9kZS5jaGlsZHJlbikge1xyXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG5vZGUuY2hpbGRyZW4ubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IGNoaWxkID0gbm9kZS5jaGlsZHJlbltpXTtcclxuICAgICAgICAgICAgICAgIHRoaXMuX3BhcnNlck5vZGUoY2hpbGQsIG1lc2hlcyk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKGRlZmluZWQobm9kZS5tZXNoKSkge1xyXG4gICAgICAgICAgICBub2RlLm1lc2ggPSBub2RlLm1lc2hlc1swXTtcclxuICAgICAgICAgICAgbm9kZS5tZXNoLm5vZGUgPSBub2RlO1xyXG4gICAgICAgICAgICBtZXNoZXMucHVzaChub2RlLm1lc2gpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAobm9kZS5za2luKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHNraW4gPSBub2RlLnNraW47XHJcbiAgICAgICAgICAgIGNvbnN0IGpvaW50VGV4dHVyZSA9IHRoaXMucmVnbC50ZXh0dXJlKCk7XHJcbiAgICAgICAgICAgIG5vZGUubWVzaC5za2luID0gbmV3IFNraW4oc2tpbi5qb2ludHMsIHNraW4uaW52ZXJzZUJpbmRNYXRyaWNlcy5hcnJheSwgam9pbnRUZXh0dXJlKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgbm9kZS5pc1BhcnNlZCA9IHRydWU7XHJcbiAgICB9XHJcblxyXG4gICAgX2NyZWF0ZUdlb21ldHJ5KHByaW1pdGl2ZSkge1xyXG4gICAgICAgIGNvbnN0IGF0dHJpYnV0ZXMgPSB7fTtcclxuICAgICAgICBmb3IgKGNvbnN0IGF0dHIgaW4gcHJpbWl0aXZlLmF0dHJpYnV0ZXMpIHtcclxuICAgICAgICAgICAgYXR0cmlidXRlc1thdHRyXSA9IHByaW1pdGl2ZS5hdHRyaWJ1dGVzW2F0dHJdLmFycmF5O1xyXG4gICAgICAgIH1cclxuICAgICAgICBjb25zdCBtb2RlbEdlb21ldHJ5ID0gbmV3IHJlc2hhZGVyLkdlb21ldHJ5KFxyXG4gICAgICAgICAgICBhdHRyaWJ1dGVzLFxyXG4gICAgICAgICAgICBwcmltaXRpdmUuaW5kaWNlcyxcclxuICAgICAgICAgICAgMCxcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgLy/nu5jliLbnsbvlnovvvIzkvovlpoIgdHJpYW5nbGUgc3RyaXAsIGxpbmXnrYnvvIzmoLnmja5nbHRm5LitcHJpbWl0aXZl55qEbW9kZeadpeWIpOaWre+8jOm7mOiupOaYr3RyaWFuZ2xlc1xyXG4gICAgICAgICAgICAgICAgcHJpbWl0aXZlOiBtYXB0YWxrcy5VdGlsLmlzTnVtYmVyKHByaW1pdGl2ZS5tb2RlKSA/IE1PREVTW3ByaW1pdGl2ZS5tb2RlXSA6IHByaW1pdGl2ZS5tb2RlLFxyXG4gICAgICAgICAgICAgICAgcG9zaXRpb25BdHRyaWJ1dGU6ICdQT1NJVElPTicsXHJcbiAgICAgICAgICAgICAgICBub3JtYWxBdHRyaWJ1dGU6ICdOT1JNQUwnLFxyXG4gICAgICAgICAgICAgICAgdXYwQXR0cmlidXRlOiAnVEVYQ09PUkRfMCdcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICk7XHJcbiAgICAgICAgaWYgKCFtb2RlbEdlb21ldHJ5LmRhdGFbJ1RBTkdFTlQnXSkge1xyXG4gICAgICAgICAgICBtb2RlbEdlb21ldHJ5LmNyZWF0ZVRhbmdlbnQoJ1RBTkdFTlQnKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIG1vZGVsR2VvbWV0cnk7XHJcbiAgICB9XHJcblxyXG4gICAgX2NyZWF0ZVNpbXBsZVNjZW5lKGpzb24sIHVpZCwgdXJsLCBzaGFkZXJOYW1lLCB1bmlmb3Jtcykge1xyXG4gICAgICAgIGNvbnN0IG1vZGVsTWVzaGVzID0gW107XHJcbiAgICAgICAgY29uc3QgbW9kZWxHZW9tZXRyeSA9IHRoaXMuX2NyZWF0ZUdlb21ldHJ5KGpzb24pO1xyXG4gICAgICAgIGNvbnN0IGdlb09iamVjdCA9IHtcclxuICAgICAgICAgICAgbm9kZUluZGV4OiBudWxsLFxyXG4gICAgICAgICAgICBtYXJrZXJJZDogdWlkLFxyXG4gICAgICAgICAgICB0cnM6IFtbMCwgMCwgMF0sIFswLCAwLCAwLCAxXSwgWzEsIDEsIDFdXSxcclxuICAgICAgICAgICAgZ2VvbWV0cnk6IG1vZGVsR2VvbWV0cnksXHJcbiAgICAgICAgICAgIG1lc2ggOiBudWxsXHJcbiAgICAgICAgfTtcclxuICAgICAgICB0aGlzLl9nZW9tZXRyaWVzW3VybF0uZ2VvbWV0cmllcy5wdXNoKGdlb09iamVjdCk7XHJcbiAgICAgICAgLy9tb2RlbEdlb21ldHJ5LmdlbmVyYXRlQnVmZmVycyh0aGlzLnJlZ2wpO1xyXG4gICAgICAgIGNvbnN0IG1vZGVsTWVzaCA9IHRoaXMuX3ByZXBhcmVNZXNoKGdlb09iamVjdCwgdWlkLCBzaGFkZXJOYW1lLCB1bmlmb3Jtcyk7XHJcbiAgICAgICAgbW9kZWxNZXNoZXMucHVzaChtb2RlbE1lc2gpO1xyXG4gICAgICAgIHJldHVybiBtb2RlbE1lc2hlcztcclxuICAgIH1cclxuXHJcbiAgICAvL+iuvue9rue6ueeQhlxyXG4gICAgLy9UT0RPLCDlrp7njrBQQlLnmoTnurnnkIZcclxuICAgIF9zZXRQaG9uZ1RleHR1cmUobW9kZWxNZXNoKSB7XHJcbiAgICAgICAgLy9UT0RP77yM5p2Q6LSo55qE5a6M5ZaEXHJcbiAgICAgICAgY29uc3QgcHJpbWl0aXZlID0gbW9kZWxNZXNoLnByaW1pdGl2ZTtcclxuICAgICAgICBjb25zdCBtYXRlcmlhbCA9IHByaW1pdGl2ZS5tYXRlcmlhbC5wYnJNZXRhbGxpY1JvdWdobmVzcztcclxuICAgICAgICBjb25zdCBiYXNlQ29sb3JUZXh0dXJlID0gbWF0ZXJpYWwuYmFzZUNvbG9yVGV4dHVyZTtcclxuICAgICAgICBpZiAoYmFzZUNvbG9yVGV4dHVyZSkge1xyXG4gICAgICAgICAgICBjb25zdCB0ZXh0dXJlID0gdGhpcy5fdG9UZXh0dXJlKGJhc2VDb2xvclRleHR1cmUpO1xyXG4gICAgICAgICAgICBjb25zdCBkZWZpbmVzID0gbW9kZWxNZXNoLmdldERlZmluZXMoKTtcclxuICAgICAgICAgICAgZGVmaW5lcy5VU0VfQkFTRUNPTE9SVEVYVFVSRSA9IDE7XHJcbiAgICAgICAgICAgIG1vZGVsTWVzaC5zZXREZWZpbmVzKGRlZmluZXMpO1xyXG4gICAgICAgICAgICBtb2RlbE1lc2guc2V0VW5pZm9ybSgnYmFzZUNvbG9yVGV4dHVyZScsIHRleHR1cmUpO1xyXG4gICAgICAgICAgICBtb2RlbE1lc2guc2V0VW5pZm9ybSgnYmFzZUNvbG9yRmFjdG9yJywgWzEuMCwgMS4wLCAxLjAsIDEuMF0pO1xyXG4gICAgICAgIH0gaWYgKG1hdGVyaWFsLmJhc2VDb2xvckZhY3Rvcikge1xyXG4gICAgICAgICAgICBjb25zdCBiYXNlQ29sb3JGYWN0b3IgPSBtYXRlcmlhbC5iYXNlQ29sb3JGYWN0b3I7XHJcbiAgICAgICAgICAgIG1vZGVsTWVzaC5zZXRVbmlmb3JtKCdiYXNlQ29sb3JGYWN0b3InLCBiYXNlQ29sb3JGYWN0b3IpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBfc2V0UEJSVGV4dHVyZShwcmltaXRpdmUpIHtcclxuICAgICAgICBpZiAoIXByaW1pdGl2ZSkge1xyXG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgICB9XHJcbiAgICAgICAgY29uc3QgcGJyTWF0ZXJpYWwgPSBwcmltaXRpdmUubWF0ZXJpYWwucGJyTWV0YWxsaWNSb3VnaG5lc3M7XHJcbiAgICAgICAgY29uc3QgbWV0YWxsaWNSb3VnaG5lc3NUZXh0dXJlID0gcGJyTWF0ZXJpYWwubWV0YWxsaWNSb3VnaG5lc3NUZXh0dXJlO1xyXG4gICAgICAgIGNvbnN0IG1hdGVyaWFsVW5pZm9ybXMgPSB7fTtcclxuICAgICAgICBjb25zdCBiYXNlQ29sb3JUZXh0dXJlID0gcGJyTWF0ZXJpYWwuYmFzZUNvbG9yVGV4dHVyZTtcclxuICAgICAgICBpZiAoYmFzZUNvbG9yVGV4dHVyZSkge1xyXG4gICAgICAgICAgICBjb25zdCB0ZXh0dXJlID0gdGhpcy5fdG9UZXh0dXJlKGJhc2VDb2xvclRleHR1cmUpO1xyXG4gICAgICAgICAgICBtYXRlcmlhbFVuaWZvcm1zWydiYXNlQ29sb3JUZXh0dXJlJ10gPSB0ZXh0dXJlO1xyXG4gICAgICAgIH0gZWxzZSBpZiAocGJyTWF0ZXJpYWwuYmFzZUNvbG9yRmFjdG9yKSB7XHJcbiAgICAgICAgICAgIG1hdGVyaWFsVW5pZm9ybXNbJ2Jhc2VDb2xvckZhY3RvciddID0gcGJyTWF0ZXJpYWwuYmFzZUNvbG9yRmFjdG9yO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAobWV0YWxsaWNSb3VnaG5lc3NUZXh0dXJlKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHRleHR1cmUgPSB0aGlzLl90b1RleHR1cmUobWV0YWxsaWNSb3VnaG5lc3NUZXh0dXJlKTtcclxuICAgICAgICAgICAgbWF0ZXJpYWxVbmlmb3Jtc1snbWV0YWxsaWNSb3VnaG5lc3NUZXh0dXJlJ10gPSB0ZXh0dXJlO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGlmIChkZWZpbmVkKHBick1hdGVyaWFsLm1ldGFsbGljRmFjdG9yKSkge1xyXG4gICAgICAgICAgICAgICAgbWF0ZXJpYWxVbmlmb3Jtc1snbWV0YWxsaWNGYWN0b3InXSA9IHBick1hdGVyaWFsLm1ldGFsbGljRmFjdG9yO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmIChkZWZpbmVkKHBick1hdGVyaWFsLnJvdWdobmVzc0ZhY3RvcikpIHtcclxuICAgICAgICAgICAgICAgIG1hdGVyaWFsVW5pZm9ybXNbJ3JvdWdobmVzc0ZhY3RvciddID0gcGJyTWF0ZXJpYWwucm91Z2huZXNzRmFjdG9yO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChwcmltaXRpdmUubWF0ZXJpYWwubm9ybWFsVGV4dHVyZSkge1xyXG4gICAgICAgICAgICBjb25zdCB0ZXh0dXJlID0gdGhpcy5fdG9UZXh0dXJlKHByaW1pdGl2ZS5tYXRlcmlhbC5ub3JtYWxUZXh0dXJlKTtcclxuICAgICAgICAgICAgbWF0ZXJpYWxVbmlmb3Jtc1snbm9ybWFsVGV4dHVyZSddID0gdGV4dHVyZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHByaW1pdGl2ZS5tYXRlcmlhbC5vY2NsdXNpb25UZXh0dXJlKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHRleHR1cmUgPSB0aGlzLl90b1RleHR1cmUocHJpbWl0aXZlLm1hdGVyaWFsLm9jY2x1c2lvblRleHR1cmUpO1xyXG4gICAgICAgICAgICBtYXRlcmlhbFVuaWZvcm1zWydvY2NsdXNpb25UZXh0dXJlJ10gPSB0ZXh0dXJlO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAocHJpbWl0aXZlLm1hdGVyaWFsLmVtaXNzaXZlVGV4dHVyZSkge1xyXG4gICAgICAgICAgICBjb25zdCB0ZXh0dXJlID0gdGhpcy5fdG9UZXh0dXJlKHByaW1pdGl2ZS5tYXRlcmlhbC5lbWlzc2l2ZVRleHR1cmUpO1xyXG4gICAgICAgICAgICBtYXRlcmlhbFVuaWZvcm1zWydlbWlzc2l2ZVRleHR1cmUnXSA9IHRleHR1cmU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBtYXRlcmlhbFVuaWZvcm1zO1xyXG4gICAgfVxyXG5cclxuICAgIF90b1RleHR1cmUodGV4dHVyZSkge1xyXG4gICAgICAgIGNvbnN0IGRhdGEgPSB0ZXh0dXJlLnRleHR1cmUuaW1hZ2UuYXJyYXk7XHJcbiAgICAgICAgY29uc3Qgc2FtcGxlciA9IHRleHR1cmUudGV4dHVyZS5zYW1wbGVyIHx8IHt9O1xyXG4gICAgICAgIGNvbnN0IHdpZHRoID0gdGV4dHVyZS50ZXh0dXJlLmltYWdlLndpZHRoO1xyXG4gICAgICAgIGNvbnN0IGhlaWdodCA9IHRleHR1cmUudGV4dHVyZS5pbWFnZS5oZWlnaHQ7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMucmVnbC50ZXh0dXJlKHtcclxuICAgICAgICAgICAgd2lkdGgsXHJcbiAgICAgICAgICAgIGhlaWdodCxcclxuICAgICAgICAgICAgZGF0YSxcclxuICAgICAgICAgICAgbWFnOiBURVhUVVJFX1NBTVBMRVJbc2FtcGxlci5tYWdGaWx0ZXJdIHx8IFRFWFRVUkVfU0FNUExFUlsnOTcyOCddLFxyXG4gICAgICAgICAgICBtaW46IFRFWFRVUkVfU0FNUExFUltzYW1wbGVyLm1pbkZpbHRlcl0gfHwgVEVYVFVSRV9TQU1QTEVSWyc5NzI4J10sXHJcbiAgICAgICAgICAgIHdyYXBTOiBURVhUVVJFX1NBTVBMRVJbc2FtcGxlci53cmFwU10gfHwgVEVYVFVSRV9TQU1QTEVSWycxMDQ5NyddLFxyXG4gICAgICAgICAgICB3cmFwVDogVEVYVFVSRV9TQU1QTEVSW3NhbXBsZXIud3JhcFRdIHx8IFRFWFRVUkVfU0FNUExFUlsnMTA0OTcnXVxyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIF9zZXRNZXNoVW5pZm9ybXMobWVzaCwgdW5pZm9ybXMpIHtcclxuICAgICAgICBmb3IgKGNvbnN0IGsgaW4gdW5pZm9ybXMpIHtcclxuICAgICAgICAgICAgbWVzaC5zZXRVbmlmb3JtKGssIHVuaWZvcm1zW2tdKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIG1lc2g7XHJcbiAgICB9XHJcblxyXG4gICAgX3VwZGF0ZU5vZGVNYXRyaXgobWFya2VyLCBub2RlLCBwYXJlbnROb2RlTWF0cml4KSB7XHJcbiAgICAgICAgY29uc3QgdHJzID0gbm9kZS50cnM7XHJcbiAgICAgICAgaWYgKHRycykge1xyXG4gICAgICAgICAgICB0cnMuc2V0TWF0cml4KG5vZGUubG9jYWxNYXRyaXgpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAocGFyZW50Tm9kZU1hdHJpeCkge1xyXG4gICAgICAgICAgICBtYXQ0Lm11bHRpcGx5KG5vZGUubm9kZU1hdHJpeCwgcGFyZW50Tm9kZU1hdHJpeCwgbm9kZS5sb2NhbE1hdHJpeCk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgbWF0NC5jb3B5KG5vZGUubm9kZU1hdHJpeCwgbm9kZS5sb2NhbE1hdHJpeCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGNvbnN0IG5vZGVNYXRyaXggPSBub2RlLm5vZGVNYXRyaXg7XHJcbiAgICAgICAgaWYgKG5vZGUuY2hpbGRyZW4pIHtcclxuICAgICAgICAgICAgbm9kZS5jaGlsZHJlbi5mb3JFYWNoKGNoaWxkID0+IHtcclxuICAgICAgICAgICAgICAgIHRoaXMuX3VwZGF0ZU5vZGVNYXRyaXgobWFya2VyLCBjaGlsZCwgbm9kZU1hdHJpeCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAobWFya2VyLmlzQW5pbWF0ZWQoKSkge1xyXG4gICAgICAgICAgICBjb25zdCB1cmwgPSBtYXJrZXIuZ2V0VXJsKCk7XHJcbiAgICAgICAgICAgIGNvbnN0IGpzb24gPSB0aGlzLl9nZW9tZXRyaWVzW3VybF0uanNvbjtcclxuICAgICAgICAgICAgY29uc3Qgc3BlZWQgPSBtYXJrZXIuZ2V0QW5pbWF0aW9uU3BlZWQoKTtcclxuICAgICAgICAgICAgY29uc3QgaXNMb29wZWQgPSBtYXJrZXIuaXNMb29wZWQoKTtcclxuICAgICAgICAgICAgLy8gLy9UT0RP77yMdGltZXNwYW7mmK/kuKrlm7rlrprlgLzvvIzmmK/lkKbogIPomZHnp7vliLBnbHRmLWxvYWRlcumHjOmdolxyXG4gICAgICAgICAgICBjb25zdCB0aW1lc3BhbiA9IGpzb24uYW5pbWF0aW9ucyA/IGdsdGYuR0xURkxvYWRlci5nZXRBbmltYXRpb25UaW1lU3Bhbihqc29uKSA6IG51bGw7XHJcbiAgICAgICAgICAgIGNvbnN0IGFuaW1UaW1lID0gaXNMb29wZWQgPyAoQU5JTUFUSU9OX1RJTUUgKiAwLjAwMSkgJSAodGltZXNwYW4ubWF4IC0gdGltZXNwYW4ubWluKSA6IEFOSU1BVElPTl9USU1FICogMC4wMDE7XHJcbiAgICAgICAgICAgIGNvbnN0IGFuaW1DbGlwID0gZ2x0Zi5HTFRGTG9hZGVyLmdldEFuaW1hdGlvbkNsaXAoanNvbiwgTnVtYmVyKG5vZGUubm9kZUluZGV4KSwgYW5pbVRpbWUgKiBzcGVlZCk7XHJcbiAgICAgICAgICAgIGNvbnN0IGFuaW1UcmFuc2Zvcm1NYXQgPSBhbmltQ2xpcC50cnM7XHJcbiAgICAgICAgICAgIGRlY29tcG9zZShhbmltVHJhbnNmb3JtTWF0LCBub2RlLnRycy50cmFuc2xhdGlvbiwgbm9kZS50cnMucm90YXRpb24sIG5vZGUudHJzLnNjYWxlKTtcclxuICAgICAgICAgICAgLy8gbWF0NC5tdWx0aXBseShub2RlLm5vZGVNYXRyaXgsIG5vZGUubm9kZU1hdHJpeCwgYW5pbVRyYW5zZm9ybU1hdCk7XHJcbiAgICAgICAgICAgIGlmIChhbmltQ2xpcC53ZWlnaHRzKSB7XHJcbiAgICAgICAgICAgICAgICBub2RlLm1vcnBoV2VpZ2h0cyA9IGFuaW1DbGlwLndlaWdodHM7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaWYgKG5vZGUuc2tpbikge1xyXG4gICAgICAgICAgICAgICAgbm9kZS5za2luLmpvaW50cy5mb3JFYWNoKGpvaW50ID0+IHtcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCBhbmltU2tpbk1hdCA9ICBnbHRmLkdMVEZMb2FkZXIuZ2V0QW5pbWF0aW9uQ2xpcChqc29uLCBOdW1iZXIoam9pbnQubm9kZUluZGV4KSwgYW5pbVRpbWUgKiBzcGVlZCkudHJzO1xyXG4gICAgICAgICAgICAgICAgICAgIGRlY29tcG9zZShhbmltU2tpbk1hdCwgam9pbnQudHJzLnRyYW5zbGF0aW9uLCBqb2ludC50cnMucm90YXRpb24sIGpvaW50LnRycy5zY2FsZSk7XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBfdXBkYXRlU2NlbmVNYXRyaXgodWlkKSB7XHJcbiAgICAgICAgY29uc3Qgc2NlbmUgPSB0aGlzLmdsdGZTY2VuZXNbdWlkXTtcclxuICAgICAgICBpZiAoIXNjZW5lKSB7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgICAgY29uc3QgbWFya2VyID0gdGhpcy5sYXllci5fbWFya2VyTWFwW3VpZF07XHJcbiAgICAgICAgY29uc3QgdXJsID0gbWFya2VyLmdldFVybCgpO1xyXG4gICAgICAgIGlmICghdGhpcy5fZ2VvbWV0cmllc1t1cmxdKSB7XHJcbiAgICAgICAgICAgIC8v5YiH5o2idXJs5ZCO77yM5pWw5o2u6L+Y5pyq5Yqg6L295a6M5oiQXHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgICAgY29uc3QganNvbiA9IHRoaXMuX2dlb21ldHJpZXNbdXJsXS5qc29uO1xyXG4gICAgICAgIGlmICghanNvbikge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIC8vdXBkYXRlTWF0cnjmlrnms5XlhYjmiornn6npmLXmlbDmja7mm7TmlrDlpb3vvIzlkI7pnaLlho3miornn6npmLXmlbDmja7mjqjliLBtZXNo6YeM6Z2iXHJcbiAgICAgICAgbWFya2VyLl91cGRhdGVNYXRyaXgoKTtcclxuICAgICAgICBjb25zdCB0cmFuc2Zvcm1NYXQgPSBtYXJrZXIuZ2V0TW9kZWxNYXRyaXgoKTtcclxuICAgICAgICBpZiAoanNvbi5zY2VuZXMpIHtcclxuICAgICAgICAgICAganNvbi5zY2VuZXNbMF0ubm9kZXMuZm9yRWFjaChub2RlID0+IHtcclxuICAgICAgICAgICAgICAgIHRoaXMuX3VwZGF0ZU5vZGVNYXRyaXgobWFya2VyLCBub2RlKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGNvbnN0IG1lc2hlcyA9IHNjZW5lLm1vZGVsTWVzaGVzO1xyXG4gICAgICAgIG1lc2hlcy5mb3JFYWNoKG1lc2ggPT4ge1xyXG4gICAgICAgICAgICAvLyBpZiAobWVzaC5ub2RlLm1vcnBoV2VpZ2h0cykge1xyXG4gICAgICAgICAgICAvLyAgICAgbWVzaC5zZXRVbmlmb3JtKCd3ZWlnaHRzJywgbWVzaC5ub2RlLm1vcnBoV2VpZ2h0cyk7XHJcbiAgICAgICAgICAgIC8vIH1cclxuICAgICAgICAgICAgaWYgKG1lc2guc2tpbikge1xyXG4gICAgICAgICAgICAgICAgbWVzaC5za2luLnVwZGF0ZShtZXNoLm5vZGUubm9kZU1hdHJpeCk7XHJcbiAgICAgICAgICAgICAgICBtZXNoLnNldFVuaWZvcm0oJ2pvaW50VGV4dHVyZScsIG1lc2guc2tpbi5qb2ludFRleHR1cmUpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmIChtZXNoLm5vZGUgJiYgbWVzaC5ub2RlLm5vZGVNYXRyaXgpIHtcclxuICAgICAgICAgICAgICAgIC8vIGNvbnN0IG5vZGVNYXRyaXggPSBtZXNoLm5vZGUubm9kZU1hdHJpeDtcclxuICAgICAgICAgICAgICAgIG1hdDQubXVsdGlwbHkodHJhbnNmb3JtTWF0LCB0cmFuc2Zvcm1NYXQsIG1lc2gubm9kZS5ub2RlTWF0cml4KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBtZXNoLnNldExvY2FsVHJhbnNmb3JtKHRyYW5zZm9ybU1hdCk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgX3VwZGF0ZUluc3RhbmNlZE1lc2hEYXRhKG1lc2gsIG1hcmtlcikge1xyXG4gICAgICAgIGNvbnN0IGF0dHJpYnV0ZXMgPSBtYXJrZXIuX2dldEluc3RhbmNlQXR0cmlidXRlc0RhdGEobWVzaC5sb2NhbFRyYW5zZm9ybSk7XHJcbiAgICAgICAgY29uc3QgbWF0cml4ID0gbWF0NC5tdWx0aXBseShbXSwgbWFya2VyLl9hdHRyaWJ0ZU1hdHJpeHNbMF0sIG1lc2gubG9jYWxUcmFuc2Zvcm0pO1xyXG4gICAgICAgIG1lc2guc2V0TG9jYWxUcmFuc2Zvcm0obWF0cml4KTtcclxuICAgICAgICBmb3IgKGNvbnN0IGtleSBpbiBhdHRyaWJ1dGVzKSB7XHJcbiAgICAgICAgICAgIG1lc2gudXBkYXRlSW5zdGFuY2VkRGF0YShrZXksIGF0dHJpYnV0ZXNba2V5XSk7XHJcbiAgICAgICAgICAgIG1lc2guaW5zdGFuY2VDb3VudCA9IG1hcmtlci5nZXRDb3VudCgpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBfZGVsZXRlU2NlbmUodWlkKSB7XHJcbiAgICAgICAgaWYgKGRlZmluZWQodWlkKSkge1xyXG4gICAgICAgICAgICB0aGlzLl9kaXNwb3NlTWVzaCh1aWQpO1xyXG4gICAgICAgICAgICBkZWxldGUgdGhpcy5nbHRmU2NlbmVzW3VpZF07XHJcbiAgICAgICAgICAgIHRoaXMuc2V0VG9SZWRyYXcoKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgX2RlbGV0ZUFsbCgpIHtcclxuICAgICAgICBmb3IgKGNvbnN0IHVpZCBpbiB0aGlzLmdsdGZTY2VuZXMpIHtcclxuICAgICAgICAgICAgdGhpcy5fZGlzcG9zZU1lc2godWlkKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5nbHRmU2NlbmVzID0ge307XHJcbiAgICAgICAgdGhpcy5zZXRUb1JlZHJhdygpO1xyXG4gICAgfVxyXG5cclxuICAgIF9kaXNwb3NlTWVzaCh1aWQpIHtcclxuICAgICAgICBpZiAoIXRoaXMuZ2x0ZlNjZW5lc1t1aWRdKSB7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgICAgY29uc3QgbWFya2VyID0gdGhpcy5sYXllci5fbWFya2VyTWFwW3VpZF07XHJcbiAgICAgICAgY29uc3QgdXJsID0gbWFya2VyLmdldFVybCgpO1xyXG4gICAgICAgIHRoaXMuX2dlb21ldHJpZXNbdXJsXS5jb3VudCAtPSAxO1xyXG4gICAgICAgIGNvbnN0IG1lc2hlcyA9IHRoaXMuZ2x0ZlNjZW5lc1t1aWRdLm1vZGVsTWVzaGVzO1xyXG4gICAgICAgIG1lc2hlcy5mb3JFYWNoKG1lc2ggPT4ge1xyXG4gICAgICAgICAgICBpZiAodGhpcy5fZ2VvbWV0cmllc1t1cmxdLmNvdW50IDw9IDApIHtcclxuICAgICAgICAgICAgICAgIG1lc2guZ2VvbWV0cnkuZGlzcG9zZSgpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmIChtZXNoLm1hdGVyaWFsKSB7XHJcbiAgICAgICAgICAgICAgICBtZXNoLm1hdGVyaWFsLmRpc3Bvc2UoKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBtZXNoLmRpc3Bvc2UoKTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBfcmVtb3ZlR2VvbWV0cnkodXJsKSB7XHJcbiAgICAgICAgaWYgKHRoaXMuX2dlb21ldHJpZXMgJiYgdGhpcy5fZ2VvbWV0cmllc1t1cmxdKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2dlb21ldHJpZXNbdXJsXS5jb3VudCAtPSAxO1xyXG4gICAgICAgICAgICBpZiAodGhpcy5fZ2VvbWV0cmllc1t1cmxdLmNvdW50IDw9IDApIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuX2dlb21ldHJpZXNbdXJsXS5nZW9tZXRyaWVzLmZvckVhY2goZ2VvT2JqZWN0ID0+IHtcclxuICAgICAgICAgICAgICAgICAgICBnZW9PYmplY3QuZ2VvbWV0cnkuZGlzcG9zZSgpO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICBkZWxldGUgdGhpcy5fZ2VvbWV0cmllc1t1cmxdO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIF9jcmVhdGVHTENvbnRleHQoY2FudmFzLCBvcHRpb25zKSB7XHJcbiAgICAgICAgY29uc3QgbmFtZXMgPSBbJ3dlYmdsJywgJ2V4cGVyaW1lbnRhbC13ZWJnbCddO1xyXG4gICAgICAgIGxldCBjb250ZXh0ID0gbnVsbDtcclxuICAgICAgICAvKiBlc2xpbnQtZGlzYWJsZSBuby1lbXB0eSAqL1xyXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbmFtZXMubGVuZ3RoOyArK2kpIHtcclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgIGNvbnRleHQgPSBjYW52YXMuZ2V0Q29udGV4dChuYW1lc1tpXSwgb3B0aW9ucyk7XHJcbiAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHsgfVxyXG4gICAgICAgICAgICBpZiAoY29udGV4dCkge1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIGNvbnRleHQ7XHJcbiAgICAgICAgLyogZXNsaW50LWVuYWJsZSBuby1lbXB0eSAqL1xyXG4gICAgfVxyXG5cclxuICAgIF9pZGVudGlmeSh4LCB5LCBvcHRpb25zID0ge30pIHtcclxuICAgICAgICBpZiAoIXRoaXMuX3BpY2tpbmcpIHtcclxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGNvbnN0IG1hcCA9IHRoaXMubGF5ZXIuZ2V0TWFwKCk7XHJcbiAgICAgICAgaWYgKHRoaXMuX25lZWRSZWZyZXNoUGlja2luZykge1xyXG4gICAgICAgICAgICBpZiAoIXRoaXMuX3RvUmVuZGVyU2NlbmUpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGNvbnN0IG1lc2hlcyA9IHRoaXMuX3RvUmVuZGVyU2NlbmUuZ2V0TWVzaGVzKCk7XHJcbiAgICAgICAgICAgIHRoaXMuX3BpY2tpbmcucmVuZGVyKG1lc2hlcywgdGhpcy5fdW5pZm9ybXMsIHRydWUpO1xyXG4gICAgICAgICAgICB0aGlzLl9uZWVkUmVmcmVzaFBpY2tpbmcgPSBmYWxzZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgY29uc3QgeyBtZXNoSWQsIHBpY2tpbmdJZCwgcG9pbnQgfSA9IHRoaXMuX3BpY2tpbmcucGljayhcclxuICAgICAgICAgICAgeCwgICAvLyDlsY/luZXlnZDmoIcgeOi9tOeahOWAvFxyXG4gICAgICAgICAgICB5LCAgLy8g5bGP5bmV5Z2Q5qCHIHnovbTnmoTlgLxcclxuICAgICAgICAgICAgb3B0aW9ucy50b2xlcmFuY2UgfHwgMyxcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgJ3Byb2pWaWV3TWF0cml4JzogbWFwLnByb2pWaWV3TWF0cml4XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIHZpZXdNYXRyaXg6IG1hcC52aWV3TWF0cml4LCAgLy92aWV3TWF0cml45ZKMcHJvak1hdHJpeOeUqOS6juiuoeeul+eCueeahOS4lueVjOWdkOagh+WAvFxyXG4gICAgICAgICAgICAgICAgcHJvak1hdHJpeDogbWFwLnByb2pNYXRyaXgsXHJcbiAgICAgICAgICAgICAgICByZXR1cm5Qb2ludDogdHJ1ZVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgKTtcclxuICAgICAgICBjb25zdCB1aWQgPSB0aGlzLl9zcXVlZXplVGFyZ2V0KHBpY2tpbmdJZCk7XHJcbiAgICAgICAgY29uc3QgdGFyZ2V0ID0gdGhpcy5sYXllci5fbWFya2VyTWFwW3VpZF07XHJcbiAgICAgICAgcmV0dXJuIHsgbWVzaElkLCB0YXJnZXQsIHBpY2tpbmdJZCwgcG9pbnQgfTtcclxuICAgIH1cclxuXHJcbiAgICBfc3F1ZWV6ZVRhcmdldChwaWNraW5nSWQpIHtcclxuICAgICAgICBpZiAoIWRlZmluZWQocGlja2luZ0lkKSkge1xyXG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHRoaXMubGF5ZXIuX21hcmtlck1hcFtwaWNraW5nSWRdKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBwaWNraW5nSWQ7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGNvbnN0IGtleXMgPSBPYmplY3Qua2V5cyh0aGlzLmxheWVyLl9tYXJrZXJNYXApO1xyXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwga2V5cy5sZW5ndGggLSAxOyBpKyspIHtcclxuICAgICAgICAgICAgY29uc3Qga2V5MCA9IE51bWJlcihrZXlzW2ldKTtcclxuICAgICAgICAgICAgY29uc3Qga2V5MSA9IE51bWJlcihrZXlzW2kgKyAxXSk7XHJcbiAgICAgICAgICAgIGlmICgocGlja2luZ0lkID49IGtleTAgJiYgcGlja2luZ0lkIDwga2V5MSkpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBrZXkwO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGNvbnN0IGVuZEtleSA9IE51bWJlcihrZXlzW2tleXMubGVuZ3RoIC0gMV0pO1xyXG4gICAgICAgIGlmIChwaWNraW5nSWQgPj0gZW5kS2V5KSB7XHJcbiAgICAgICAgICAgIHJldHVybiBlbmRLZXk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgfVxyXG5cclxuICAgIF9pc1BCUlNoYWRlcihzaGFkZXJOYW1lKSB7XHJcbiAgICAgICAgcmV0dXJuIHNoYWRlck5hbWUgPT09ICdsaXQnIHx8IHNoYWRlck5hbWUgPT09ICdzdWJzdXJmYWNlJyB8fCBzaGFkZXJOYW1lID09PSAnY2xvdGgnO1xyXG4gICAgfVxyXG5cclxufVxyXG5cclxuZXhwb3J0IGRlZmF1bHQgR0xURkxheWVyUmVuZGVyZXI7XHJcbiIsIi8qZXNsaW50LWRpc2FibGUgbm8tdmFyLCBwcmVmZXItY29uc3QqL1xyXG5mdW5jdGlvbiBjcmVhdGVGdW5jdGlvbihwYXJhbWV0ZXJzLCBkZWZhdWx0VHlwZSkge1xyXG4gICAgdmFyIGZ1bjtcclxuICAgIHZhciBpc0ZlYXR1cmVDb25zdGFudCwgaXNab29tQ29uc3RhbnQ7XHJcbiAgICBpZiAoIWlzRnVuY3Rpb25EZWZpbml0aW9uKHBhcmFtZXRlcnMpKSB7XHJcbiAgICAgICAgZnVuID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gcGFyYW1ldGVyczsgfTtcclxuICAgICAgICBpc0ZlYXR1cmVDb25zdGFudCA9IHRydWU7XHJcbiAgICAgICAgaXNab29tQ29uc3RhbnQgPSB0cnVlO1xyXG5cclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgdmFyIHpvb21BbmRGZWF0dXJlRGVwZW5kZW50ID0gcGFyYW1ldGVycy5zdG9wcyAmJiB0eXBlb2YgcGFyYW1ldGVycy5zdG9wc1swXVswXSA9PT0gJ29iamVjdCc7XHJcbiAgICAgICAgdmFyIGZlYXR1cmVEZXBlbmRlbnQgPSB6b29tQW5kRmVhdHVyZURlcGVuZGVudCB8fCBwYXJhbWV0ZXJzLnByb3BlcnR5ICE9PSB1bmRlZmluZWQ7XHJcbiAgICAgICAgdmFyIHpvb21EZXBlbmRlbnQgPSB6b29tQW5kRmVhdHVyZURlcGVuZGVudCB8fCAhZmVhdHVyZURlcGVuZGVudDtcclxuICAgICAgICB2YXIgdHlwZSA9IHBhcmFtZXRlcnMudHlwZSB8fCBkZWZhdWx0VHlwZSB8fCAnZXhwb25lbnRpYWwnO1xyXG5cclxuICAgICAgICB2YXIgaW5uZXJGdW47XHJcbiAgICAgICAgaWYgKHR5cGUgPT09ICdleHBvbmVudGlhbCcpIHtcclxuICAgICAgICAgICAgaW5uZXJGdW4gPSBldmFsdWF0ZUV4cG9uZW50aWFsRnVuY3Rpb247XHJcbiAgICAgICAgfSBlbHNlIGlmICh0eXBlID09PSAnaW50ZXJ2YWwnKSB7XHJcbiAgICAgICAgICAgIGlubmVyRnVuID0gZXZhbHVhdGVJbnRlcnZhbEZ1bmN0aW9uO1xyXG4gICAgICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gJ2NhdGVnb3JpY2FsJykge1xyXG4gICAgICAgICAgICBpbm5lckZ1biA9IGV2YWx1YXRlQ2F0ZWdvcmljYWxGdW5jdGlvbjtcclxuICAgICAgICB9IGVsc2UgaWYgKHR5cGUgPT09ICdpZGVudGl0eScpIHtcclxuICAgICAgICAgICAgaW5uZXJGdW4gPSBldmFsdWF0ZUlkZW50aXR5RnVuY3Rpb247XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmtub3duIGZ1bmN0aW9uIHR5cGUgXCInICsgdHlwZSArICdcIicpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKHpvb21BbmRGZWF0dXJlRGVwZW5kZW50KSB7XHJcbiAgICAgICAgICAgIHZhciBmZWF0dXJlRnVuY3Rpb25zID0ge307XHJcbiAgICAgICAgICAgIHZhciBmZWF0dXJlRnVuY3Rpb25TdG9wcyA9IFtdO1xyXG4gICAgICAgICAgICBmb3IgKGxldCBzID0gMDsgcyA8IHBhcmFtZXRlcnMuc3RvcHMubGVuZ3RoOyBzKyspIHtcclxuICAgICAgICAgICAgICAgIHZhciBzdG9wID0gcGFyYW1ldGVycy5zdG9wc1tzXTtcclxuICAgICAgICAgICAgICAgIGlmIChmZWF0dXJlRnVuY3Rpb25zW3N0b3BbMF0uem9vbV0gPT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGZlYXR1cmVGdW5jdGlvbnNbc3RvcFswXS56b29tXSA9IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgem9vbTogc3RvcFswXS56b29tLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBwYXJhbWV0ZXJzLnR5cGUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHByb3BlcnR5OiBwYXJhbWV0ZXJzLnByb3BlcnR5LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBkZWZhdWx0OiBwYXJhbWV0ZXJzLmRlZmF1bHQsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0b3BzOiBbXVxyXG4gICAgICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBmZWF0dXJlRnVuY3Rpb25zW3N0b3BbMF0uem9vbV0uc3RvcHMucHVzaChbc3RvcFswXS52YWx1ZSwgc3RvcFsxXV0pO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBmb3IgKGxldCB6IGluIGZlYXR1cmVGdW5jdGlvbnMpIHtcclxuICAgICAgICAgICAgICAgIGZlYXR1cmVGdW5jdGlvblN0b3BzLnB1c2goW2ZlYXR1cmVGdW5jdGlvbnNbel0uem9vbSwgY3JlYXRlRnVuY3Rpb24oZmVhdHVyZUZ1bmN0aW9uc1t6XSldKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBmdW4gPSBmdW5jdGlvbiAoem9vbSwgZmVhdHVyZSkge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgdmFsdWUgPSBldmFsdWF0ZUV4cG9uZW50aWFsRnVuY3Rpb24oeyBzdG9wczogZmVhdHVyZUZ1bmN0aW9uU3RvcHMsIGJhc2U6IHBhcmFtZXRlcnMuYmFzZSB9LCB6b29tKSh6b29tLCBmZWF0dXJlKTtcclxuICAgICAgICAgICAgICAgIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdmdW5jdGlvbicgPyB2YWx1ZSh6b29tLCBmZWF0dXJlKSA6IHZhbHVlO1xyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICBpc0ZlYXR1cmVDb25zdGFudCA9IGZhbHNlO1xyXG4gICAgICAgICAgICBpc1pvb21Db25zdGFudCA9IGZhbHNlO1xyXG5cclxuICAgICAgICB9IGVsc2UgaWYgKHpvb21EZXBlbmRlbnQpIHtcclxuICAgICAgICAgICAgZnVuID0gZnVuY3Rpb24gKHpvb20pIHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IHZhbHVlID0gaW5uZXJGdW4ocGFyYW1ldGVycywgem9vbSk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdHlwZW9mIHZhbHVlID09PSAnZnVuY3Rpb24nID8gdmFsdWUoem9vbSkgOiB2YWx1ZTtcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgaXNGZWF0dXJlQ29uc3RhbnQgPSB0cnVlO1xyXG4gICAgICAgICAgICBpc1pvb21Db25zdGFudCA9IGZhbHNlO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGZ1biA9IGZ1bmN0aW9uICh6b29tLCBmZWF0dXJlKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCB2YWx1ZSA9IGlubmVyRnVuKHBhcmFtZXRlcnMsIGZlYXR1cmUgPyBmZWF0dXJlW3BhcmFtZXRlcnMucHJvcGVydHldIDogbnVsbCk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdHlwZW9mIHZhbHVlID09PSAnZnVuY3Rpb24nID8gdmFsdWUoem9vbSwgZmVhdHVyZSkgOiB2YWx1ZTtcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgaXNGZWF0dXJlQ29uc3RhbnQgPSBmYWxzZTtcclxuICAgICAgICAgICAgaXNab29tQ29uc3RhbnQgPSB0cnVlO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIGZ1bi5pc1pvb21Db25zdGFudCA9IGlzWm9vbUNvbnN0YW50O1xyXG4gICAgZnVuLmlzRmVhdHVyZUNvbnN0YW50ID0gaXNGZWF0dXJlQ29uc3RhbnQ7XHJcbiAgICByZXR1cm4gZnVuO1xyXG59XHJcblxyXG5mdW5jdGlvbiBjb2FsZXNjZShhLCBiLCBjKSB7XHJcbiAgICBpZiAoYSAhPT0gdW5kZWZpbmVkKSByZXR1cm4gYTtcclxuICAgIGlmIChiICE9PSB1bmRlZmluZWQpIHJldHVybiBiO1xyXG4gICAgaWYgKGMgIT09IHVuZGVmaW5lZCkgcmV0dXJuIGM7XHJcbiAgICByZXR1cm4gbnVsbDtcclxufVxyXG5cclxuZnVuY3Rpb24gZXZhbHVhdGVDYXRlZ29yaWNhbEZ1bmN0aW9uKHBhcmFtZXRlcnMsIGlucHV0KSB7XHJcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHBhcmFtZXRlcnMuc3RvcHMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICBpZiAoaW5wdXQgPT09IHBhcmFtZXRlcnMuc3RvcHNbaV1bMF0pIHtcclxuICAgICAgICAgICAgcmV0dXJuIHBhcmFtZXRlcnMuc3RvcHNbaV1bMV07XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIHBhcmFtZXRlcnMuZGVmYXVsdDtcclxufVxyXG5cclxuZnVuY3Rpb24gZXZhbHVhdGVJbnRlcnZhbEZ1bmN0aW9uKHBhcmFtZXRlcnMsIGlucHV0KSB7XHJcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHBhcmFtZXRlcnMuc3RvcHMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICBpZiAoaW5wdXQgPCBwYXJhbWV0ZXJzLnN0b3BzW2ldWzBdKSBicmVhaztcclxuICAgIH1cclxuICAgIHJldHVybiBwYXJhbWV0ZXJzLnN0b3BzW01hdGgubWF4KGkgLSAxLCAwKV1bMV07XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGV2YWx1YXRlRXhwb25lbnRpYWxGdW5jdGlvbihwYXJhbWV0ZXJzLCBpbnB1dCkge1xyXG4gICAgdmFyIGJhc2UgPSBwYXJhbWV0ZXJzLmJhc2UgIT09IHVuZGVmaW5lZCA/IHBhcmFtZXRlcnMuYmFzZSA6IDE7XHJcblxyXG4gICAgdmFyIGkgPSAwO1xyXG4gICAgd2hpbGUgKHRydWUpIHtcclxuICAgICAgICBpZiAoaSA+PSBwYXJhbWV0ZXJzLnN0b3BzLmxlbmd0aCkgYnJlYWs7XHJcbiAgICAgICAgZWxzZSBpZiAoaW5wdXQgPD0gcGFyYW1ldGVycy5zdG9wc1tpXVswXSkgYnJlYWs7XHJcbiAgICAgICAgZWxzZSBpKys7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGkgPT09IDApIHtcclxuICAgICAgICByZXR1cm4gcGFyYW1ldGVycy5zdG9wc1tpXVsxXTtcclxuXHJcbiAgICB9IGVsc2UgaWYgKGkgPT09IHBhcmFtZXRlcnMuc3RvcHMubGVuZ3RoKSB7XHJcbiAgICAgICAgcmV0dXJuIHBhcmFtZXRlcnMuc3RvcHNbaSAtIDFdWzFdO1xyXG5cclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgcmV0dXJuIGludGVycG9sYXRlKFxyXG4gICAgICAgICAgICBpbnB1dCxcclxuICAgICAgICAgICAgYmFzZSxcclxuICAgICAgICAgICAgcGFyYW1ldGVycy5zdG9wc1tpIC0gMV1bMF0sXHJcbiAgICAgICAgICAgIHBhcmFtZXRlcnMuc3RvcHNbaV1bMF0sXHJcbiAgICAgICAgICAgIHBhcmFtZXRlcnMuc3RvcHNbaSAtIDFdWzFdLFxyXG4gICAgICAgICAgICBwYXJhbWV0ZXJzLnN0b3BzW2ldWzFdXHJcbiAgICAgICAgKTtcclxuICAgIH1cclxufVxyXG5cclxuZnVuY3Rpb24gZXZhbHVhdGVJZGVudGl0eUZ1bmN0aW9uKHBhcmFtZXRlcnMsIGlucHV0KSB7XHJcbiAgICByZXR1cm4gY29hbGVzY2UoaW5wdXQsIHBhcmFtZXRlcnMuZGVmYXVsdCk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGludGVycG9sYXRlKGlucHV0LCBiYXNlLCBpbnB1dExvd2VyLCBpbnB1dFVwcGVyLCBvdXRwdXRMb3dlciwgb3V0cHV0VXBwZXIpIHtcclxuICAgIGlmICh0eXBlb2Ygb3V0cHV0TG93ZXIgPT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICB2YXIgZXZhbHVhdGVkTG93ZXIgPSBvdXRwdXRMb3dlci5hcHBseSh1bmRlZmluZWQsIGFyZ3VtZW50cyk7XHJcbiAgICAgICAgICAgIHZhciBldmFsdWF0ZWRVcHBlciA9IG91dHB1dFVwcGVyLmFwcGx5KHVuZGVmaW5lZCwgYXJndW1lbnRzKTtcclxuICAgICAgICAgICAgcmV0dXJuIGludGVycG9sYXRlKGlucHV0LCBiYXNlLCBpbnB1dExvd2VyLCBpbnB1dFVwcGVyLCBldmFsdWF0ZWRMb3dlciwgZXZhbHVhdGVkVXBwZXIpO1xyXG4gICAgICAgIH07XHJcbiAgICB9IGVsc2UgaWYgKG91dHB1dExvd2VyLmxlbmd0aCkge1xyXG4gICAgICAgIHJldHVybiBpbnRlcnBvbGF0ZUFycmF5KGlucHV0LCBiYXNlLCBpbnB1dExvd2VyLCBpbnB1dFVwcGVyLCBvdXRwdXRMb3dlciwgb3V0cHV0VXBwZXIpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICByZXR1cm4gaW50ZXJwb2xhdGVOdW1iZXIoaW5wdXQsIGJhc2UsIGlucHV0TG93ZXIsIGlucHV0VXBwZXIsIG91dHB1dExvd2VyLCBvdXRwdXRVcHBlcik7XHJcbiAgICB9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGludGVycG9sYXRlTnVtYmVyKGlucHV0LCBiYXNlLCBpbnB1dExvd2VyLCBpbnB1dFVwcGVyLCBvdXRwdXRMb3dlciwgb3V0cHV0VXBwZXIpIHtcclxuICAgIHZhciBkaWZmZXJlbmNlID0gIGlucHV0VXBwZXIgLSBpbnB1dExvd2VyO1xyXG4gICAgdmFyIHByb2dyZXNzID0gaW5wdXQgLSBpbnB1dExvd2VyO1xyXG5cclxuICAgIHZhciByYXRpbztcclxuICAgIGlmIChiYXNlID09PSAxKSB7XHJcbiAgICAgICAgcmF0aW8gPSBwcm9ncmVzcyAvIGRpZmZlcmVuY2U7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIHJhdGlvID0gKE1hdGgucG93KGJhc2UsIHByb2dyZXNzKSAtIDEpIC8gKE1hdGgucG93KGJhc2UsIGRpZmZlcmVuY2UpIC0gMSk7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIChvdXRwdXRMb3dlciAqICgxIC0gcmF0aW8pKSArIChvdXRwdXRVcHBlciAqIHJhdGlvKTtcclxufVxyXG5cclxuZnVuY3Rpb24gaW50ZXJwb2xhdGVBcnJheShpbnB1dCwgYmFzZSwgaW5wdXRMb3dlciwgaW5wdXRVcHBlciwgb3V0cHV0TG93ZXIsIG91dHB1dFVwcGVyKSB7XHJcbiAgICB2YXIgb3V0cHV0ID0gW107XHJcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IG91dHB1dExvd2VyLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgb3V0cHV0W2ldID0gaW50ZXJwb2xhdGVOdW1iZXIoaW5wdXQsIGJhc2UsIGlucHV0TG93ZXIsIGlucHV0VXBwZXIsIG91dHB1dExvd2VyW2ldLCBvdXRwdXRVcHBlcltpXSk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gb3V0cHV0O1xyXG59XHJcblxyXG4vKipcclxuICogQ2hlY2sgaWYgb2JqZWN0IGlzIGEgZGVmaW5pdGlvbiBvZiBmdW5jdGlvbiB0eXBlXHJcbiAqIEBwYXJhbSAge09iamVjdH0gIG9iaiBvYmplY3RcclxuICogQHJldHVybiB7Qm9vbGVhbn1cclxuICogQG1lbWJlck9mIE1hcGJveFV0aWxcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBpc0Z1bmN0aW9uRGVmaW5pdGlvbihvYmopIHtcclxuICAgIHJldHVybiBvYmogJiYgdHlwZW9mIG9iaiA9PT0gJ29iamVjdCcgJiYgKG9iai5zdG9wcyB8fCBvYmoucHJvcGVydHkgJiYgb2JqLnR5cGUgPT09ICdpZGVudGl0eScpO1xyXG59XHJcblxyXG4vKipcclxuICogQ2hlY2sgaWYgb2JqJ3MgcHJvcGVydGllcyBoYXMgZnVuY3Rpb24gZGVmaW5pdGlvblxyXG4gKiBAcGFyYW0gIHtPYmplY3R9ICBvYmogb2JqZWN0IHRvIGNoZWNrXHJcbiAqIEByZXR1cm4ge0Jvb2xlYW59XHJcbiAqIEBtZW1iZXJPZiBNYXBib3hVdGlsXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gaGFzRnVuY3Rpb25EZWZpbml0aW9uKG9iaikge1xyXG4gICAgZm9yIChjb25zdCBwIGluIG9iaikge1xyXG4gICAgICAgIGlmIChpc0Z1bmN0aW9uRGVmaW5pdGlvbihvYmpbcF0pKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIHJldHVybiBmYWxzZTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGludGVycG9sYXRlZChwYXJhbWV0ZXJzKSB7XHJcbiAgICByZXR1cm4gY3JlYXRlRnVuY3Rpb24xKHBhcmFtZXRlcnMsICdleHBvbmVudGlhbCcpO1xyXG59XHJcblxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHBpZWNld2lzZUNvbnN0YW50KHBhcmFtZXRlcnMpIHtcclxuICAgIHJldHVybiBjcmVhdGVGdW5jdGlvbjEocGFyYW1ldGVycywgJ2ludGVydmFsJyk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBMb2FkIGZ1bmN0aW9uIHR5cGVzIGRlZmluZWQgaW4gb2JqZWN0XHJcbiAqIEBwYXJhbSAge09iamVjdFtdfSBwYXJhbWV0ZXJzIHBhcmFtZXRlcnNcclxuICogQHJldHVybiB7T2JqZWN0fSAgIGxvYWRlZCBvYmplY3RcclxuICogQG1lbWJlck9mIE1hcGJveFV0aWxcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBsb2FkRnVuY3Rpb25UeXBlcyhvYmosIGFyZ0ZuKSB7XHJcbiAgICBpZiAoIW9iaikge1xyXG4gICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgfVxyXG4gICAgdmFyIGhpdCA9IGZhbHNlO1xyXG4gICAgaWYgKEFycmF5LmlzQXJyYXkob2JqKSkge1xyXG4gICAgICAgIHZhciBtdWx0UmVzdWx0ID0gW10sXHJcbiAgICAgICAgICAgIGxvYWRlZDtcclxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG9iai5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICBsb2FkZWQgPSBsb2FkRnVuY3Rpb25UeXBlcyhvYmpbaV0sIGFyZ0ZuKTtcclxuICAgICAgICAgICAgaWYgKCFsb2FkZWQpIHtcclxuICAgICAgICAgICAgICAgIG11bHRSZXN1bHQucHVzaChvYmpbaV0pO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgbXVsdFJlc3VsdC5wdXNoKGxvYWRlZCk7XHJcbiAgICAgICAgICAgICAgICBoaXQgPSB0cnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBoaXQgPyBtdWx0UmVzdWx0IDogb2JqO1xyXG4gICAgfVxyXG4gICAgdmFyIHJlc3VsdCA9IHtcclxuICAgICAgICAgICAgJ19fZm5fdHlwZXNfbG9hZGVkJyA6IHRydWVcclxuICAgICAgICB9LFxyXG4gICAgICAgIHByb3BzID0gW10sXHJcbiAgICAgICAgcDtcclxuICAgIGZvciAocCBpbiBvYmopIHtcclxuICAgICAgICBpZiAob2JqLmhhc093blByb3BlcnR5KHApKSB7XHJcbiAgICAgICAgICAgIHByb3BzLnB1c2gocCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGJ1aWxkRm4gPSBmdW5jdGlvbiAocCkge1xyXG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShyZXN1bHQsIHAsIHtcclxuICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoIXRoaXNbJ19fZm5fJyArIHBdKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpc1snX19mbl8nICsgcF0gPSBpbnRlcnBvbGF0ZWQodGhpc1snXycgKyBwXSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpc1snX19mbl8nICsgcF0uYXBwbHkodGhpcywgYXJnRm4oKSk7XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHNldDogZnVuY3Rpb24gKHYpIHtcclxuICAgICAgICAgICAgICAgIHRoaXNbJ18nICsgcF0gPSB2O1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXHJcbiAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWVcclxuICAgICAgICB9KTtcclxuICAgIH07XHJcblxyXG4gICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHByb3BzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XHJcbiAgICAgICAgcCA9IHByb3BzW2ldO1xyXG4gICAgICAgIGlmIChpc0Z1bmN0aW9uRGVmaW5pdGlvbihvYmpbcF0pKSB7XHJcbiAgICAgICAgICAgIGhpdCA9IHRydWU7XHJcbiAgICAgICAgICAgIHJlc3VsdFsnXycgKyBwXSA9IG9ialtwXTtcclxuICAgICAgICAgICAgYnVpbGRGbihwKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICByZXN1bHRbcF0gPSBvYmpbcF07XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIGhpdCA/IHJlc3VsdCA6IG9iajtcclxufVxyXG5cclxuLyoqXHJcbiAqIEdldCBleHRlcm5hbCByZXNvdXJjZXMgaW4gdGhlIGZ1bmN0aW9uIHR5cGVcclxuICogQHBhcmFtICB7T2JqZWN0fSB0IEZ1bmN0aW9uIHR5cGUgZGVmaW5pdGlvblxyXG4gKiBAcmV0dXJuIHtTdHJpbmdbXX0gICByZXNvdWNlc1xyXG4gKiBAbWVtYmVyT2YgTWFwYm94VXRpbFxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGdldEZ1bmN0aW9uVHlwZVJlc291cmNlcyh0KSB7XHJcbiAgICBpZiAoIXQgfHwgIXQuc3RvcHMpIHtcclxuICAgICAgICByZXR1cm4gW107XHJcbiAgICB9XHJcbiAgICBjb25zdCByZXMgPSBbXTtcclxuICAgIGZvciAobGV0IGkgPSAwLCBsID0gdC5zdG9wcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcclxuICAgICAgICByZXMucHVzaCh0LnN0b3BzW2ldWzFdKTtcclxuICAgIH1cclxuICAgIHJldHVybiByZXM7XHJcbn1cclxuLyplc2xpbnQtZW5hYmxlIG5vLXZhciwgcHJlZmVyLWNvbnN0Ki9cclxuXHJcbmZ1bmN0aW9uIGNyZWF0ZUZ1bmN0aW9uMShwYXJhbWV0ZXJzLCBkZWZhdWx0VHlwZSkge1xyXG4gICAgaWYgKCFpc0Z1bmN0aW9uRGVmaW5pdGlvbihwYXJhbWV0ZXJzKSkge1xyXG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAoKSB7IHJldHVybiBwYXJhbWV0ZXJzOyB9O1xyXG4gICAgfVxyXG4gICAgcGFyYW1ldGVycyA9IEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkocGFyYW1ldGVycykpO1xyXG4gICAgbGV0IGlzWm9vbUNvbnN0YW50ID0gdHJ1ZTtcclxuICAgIGxldCBpc0ZlYXR1cmVDb25zdGFudCA9IHRydWU7XHJcbiAgICBjb25zdCBzdG9wcyA9IHBhcmFtZXRlcnMuc3RvcHM7XHJcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHN0b3BzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgaWYgKGlzRnVuY3Rpb25EZWZpbml0aW9uKHN0b3BzW2ldWzFdKSkge1xyXG4gICAgICAgICAgICBjb25zdCBmbiA9IGNyZWF0ZUZ1bmN0aW9uKHN0b3BzW2ldWzFdLCBkZWZhdWx0VHlwZSk7XHJcbiAgICAgICAgICAgIGlzWm9vbUNvbnN0YW50ID0gaXNab29tQ29uc3RhbnQgJiYgZm4uaXNab29tQ29uc3RhbnQ7XHJcbiAgICAgICAgICAgIGlzRmVhdHVyZUNvbnN0YW50ID0gaXNGZWF0dXJlQ29uc3RhbnQgJiYgZm4uaXNGZWF0dXJlQ29uc3RhbnQ7XHJcbiAgICAgICAgICAgIHN0b3BzW2ldID0gW3N0b3BzW2ldWzBdLCBmbl07XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgY29uc3QgZm4gPSBjcmVhdGVGdW5jdGlvbihwYXJhbWV0ZXJzLCBkZWZhdWx0VHlwZSk7XHJcbiAgICBmbi5pc1pvb21Db25zdGFudCA9IGlzWm9vbUNvbnN0YW50ICYmIGZuLmlzWm9vbUNvbnN0YW50O1xyXG4gICAgZm4uaXNGZWF0dXJlQ29uc3RhbnQgPSBpc0ZlYXR1cmVDb25zdGFudCAmJiBmbi5pc0ZlYXR1cmVDb25zdGFudDtcclxuICAgIHJldHVybiBmbjtcclxufVxyXG4iLCJpbXBvcnQgeyBDbGFzcywgRXZlbnRhYmxlLCBIYW5kbGVyYWJsZSwgQ29vcmRpbmF0ZSwgVXRpbCB9IGZyb20gJ21hcHRhbGtzJztcclxuaW1wb3J0ICogYXMgZ2x0ZiBmcm9tICdAbWFwdGFsa3MvZ2x0Zi1sb2FkZXInO1xyXG5pbXBvcnQgeyBtYXQ0LCBxdWF0LCB2ZWMzIH0gZnJvbSAnQG1hcHRhbGtzL2dsJztcclxuaW1wb3J0IHsgaXNFbXB0eU9iamVjdCwgZGVmaW5lZCB9IGZyb20gJy4vY29tbW9uL1V0aWwnO1xyXG5pbXBvcnQgeyBsb2FkRnVuY3Rpb25UeXBlcywgaGFzRnVuY3Rpb25EZWZpbml0aW9uIH0gZnJvbSAnQG1hcHRhbGtzL2Z1bmN0aW9uLXR5cGUnO1xyXG5cclxuY29uc3QgREVGQVVMVF9ST1RBVElPTiA9IFswLCAwLCAwXTtcclxuLy9jb25zdCBERUZBVUxUX0FYSVMgPSBbMCwgMCwgMV07XHJcblxyXG5jb25zdCBvcHRpb25zID0ge1xyXG4gICAgdmlzaWJsZSA6IHRydWVcclxufTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEdMVEZNYXJrZXIgZXh0ZW5kcyBFdmVudGFibGUoSGFuZGxlcmFibGUoQ2xhc3MpKSB7XHJcbiAgICBjb25zdHJ1Y3Rvcihjb29yZGluYXRlcywgb3B0aW9ucykge1xyXG4gICAgICAgIC8vb3B0aW9uc+WinuWKoHNoYWRlcuWtl+autVxyXG4gICAgICAgIHN1cGVyKG9wdGlvbnMpO1xyXG4gICAgICAgIGlmIChjb29yZGluYXRlcykge1xyXG4gICAgICAgICAgICB0aGlzLnNldENvb3JkaW5hdGVzKGNvb3JkaW5hdGVzKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5fbG9hZGVkID0gZmFsc2U7XHJcbiAgICAgICAgdGhpcy5faW5pdFN5bWJvbCgpO1xyXG4gICAgICAgIHRoaXMuX3VwZGF0ZU1hdHJpeCgpO1xyXG4gICAgICAgIHRoaXMuX3R5cGUgPSAnZ2x0Zm1hcmtlcic7XHJcbiAgICB9XHJcblxyXG4gICAgc3RhdGljIGZyb21KU09OKGpzb24pIHtcclxuICAgICAgICByZXR1cm4gbmV3IEdMVEZNYXJrZXIoanNvbi5jb29yZGluYXRlcywganNvbi5vcHRpb25zKTtcclxuICAgIH1cclxuXHJcbiAgICBfbG9hZERhdGEoKSB7XHJcbiAgICAgICAgY29uc3QgdXJsID0gdGhpcy5nZXRVcmwoKTtcclxuICAgICAgICBjb25zdCBpbmRleCA9IHVybC5sYXN0SW5kZXhPZignLycpO1xyXG4gICAgICAgIGNvbnN0IHJvb3QgPSB1cmwuc2xpY2UoMCwgaW5kZXgpO1xyXG4gICAgICAgIGNvbnN0IHBvc3RmaXggPSB1cmwuc2xpY2UodXJsLmxhc3RJbmRleE9mKCcuJykpO1xyXG4gICAgICAgIGlmIChwb3N0Zml4ID09PSAnLmdsdGYnKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBnbHRmLkFqYXguZ2V0SlNPTih1cmwsIHt9KS50aGVuKChqc29uKSA9PiB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLl9nbHRmanNvbiA9IGpzb247XHJcbiAgICAgICAgICAgICAgICBjb25zdCBsb2FkZXIgPSBuZXcgZ2x0Zi5HTFRGTG9hZGVyKHJvb3QsIGpzb24pO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2V4cG9ydEdMVEZEYXRhKGxvYWRlcik7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0gZWxzZSBpZiAocG9zdGZpeCA9PT0gJy5nbGInKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBnbHRmLkFqYXguZ2V0QXJyYXlCdWZmZXIodXJsLCB7fSkudGhlbihqc29uID0+IHtcclxuICAgICAgICAgICAgICAgIHRoaXMuX2dsdGZqc29uID0ganNvbjtcclxuICAgICAgICAgICAgICAgIGNvbnN0IGxvYWRlciA9IG5ldyBnbHRmLkdMVEZMb2FkZXIocm9vdCwgeyBidWZmZXIgOiBqc29uLmRhdGEsIGJ5dGVPZmZzZXQgOiAwIH0pO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2V4cG9ydEdMVEZEYXRhKGxvYWRlcik7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgIH1cclxuXHJcbiAgICBfZXhwb3J0R0xURkRhdGEobG9hZGVyKSB7XHJcbiAgICAgICAgcmV0dXJuIGxvYWRlci5sb2FkKCkudGhlbihnbHRmRGF0YSA9PiB7XHJcbiAgICAgICAgICAgIHRoaXMuX3NldEdMVEZEYXRhKGdsdGZEYXRhKTtcclxuICAgICAgICAgICAgcmV0dXJuIGdsdGZEYXRhO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIF9pbml0U3ltYm9sKCkge1xyXG4gICAgICAgIGlmICh0aGlzLm9wdGlvbnMuc3ltYm9sKSB7XHJcbiAgICAgICAgICAgIHRoaXMuc2V0U3ltYm9sKHRoaXMub3B0aW9ucy5zeW1ib2wpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHRoaXMub3B0aW9ucy5zeW1ib2wgPSB7fTtcclxuICAgICAgICAgICAgdGhpcy5fZXh0ZXJuU3ltYm9sID0ge307XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIF9nZXRHTFRGRGF0YSgpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5fZ2x0ZkRhdGE7XHJcbiAgICB9XHJcblxyXG4gICAgX3NldEdMVEZEYXRhKGRhdGEpIHtcclxuICAgICAgICB0aGlzLl9nbHRmRGF0YSA9IGRhdGE7XHJcbiAgICB9XHJcblxyXG4gICAgX2dldEdMVEZKc29uKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLl9nbHRmanNvbjtcclxuICAgIH1cclxuXHJcbiAgICBfc2V0UHJvcEluU3ltYm9sKHByb3AsIHZhbHVlKSB7XHJcbiAgICAgICAgdGhpcy5vcHRpb25zLnN5bWJvbCA9IHRoaXMub3B0aW9ucy5zeW1ib2wgfHwge307XHJcbiAgICAgICAgdGhpcy5vcHRpb25zLnN5bWJvbFtwcm9wXSA9IHZhbHVlO1xyXG4gICAgfVxyXG5cclxuICAgIF9zZXRQcm9wSW5FeHRlcm5TeW1ib2wocHJvcCwgdmFsdWUpIHtcclxuICAgICAgICB0aGlzLl9leHRlcm5TeW1ib2wgPSB0aGlzLl9leHRlcm5TeW1ib2wgfHwge307XHJcbiAgICAgICAgdGhpcy5fZXh0ZXJuU3ltYm9sW3Byb3BdID0gdmFsdWU7XHJcbiAgICB9XHJcblxyXG4gICAgZ2V0TWFwKCkge1xyXG4gICAgICAgIGlmICghdGhpcy5fbGF5ZXIpIHtcclxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiB0aGlzLl9sYXllci5nZXRNYXAoKTtcclxuICAgIH1cclxuXHJcbiAgICBnZXRMYXllcigpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5fbGF5ZXI7XHJcbiAgICB9XHJcblxyXG4gICAgc2V0VXJsKHVybCkge1xyXG4gICAgICAgIGNvbnN0IG9sZFVybCA9IHRoaXMuZ2V0VXJsKCk7XHJcbiAgICAgICAgdGhpcy5fc2V0UHJvcEluU3ltYm9sKCd1cmwnLCB1cmwpO1xyXG4gICAgICAgIGlmICh0aGlzLl9sYXllcikge1xyXG4gICAgICAgICAgICB0aGlzLl9sYXllci5fbG9hZEdMVEZEYXRhKHRoaXMpLnRoZW4oKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgLy/mo4Dmn6VHTFRGTWFya2Vy5omA5ZyobGF5ZXLnmoRyZXF1ZXN0c+WSjGdlb21ldHJpZXPmmK/lkKbpnIDopoHliKDpmaRcclxuICAgICAgICAgICAgICAgIHRoaXMuX2xheWVyLl9yZW1vdmVHTFRGUmVxdWVzdHMob2xkVXJsKTtcclxuICAgICAgICAgICAgICAgIHRoaXMuZmlyZSgnc2V0VXJsLWRlYnVnJyk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLl9kaXJ0eSA9IHRydWU7XHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9XHJcblxyXG4gICAgZ2V0VXJsKCkge1xyXG4gICAgICAgIGNvbnN0IHN5bWJvbCA9IHRoaXMuX2dldEludGVybmFsU3ltYm9sKCkgfHwge307XHJcbiAgICAgICAgcmV0dXJuIHN5bWJvbC51cmwgfHwgJ3NwaGVyZSc7XHJcbiAgICB9XHJcblxyXG4gICAgYWRkVG8obGF5ZXIpIHtcclxuICAgICAgICBpZiAodGhpcy5fbGF5ZXIpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdHTFRGTWFya2VyIGNhbm5vdCBiZSBhZGRlZCB0byB0d28gb3IgbW9yZSBsYXllcnMgYXQgdGhlIHNhbWUgdGltZS4nKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5fbGF5ZXIgPSBsYXllcjtcclxuICAgICAgICB0aGlzLl9sYXllci5hZGRNYXJrZXIodGhpcyk7XHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9XHJcblxyXG4gICAgcmVtb3ZlKCkge1xyXG4gICAgICAgIGlmICh0aGlzLl9sYXllcikge1xyXG4gICAgICAgICAgICB0aGlzLl9sYXllci5yZW1vdmVNYXJrZXIodGhpcyk7XHJcbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzLl9sYXllcjtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgc2hvdygpIHtcclxuICAgICAgICB0aGlzLm9wdGlvbnMudmlzaWJsZSA9IHRydWU7XHJcbiAgICAgICAgdGhpcy5fZGlydHkgPSB0cnVlO1xyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfVxyXG5cclxuICAgIGhpZGUoKSB7XHJcbiAgICAgICAgdGhpcy5vcHRpb25zLnZpc2libGUgPSBmYWxzZTtcclxuICAgICAgICB0aGlzLl9kaXJ0eSA9IHRydWU7XHJcbiAgICB9XHJcblxyXG4gICAgaXNWaXNpYmxlKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLm9wdGlvbnMudmlzaWJsZTtcclxuICAgIH1cclxuXHJcbiAgICBnZXRDb29yZGluYXRlcygpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5fY29vcmRpbmF0ZXM7XHJcbiAgICB9XHJcblxyXG4gICAgLy/mlK/mjIHmlbDnu4RbeCwgeV3lkoxtYXB0YWxrcy5Db29yZGluYXRl5Lik56eN5b2i5byPXHJcbiAgICBzZXRDb29yZGluYXRlcyhjb29yZGluYXRlcykge1xyXG4gICAgICAgIGlmIChBcnJheS5pc0FycmF5KGNvb3JkaW5hdGVzKSkge1xyXG4gICAgICAgICAgICB0aGlzLl9jb29yZGluYXRlcyA9IG5ldyBDb29yZGluYXRlKGNvb3JkaW5hdGVzKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICB0aGlzLl9jb29yZGluYXRlcyA9IGNvb3JkaW5hdGVzO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLl9kaXJ0eSA9IHRydWU7XHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9XHJcblxyXG4gICAgY29weSgpIHtcclxuICAgICAgICBjb25zdCBqc29uRGF0YSA9IHRoaXMudG9KU09OKCk7XHJcbiAgICAgICAgcmV0dXJuIEdMVEZNYXJrZXIuZnJvbUpTT04oanNvbkRhdGEpO1xyXG4gICAgfVxyXG5cclxuICAgIHNldElkKGlkKSB7XHJcbiAgICAgICAgdGhpcy5vcHRpb25zLmlkID0gaWQ7XHJcbiAgICB9XHJcblxyXG4gICAgZ2V0SWQoKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMub3B0aW9ucy5pZDtcclxuICAgIH1cclxuXHJcbiAgICAvL+iuvue9rnNoYWRlcuWQju+8jOmcgOimgeWwhm1hcmtlcuaJgOWxnnNoYWRlcuabtOaWsFxyXG4gICAgc2V0U2hhZGVyKHNoYWRlcikge1xyXG4gICAgICAgIC8vIGNvbnN0IG9sZCA9IHRoaXMuZ2V0U2hhZGVyKCk7XHJcbiAgICAgICAgdGhpcy5vcHRpb25zLnN5bWJvbC5zaGFkZXIgPSBzaGFkZXI7XHJcbiAgICAgICAgaWYgKHRoaXMuX2xheWVyKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2xheWVyLl91cGRhdGVHZW9tZXRyaWVzKHRoaXMpO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLl9kaXJ0eSA9IHRydWU7XHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9XHJcblxyXG4gICAgZ2V0U2hhZGVyKCkge1xyXG4gICAgICAgIGNvbnN0IHN5bWJvbCA9IHRoaXMuX2dldEludGVybmFsU3ltYm9sKCkgfHwge307XHJcbiAgICAgICAgcmV0dXJuIHN5bWJvbC5zaGFkZXIgfHwgJ3Bob25nJztcclxuICAgIH1cclxuXHJcbiAgICBzZXRVbmlmb3Jtcyh1bmlmb3Jtcykge1xyXG4gICAgICAgIHRoaXMub3B0aW9ucy5zeW1ib2wudW5pZm9ybXMgPSBVdGlsLmV4dGVuZCh7fSwgdW5pZm9ybXMpO1xyXG4gICAgICAgIHRoaXMuX2RpcnR5ID0gdHJ1ZTtcclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH1cclxuXHJcbiAgICBnZXRVbmlmb3JtcygpIHtcclxuICAgICAgICBjb25zdCBzeW1ib2wgPSB0aGlzLl9nZXRJbnRlcm5hbFN5bWJvbCgpIHx8IHt9O1xyXG4gICAgICAgIHJldHVybiBzeW1ib2wudW5pZm9ybXM7XHJcbiAgICB9XHJcblxyXG4gICAgc2V0VW5pZm9ybShrZXksIHZhbHVlKSB7XHJcbiAgICAgICAgY29uc3Qgc3ltYm9sID0gdGhpcy5vcHRpb25zLnN5bWJvbDtcclxuICAgICAgICBpZiAoIXN5bWJvbC51bmlmb3Jtcykge1xyXG4gICAgICAgICAgICBzeW1ib2wudW5pZm9ybXMgPSB7fTtcclxuICAgICAgICB9XHJcbiAgICAgICAgc3ltYm9sLnVuaWZvcm1zW2tleV0gPSB2YWx1ZTtcclxuICAgICAgICB0aGlzLl9kaXJ0eSA9IHRydWU7XHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9XHJcblxyXG4gICAgZ2V0VW5pZm9ybShrZXkpIHtcclxuICAgICAgICBjb25zdCBzeW1ib2wgPSB0aGlzLl9nZXRJbnRlcm5hbFN5bWJvbCgpIHx8IHt9O1xyXG4gICAgICAgIGlmICghc3ltYm9sLnVuaWZvcm1zKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gc3ltYm9sLnVuaWZvcm1zW2tleV07XHJcbiAgICB9XHJcblxyXG4gICAgLy/lop7liqDlr7nmnZDotKjnmoTmlK/mjIFcclxuICAgIHNldE1hdGVyaWFsKG1hdGVyaWFsKSB7XHJcbiAgICAgICAgdGhpcy5vcHRpb25zLnN5bWJvbC5tYXRlcmlhbCA9IG1hdGVyaWFsO1xyXG4gICAgICAgIHRoaXMuX2RpcnR5ID0gdHJ1ZTtcclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH1cclxuXHJcbiAgICBnZXRNYXRlcmlhbCgpIHtcclxuICAgICAgICBjb25zdCBzeW1ib2wgPSB0aGlzLl9nZXRJbnRlcm5hbFN5bWJvbCgpIHx8IHt9O1xyXG4gICAgICAgIHJldHVybiBzeW1ib2wubWF0ZXJpYWw7XHJcbiAgICB9XHJcblxyXG4gICAgaXNBbmltYXRlZCgpIHtcclxuICAgICAgICBjb25zdCBzeW1ib2wgPSB0aGlzLl9nZXRJbnRlcm5hbFN5bWJvbCgpIHx8IHt9O1xyXG4gICAgICAgIHJldHVybiBzeW1ib2wuYW5pbWF0aW9uICYmIHRoaXMuX2dsdGZEYXRhICYmIHRoaXMuX2dsdGZEYXRhLmFuaW1hdGlvbnM7XHJcbiAgICB9XHJcblxyXG4gICAgc2V0QW5pbWF0aW9uKGlzQW5pbWF0aW9uKSB7XHJcbiAgICAgICAgdGhpcy5fZGlydHkgPSB0cnVlO1xyXG4gICAgICAgIHRoaXMub3B0aW9ucy5zeW1ib2wuYW5pbWF0aW9uID0gaXNBbmltYXRpb247XHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9XHJcblxyXG4gICAgc2V0QW5pbWF0aW9ubG9vcChsb29wZWQpIHtcclxuICAgICAgICB0aGlzLm9wdGlvbnMuc3ltYm9sLmxvb3AgPSBsb29wZWQ7XHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9XHJcblxyXG4gICAgaXNMb29wZWQoKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMub3B0aW9ucy5zeW1ib2wubG9vcDtcclxuICAgIH1cclxuXHJcbiAgICBnZXRBbmltYXRpb25TcGVlZCgpIHtcclxuICAgICAgICBjb25zdCBzeW1ib2wgPSB0aGlzLl9nZXRJbnRlcm5hbFN5bWJvbCgpIHx8IHt9O1xyXG4gICAgICAgIHJldHVybiBzeW1ib2wuc3BlZWQgfHwgMS4wO1xyXG4gICAgfVxyXG5cclxuICAgIHNldEFuaW1hdGlvblNwZWVkKHNwZWVkKSB7XHJcbiAgICAgICAgdGhpcy5vcHRpb25zLnN5bWJvbC5zcGVlZCA9IHNwZWVkO1xyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfVxyXG5cclxuICAgIF9nZXRQb3NpdGlvbihjb29yZGluYXRlKSB7XHJcbiAgICAgICAgY29uc3QgbWFwID0gdGhpcy5nZXRNYXAoKTtcclxuICAgICAgICBpZiAobWFwKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBjb29yZGluYXRlVG9Xb3JsZChtYXAsIGNvb3JkaW5hdGUgfHwgdGhpcy5nZXRDb29yZGluYXRlcygpKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICB9XHJcblxyXG4gICAgc2V0VHJhbnNsYXRpb24odHJhbnNsYXRpb24pIHtcclxuICAgICAgICB0aGlzLm9wdGlvbnMuc3ltYm9sLnRyYW5zbGF0aW9uID0gdHJhbnNsYXRpb24gfHwgWzAsIDAsIDBdO1xyXG4gICAgICAgIHRoaXMuX3VwZGF0ZU1hdHJpeCgpO1xyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfVxyXG5cclxuICAgIGdldFRyYW5zbGF0aW9uKCkge1xyXG4gICAgICAgIGNvbnN0IHN5bWJvbCA9IHRoaXMuX2dldEludGVybmFsU3ltYm9sKCkgfHwge307XHJcbiAgICAgICAgcmV0dXJuIHN5bWJvbC50cmFuc2xhdGlvbiB8fCBbMCwgMCwgMF07XHJcbiAgICB9XHJcblxyXG4gICAgX2dldFdvcmxkVHJhbnNsYXRpb24oKSB7XHJcbiAgICAgICAgY29uc3QgdHJhbnMgPSB0aGlzLmdldFRyYW5zbGF0aW9uKCk7XHJcbiAgICAgICAgY29uc3QgcG9zaXRpb24gPSB0aGlzLl9nZXRQb3NpdGlvbigpO1xyXG4gICAgICAgIGlmIChwb3NpdGlvbikge1xyXG4gICAgICAgICAgICByZXR1cm4gdmVjMy5hZGQoW10sIHRyYW5zLCBwb3NpdGlvbik7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiB0cmFucztcclxuICAgIH1cclxuXHJcbiAgICBzZXRSb3RhdGlvbih4QW5nbGUsIHlBbmdsZSwgekFuZ2xlKSB7XHJcbiAgICAgICAgdGhpcy5vcHRpb25zLnN5bWJvbC5yb3RhdGlvbiA9IFt4QW5nbGUsIHlBbmdsZSwgekFuZ2xlXTtcclxuICAgICAgICB0aGlzLl91cGRhdGVNYXRyaXgoKTtcclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH1cclxuXHJcbiAgICBnZXRSb3RhdGlvbigpIHtcclxuICAgICAgICBjb25zdCBzeW1ib2wgPSB0aGlzLl9nZXRJbnRlcm5hbFN5bWJvbCgpIHx8IHt9O1xyXG4gICAgICAgIHJldHVybiBzeW1ib2wucm90YXRpb24gfHwgREVGQVVMVF9ST1RBVElPTjtcclxuICAgIH1cclxuXHJcbiAgICAvL1RPRE9cclxuICAgIC8v57uV6L205peL6L2s55qE5pa55rOV5pqC5pe25LiN5o+Q5L6b77yM6ZyA6KaB55+l6YGT5bCG5Zub5YWD5pWw57uE5Y+N6Kej5Li65qyn5ouJ6KeS55qE5pa55rOVXHJcbiAgICAvLyByb3RhdGVBcm91bmQoYW5nbGUsIGF4aXMpIHtcclxuICAgIC8vICAgICBjb25zdCBvdXQgPSBbXTtcclxuICAgIC8vICAgICBjb25zdCByb3RhdGlvbkFyb3VuZCA9IHF1YXQuc2V0QXhpc0FuZ2xlKG91dCwgYXhpcyB8fCBERUZBVUxUX0FYSVMsICBhbmdsZSB8fCAwKTtcclxuICAgIC8vICAgICB0aGlzLm9wdGlvbnMuc3ltYm9sLnJvdGF0aW9uID0gcXVhdC5tdWx0aXBseShvdXQsIHJvdGF0aW9uQXJvdW5kLCB0aGlzLm9wdGlvbnMuc3ltYm9sLnJvdGF0aW9uIHx8IERFRkFVTFRfUk9UQVRJT04pO1xyXG4gICAgLy8gICAgIHRoaXMuX3VwZGF0ZU1hdHJpeCgpO1xyXG4gICAgLy8gICAgIHJldHVybiB0aGlzO1xyXG4gICAgLy8gfVxyXG5cclxuICAgIHNldFNjYWxlKHNjYWxlKSB7XHJcbiAgICAgICAgdGhpcy5vcHRpb25zLnN5bWJvbC5zY2FsZSA9IHNjYWxlIHx8IFsxLCAxLCAxXTtcclxuICAgICAgICB0aGlzLl91cGRhdGVNYXRyaXgoKTtcclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH1cclxuXHJcbiAgICBnZXRTY2FsZSgpIHtcclxuICAgICAgICBjb25zdCBzeW1ib2wgPSB0aGlzLl9nZXRJbnRlcm5hbFN5bWJvbCgpIHx8IHt9O1xyXG4gICAgICAgIHJldHVybiBzeW1ib2wuc2NhbGUgfHwgWzEsIDEsIDFdO1xyXG4gICAgfVxyXG5cclxuICAgIHNldFN5bWJvbChzeW1ib2wpIHtcclxuICAgICAgICB0aGlzLl9jaGVja1VybChzeW1ib2wpO1xyXG4gICAgICAgIHRoaXMub3B0aW9ucy5zeW1ib2wgPSB0aGlzLl9wcmVwYXJlU3ltYm9sKHN5bWJvbCk7XHJcbiAgICAgICAgdGhpcy5fb25TeW1ib2xDaGFuZ2VkKCk7XHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9XHJcblxyXG4gICAgZ2V0U3ltYm9sKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLm9wdGlvbnMuc3ltYm9sO1xyXG4gICAgfVxyXG5cclxuICAgIF9zZXRFeHRlcm5TeW1ib2woc3ltYm9sKSB7XHJcbiAgICAgICAgdGhpcy5fZXh0ZXJuU3ltYm9sID0gdGhpcy5fcHJlcGFyZVN5bWJvbChzeW1ib2wpO1xyXG4gICAgICAgIHRoaXMuX29uU3ltYm9sQ2hhbmdlZCgpO1xyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfVxyXG5cclxuICAgIF9nZXRJbnRlcm5hbFN5bWJvbCgpIHtcclxuICAgICAgICBsZXQgc3ltYm9sID0gbnVsbDtcclxuICAgICAgICBpZiAoIWlzRW1wdHlPYmplY3QodGhpcy5vcHRpb25zLnN5bWJvbCkpIHtcclxuICAgICAgICAgICAgc3ltYm9sID0gdGhpcy5vcHRpb25zLnN5bWJvbDtcclxuICAgICAgICB9IGVsc2UgaWYgKCFpc0VtcHR5T2JqZWN0KHRoaXMuX2V4dGVyblN5bWJvbCkpIHtcclxuICAgICAgICAgICAgc3ltYm9sID0gdGhpcy5fZXh0ZXJuU3ltYm9sO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gc3ltYm9sO1xyXG4gICAgfVxyXG5cclxuICAgIF9sb2FkRnVuY3Rpb25UeXBlcyhvYmopIHtcclxuICAgICAgICByZXR1cm4gbG9hZEZ1bmN0aW9uVHlwZXMob2JqLCAoKSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnN0IG1hcCA9IHRoaXMuZ2V0TWFwKCk7XHJcbiAgICAgICAgICAgIGlmIChtYXApIHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IHpvb20gPSBtYXAuZ2V0Wm9vbSgpO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIFt6b29tXTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgX3ByZXBhcmVTeW1ib2woc3ltYm9sKSB7XHJcbiAgICAgICAgY29uc3QgY29weVN5bWJvbCA9IEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkoc3ltYm9sKSk7XHJcbiAgICAgICAgY29uc3QgZnVuY3Rpb25TeW1ib2wgPSB0aGlzLl9sb2FkRnVuY3Rpb25UeXBlcyhjb3B5U3ltYm9sKTtcclxuICAgICAgICBpZiAoZnVuY3Rpb25TeW1ib2wgJiYgZnVuY3Rpb25TeW1ib2wudW5pZm9ybXMpIHtcclxuICAgICAgICAgICAgZnVuY3Rpb25TeW1ib2wudW5pZm9ybXMgPSB0aGlzLl9sb2FkRnVuY3Rpb25UeXBlcyhzeW1ib2wudW5pZm9ybXMpO1xyXG4gICAgICAgIH1cclxuICAgICAgICAvL+WmguaenOmHjeaWsOaUueWPmOi/h3N5bWJvbO+8jOWIoOmZpOe8k+WtmOi/h+eahGhhc0Z1bmN0aW9uRGVmaW5pdGlvbue7k+aenFxyXG4gICAgICAgIGRlbGV0ZSB0aGlzLl9oYXNGdW5jRGVmaW5pdGlvbjtcclxuICAgICAgICByZXR1cm4gZnVuY3Rpb25TeW1ib2w7XHJcbiAgICB9XHJcblxyXG4gICAgaGFzRnVuY3Rpb25EZWZpbml0aW9uKCkge1xyXG4gICAgICAgIC8v57yT5a2YaGFzRnVjdGlvbkRlZmluaXRpb27nmoTnu5PmnpzvvIzku6XlhY3lpJrmrKHpgY3ljoZzeW1ib2xcclxuICAgICAgICBpZiAoZGVmaW5lZCh0aGlzLl9oYXNGdW5jRGVmaW5pdGlvbikpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2hhc0Z1bmNEZWZpbml0aW9uO1xyXG4gICAgICAgIH1cclxuICAgICAgICBjb25zdCBzeW1ib2wgPSB0aGlzLl9nZXRJbnRlcm5hbFN5bWJvbCgpO1xyXG4gICAgICAgIHRoaXMuX2hhc0Z1bmNEZWZpbml0aW9uID0gKGhhc0Z1bmN0aW9uRGVmaW5pdGlvbihzeW1ib2wpIHx8IChzeW1ib2wgJiYgc3ltYm9sLnVuaWZvcm1zICYmIGhhc0Z1bmN0aW9uRGVmaW5pdGlvbihzeW1ib2wudW5pZm9ybXMpKSk7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuX2hhc0Z1bmNEZWZpbml0aW9uO1xyXG4gICAgfVxyXG5cclxuICAgIF9vblN5bWJvbENoYW5nZWQoKSB7XHJcbiAgICAgICAgdGhpcy5fdXBkYXRlTWF0cml4KCk7XHJcbiAgICAgICAgLy/mm7TmlrDlm77lsYLnmoRnZW9tZXRyaWVzXHJcbiAgICAgICAgaWYgKHRoaXMuX2xheWVyKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2xheWVyLl91cGRhdGVHZW9tZXRyaWVzKHRoaXMpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICB1cGRhdGVTeW1ib2woc3ltYm9sKSB7XHJcbiAgICAgICAgY29uc3QgY29weVN5bWJvbCA9IHRoaXMuX3ByZXBhcmVTeW1ib2woc3ltYm9sKTtcclxuICAgICAgICB0aGlzLl9jaGVja1VybChjb3B5U3ltYm9sKTtcclxuICAgICAgICBmb3IgKGNvbnN0IGkgaW4gY29weVN5bWJvbCkge1xyXG4gICAgICAgICAgICB0aGlzLl9zZXRQcm9wSW5TeW1ib2woaSwgY29weVN5bWJvbFtpXSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMuX29uU3ltYm9sQ2hhbmdlZCgpO1xyXG4gICAgfVxyXG5cclxuICAgIF9jaGVja1VybChzeW1ib2wpIHtcclxuICAgICAgICBjb25zdCBvbGRVcmwgPSB0aGlzLmdldFVybCgpO1xyXG4gICAgICAgIGNvbnN0IG5ld1VybCA9IHN5bWJvbC51cmw7XHJcbiAgICAgICAgaWYgKG5ld1VybCAmJiBuZXdVcmwgIT09IG9sZFVybCkge1xyXG4gICAgICAgICAgICB0aGlzLnNldFVybChuZXdVcmwpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBzZXRNb2RlbE1hdHJpeChtYXRyaXgpIHtcclxuICAgICAgICB0aGlzLl9tb2RlbE1hdHJpeCA9IG1hdHJpeDtcclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH1cclxuXHJcbiAgICBnZXRNb2RlbE1hdHJpeCgpIHtcclxuICAgICAgICB0aGlzLl9tb2RlbE1hdHJpeCA9IHRoaXMuX21vZGVsTWF0cml4IHx8IG1hdDQuaWRlbnRpdHkoW10pO1xyXG4gICAgICAgIHJldHVybiB0aGlzLl9tb2RlbE1hdHJpeDtcclxuICAgIH1cclxuXHJcbiAgICBfdXBkYXRlTWF0cml4KCkge1xyXG4gICAgICAgIGNvbnN0IHJvdGF0aW9uID0gdGhpcy5nZXRSb3RhdGlvbigpO1xyXG4gICAgICAgIGNvbnN0IGVsdWVyUXVhdCA9IHF1YXQuZnJvbUV1bGVyKFtdLCByb3RhdGlvblswXSB8fCAwLCByb3RhdGlvblsxXSB8fCAwLCByb3RhdGlvblsyXSB8fCAwKTtcclxuICAgICAgICB0aGlzLl9tb2RlbE1hdHJpeCA9IG1hdDQuZnJvbVJvdGF0aW9uVHJhbnNsYXRpb25TY2FsZShbXSwgZWx1ZXJRdWF0LCB0aGlzLl9nZXRXb3JsZFRyYW5zbGF0aW9uKCksIHRoaXMuZ2V0U2NhbGUoKSk7XHJcbiAgICAgICAgdGhpcy5fZGlydHkgPSB0cnVlO1xyXG4gICAgfVxyXG5cclxuICAgIHNldFByb3BlcnRpZXMocHJvcGVydGllcykge1xyXG4gICAgICAgIHRoaXMub3B0aW9ucy5wcm9wZXJ0aWVzID0gcHJvcGVydGllcztcclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH1cclxuXHJcbiAgICBnZXRQcm9wZXJ0aWVzKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLm9wdGlvbnMucHJvcGVydGllcztcclxuICAgIH1cclxuXHJcbiAgICBpc0RpcnR5KCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLl9kaXJ0eTtcclxuICAgIH1cclxuXHJcbiAgICBzZXREaXJ0eShkaXJ0eSkge1xyXG4gICAgICAgIHRoaXMuX2RpcnR5ID0gZGlydHk7XHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9XHJcblxyXG4gICAgLy/ph43lhpnkuovku7bnm5HlkKzmlrnms5VcclxuICAgIG9uKGV2ZW50cywgY2FsbGJhY2ssIGNvbnRleHQpIHtcclxuICAgICAgICBzdXBlci5vbihldmVudHMsIGNhbGxiYWNrLCBjb250ZXh0IHx8IHRoaXMpO1xyXG4gICAgICAgIGlmICh0aGlzLl9sYXllcikge1xyXG4gICAgICAgICAgICB0aGlzLl9sYXllci5fYWRkRXZlbnRzKGV2ZW50cyk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIG9mZihldmVudHMsIGNhbGxiYWNrLCBjb250ZXh0KSB7XHJcbiAgICAgICAgc3VwZXIub2ZmKGV2ZW50cywgY2FsbGJhY2ssIGNvbnRleHQgfHwgdGhpcyk7XHJcbiAgICAgICAgaWYgKHRoaXMuX2xheWVyKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2xheWVyLl9yZW1vdmVFdmVudHMoKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgdG9KU09OKCkge1xyXG4gICAgICAgIHJldHVybiBKU09OLnBhcnNlKEpTT04uc3RyaW5naWZ5KHtcclxuICAgICAgICAgICAgY29vcmRpbmF0ZXMgOiB0aGlzLmdldENvb3JkaW5hdGVzKCksXHJcbiAgICAgICAgICAgIG9wdGlvbnMgOiB0aGlzLm9wdGlvbnNcclxuICAgICAgICB9KSk7XHJcbiAgICB9XHJcblxyXG4gICAgLy/orr7nva7lvZPliY1tYXJrZXLnmoTliqDovb3nirbmgIFcclxuICAgIF9zZXRMb2FkU3RhdGUoc3RhdGUpIHtcclxuICAgICAgICB0aGlzLl9sb2FkZWQgPSBzdGF0ZTtcclxuICAgIH1cclxuXHJcbiAgICBpc0xvYWRlZCgpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5fbG9hZGVkO1xyXG4gICAgfVxyXG5cclxuICAgIGdldFR5cGUoKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuX3R5cGU7XHJcbiAgICB9XHJcblxyXG4gICAgX2dldFVJRCgpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5fdWlkO1xyXG4gICAgfVxyXG59XHJcblxyXG5HTFRGTWFya2VyLm1lcmdlT3B0aW9ucyhvcHRpb25zKTtcclxuXHJcbmZ1bmN0aW9uIGNvb3JkaW5hdGVUb1dvcmxkKG1hcCwgY29vcmRpbmF0ZSwgeiA9IDApIHtcclxuICAgIGlmICghbWFwIHx8ICEoY29vcmRpbmF0ZSBpbnN0YW5jZW9mIENvb3JkaW5hdGUpKSB7XHJcbiAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICB9XHJcbiAgICBjb25zdCBwID0gbWFwLmNvb3JkaW5hdGVUb1BvaW50KGNvb3JkaW5hdGUsIGdldFRhcmdldFpvb20obWFwKSk7XHJcbiAgICByZXR1cm4gW3AueCwgcC55LCB6XTtcclxufVxyXG5cclxuZnVuY3Rpb24gZ2V0VGFyZ2V0Wm9vbShtYXApIHtcclxuICAgIHJldHVybiBtYXAuZ2V0R0xab29tKCk7XHJcbn1cclxuIiwiaW1wb3J0IHsgVXRpbCB9IGZyb20gJ21hcHRhbGtzJztcclxuaW1wb3J0IEdMVEZNYXJrZXIgZnJvbSAnLi4vR0xURk1hcmtlcic7XHJcblxyXG5jb25zdCB0eXBlcyA9IFtcclxuICAgIC8vIGdlb21ldHJpZXNcclxuICAgICdQb2ludCcsXHJcbiAgICAnUG9seWdvbicsXHJcbiAgICAnTGluZVN0cmluZycsXHJcbiAgICAnTXVsdGlQb2ludCcsXHJcbiAgICAnTXVsdGlQb2x5Z29uJyxcclxuICAgICdNdWx0aUxpbmVTdHJpbmcnLFxyXG4gICAgJ0dlb21ldHJ5Q29sbGVjdGlvbicsXHJcbiAgICAnRmVhdHVyZScsXHJcbiAgICAnRmVhdHVyZUNvbGxlY3Rpb24nXVxyXG4gICAgLnJlZHVjZSgobWVtbywgdCkgPT4ge1xyXG4gICAgICAgIG1lbW9bdF0gPSB0cnVlO1xyXG4gICAgICAgIHJldHVybiBtZW1vO1xyXG4gICAgfSwge30pO1xyXG5cclxuY29uc3QgR2VvSlNPTiA9IHtcclxuICAgIHRvR2VvbWV0cnk6IGZ1bmN0aW9uIChnZW9KU09OKSB7XHJcbiAgICAgICAgaWYgKFV0aWwuaXNTdHJpbmcoZ2VvSlNPTikpIHtcclxuICAgICAgICAgICAgZ2VvSlNPTiA9IFV0aWwucGFyc2VKU09OKGdlb0pTT04pO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShnZW9KU09OKSkge1xyXG4gICAgICAgICAgICBjb25zdCByZXN1bHRHZW9zID0gW107XHJcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBnZW9KU09OLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBnZW8gPSBHZW9KU09OLl9jb252ZXJ0KGdlb0pTT05baV0pO1xyXG4gICAgICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkoZ2VvKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIFV0aWwucHVzaEluKHJlc3VsdEdlb3MsIGdlbyk7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdEdlb3MucHVzaChnZW8pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiByZXN1bHRHZW9zO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdEdlbyA9IEdlb0pTT04uX2NvbnZlcnQoZ2VvSlNPTik7XHJcbiAgICAgICAgICAgIHJldHVybiByZXN1bHRHZW87XHJcbiAgICAgICAgfVxyXG4gICAgfSxcclxuXHJcbiAgICBfY29udmVydDogZnVuY3Rpb24gKGpzb24pIHtcclxuICAgICAgICBpZiAoIWpzb24gfHwgVXRpbC5pc05pbChqc29uWyd0eXBlJ10pKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgIH1cclxuICAgICAgICBjb25zdCB0eXBlID0ganNvblsndHlwZSddO1xyXG4gICAgICAgIGlmICh0eXBlID09PSAnRmVhdHVyZScpIHtcclxuICAgICAgICAgICAgY29uc3QgZyA9IGpzb25bJ2dlb21ldHJ5J107XHJcbiAgICAgICAgICAgIGNvbnN0IGdlb21ldHJ5ID0gR2VvSlNPTi5fY29udmVydChnKTtcclxuICAgICAgICAgICAgaWYgKCFnZW9tZXRyeSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZ2VvbWV0cnkuc2V0SWQoanNvblsnaWQnXSk7XHJcbiAgICAgICAgICAgIGdlb21ldHJ5LnNldFByb3BlcnRpZXMoanNvblsncHJvcGVydGllcyddKTtcclxuICAgICAgICAgICAgcmV0dXJuIGdlb21ldHJ5O1xyXG4gICAgICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gJ0ZlYXR1cmVDb2xsZWN0aW9uJykge1xyXG4gICAgICAgICAgICBjb25zdCBmZWF0dXJlcyA9IGpzb25bJ2ZlYXR1cmVzJ107XHJcbiAgICAgICAgICAgIGlmICghZmVhdHVyZXMpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IEdlb0pTT04udG9HZW9tZXRyeShmZWF0dXJlcyk7XHJcbiAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XHJcbiAgICAgICAgfSBlbHNlIGlmICh0eXBlID09PSAnUG9pbnQnKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBuZXcgR0xURk1hcmtlcihqc29uWydjb29yZGluYXRlcyddKTtcclxuICAgICAgICB9IGVsc2UgaWYgKHR5cGUgPT09ICdHZW9tZXRyeUNvbGxlY3Rpb24nKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGdlb21ldHJpZXMgPSBqc29uWydnZW9tZXRyaWVzJ107XHJcbiAgICAgICAgICAgIGNvbnN0IG1HZW9zID0gW107XHJcbiAgICAgICAgICAgIGNvbnN0IGxlbiA9IGdlb21ldHJpZXMubGVuZ3RoO1xyXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICBtR2Vvcy5wdXNoKEdlb0pTT04uX2NvbnZlcnQoZ2VvbWV0cmllc1tpXSkpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiBtR2VvcztcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2dlb21ldHJ5XFwncyB0eXBlIGlzIGludmFsaWQsIG9ubHkgc3VwcG9ydCB0eXBlIG9mIFBvaW50Jyk7XHJcbiAgICAgICAgfVxyXG4gICAgfSxcclxuXHJcbiAgICBpc0dlb0pTT04gOiBmdW5jdGlvbiAoZ2VvSlNPTikge1xyXG4gICAgICAgIGlmICghZ2VvSlNPTiB8fCB0eXBlb2YgZ2VvSlNPTiAhPT0gJ29iamVjdCcpIHJldHVybiBmYWxzZTtcclxuICAgICAgICBpZiAoIWdlb0pTT04udHlwZSkgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIGlmICghdHlwZXNbZ2VvSlNPTi50eXBlXSkgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgfVxyXG59O1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgR2VvSlNPTjtcclxuIiwiZXhwb3J0IGRlZmF1bHQge1xyXG4gICAgJ3poLUNOJzoge1xyXG4gICAgICAgIGFuaW1hdGlvbjogJ+WKqOeUuycsXHJcbiAgICAgICAgbG9vcDogJ+W+queOrycsXHJcbiAgICAgICAgc3BlZWQ6ICfpgJ/luqYnLFxyXG4gICAgICAgIHRyYW5zbGF0aW9uOiAn5bmz56e7JyxcclxuICAgICAgICByb3RhdGlvbjogJ+aXi+i9rCcsXHJcbiAgICAgICAgc2NhbGU6ICfnvKnmlL4nLFxyXG4gICAgICAgIG1vZGVsOiAn6YCJ5oup5qih5Z6LJyxcclxuICAgICAgICBzaGFkZXI6ICfpgInmi6nmu6TplZwnLFxyXG4gICAgICAgIHBob25nOiAn5Yav5rCP5YWJ54WnJyxcclxuICAgICAgICB3aXJlZnJhbWU6ICfnur/moYYnLFxyXG4gICAgICAgIGxpZ2h0UG9zaXRpb246ICfnga/lhYnkvY3nva4nLFxyXG4gICAgICAgIGxpZ2h0QW1iaWVudDogJ+eOr+Wig+WFiScsXHJcbiAgICAgICAgbGlnaHREaWZmdXNlOiAn5ryr5Y+N5bCEJyxcclxuICAgICAgICBsaWdodFNwZWN1bGFyOiAn6ZWc6Z2i5Y+N5bCEJyxcclxuICAgICAgICBhbWJpZW50U3RyZW5ndGg6ICfnjq/looPlhYnlvLrluqYnLFxyXG4gICAgICAgIHNwZWN1bGFyU3RyZW5ndGg6ICfpq5jlhYnlvLrluqYnLFxyXG4gICAgICAgIG1hdGVyaWFsU2hpbmluZXNzOiAn5p2Q6LSo5Y+N5YWJ5bqmJyxcclxuICAgICAgICBvcGFjaXR5OiAn6YCP5piO5bqmJyxcclxuICAgICAgICBmcm9udENvbG9yOiAn5YmN5pmv6ImyJyxcclxuICAgICAgICBiYWNrQ29sb3I6ICflkI7mma/oibInLFxyXG4gICAgICAgIGZpbGxDb2xvcjogJ+Whq+WFheiJsicsXHJcbiAgICAgICAgZmlsbCA6ICfloavlhYXoibInLFxyXG4gICAgICAgIHN0cm9rZSA6ICfnlLvnrJTpopzoibInLFxyXG4gICAgICAgIGxpbmVXaWR0aDogJ+e6v+WuvScsXHJcbiAgICAgICAgYWxwaGE6ICfpgI/mmI7luqYnLFxyXG4gICAgICAgIGFuaW1hdGlvbkdyb3VwOiAn5Yqo55S75bGe5oCnJyxcclxuICAgICAgICB0aHJlZUdyb3VwOiAn5LiJ57u05bGe5oCnJyxcclxuICAgICAgICBoaWdoTGlnaHQ6ICfpq5jlhYknLFxyXG4gICAgICAgIGRpZmZ1c2U6ICfmvKvlsIQnLFxyXG4gICAgICAgIGNvbG9yOiAn6aKc6ImyJyxcclxuICAgICAgICB3aWR0aDogJ+WuveW6picsXHJcbiAgICAgICAgZGVmYXVsdDogJ+m7mOiupOWAvCcsXHJcbiAgICAgICAgc2VlVGhyb3VnaDogJ+mAj+inhicsXHJcbiAgICAgICAgZGFzaCA6ICfomZrnur8nLFxyXG4gICAgICAgIGRhc2hFbmFibGVkIDogJ+W8gOWQr+iZmue6vycsXHJcbiAgICAgICAgZGFzaEFuaW1hdGUgOiAn6Jma57q/5Yqo55S7JyxcclxuICAgICAgICBkYXNoT3ZlcmxhcCA6ICfomZrnur/ph43lj6AnLFxyXG4gICAgICAgIGRhc2hSZXBlYXRzIDogJ+iZmue6v+mHjeWkjScsXHJcbiAgICAgICAgZGFzaExlbmd0aCA6ICfomZrnur/plb/luqYnLFxyXG4gICAgICAgIHNxdWVlemUgOiAn5oyk5Y6LJyxcclxuICAgICAgICBpbnNpZGVBbHRDb2xvciA6ICflvIDlkK/lhoXloavlhYXoibInLFxyXG4gICAgICAgIGR1YWxTdHJva2UgOiAn5byA5ZCv5Y+M5ZCR55S756yUJyxcclxuICAgICAgICBzcXVlZXplTWluIDogJ+acgOWwj+aMpOWOi+WKmycsXHJcbiAgICAgICAgc3F1ZWV6ZU1heCA6ICfmnIDlpKfmjKTljovlipsnLFxyXG4gICAgICAgIFNsZWVrIDogJyDlnIbmu5EnLFxyXG4gICAgICAgIEZ1bmt5VG9ydXMgOiAn5pe25bCaJyxcclxuICAgICAgICBCbG9ja3lGYWRlIDogJ+aWkempsycsXHJcbiAgICAgICAgU2ltcGxlV2lyZSA6ICfnroDnuqYnLFxyXG4gICAgICAgIE5pY2VyV2lyZSA6ICfoh7Pnvo4nLFxyXG4gICAgICAgIEFuaW1hdGVkIDogJ+WKqOeUuycsXHJcbiAgICAgICAgRnVuWm9uZSA6ICfmu5HnqL0nLFxyXG4gICAgICAgIERvdHRlZCA6ICfngrnnvIAnLFxyXG4gICAgICAgIEZsb3dlciA6ICfoirHnsIcnLFxyXG4gICAgICAgIFRhcGVyZWQgOiAn5riQ57ypJ1xyXG4gICAgfSxcclxuICAgICdlbi1VUyc6IHtcclxuICAgICAgICBhbmltYXRpb246ICdBbmltYXRpb24nLFxyXG4gICAgICAgIGxvb3A6ICdMb29wJyxcclxuICAgICAgICBzcGVlZDogJ1NwZWVkJyxcclxuICAgICAgICB0cmFuc2xhdGlvbjogJ1RyYW5zbGF0aW9uJyxcclxuICAgICAgICByb3RhdGlvbjogJ1JvdGF0aW9uJyxcclxuICAgICAgICBzY2FsZTogJ1NjYWxlJyxcclxuICAgICAgICBtb2RlbDogJ01vZGVsJyxcclxuICAgICAgICBzaGFkZXI6ICdTaGFkZXInLFxyXG4gICAgICAgIHBob25nOiAnUGhvbmcnLFxyXG4gICAgICAgIHdpcmVmcmFtZTogJ1dpcmVmcmFtZScsXHJcbiAgICAgICAgbGlnaHRQb3NpdGlvbjogJ0xpZ2h0IFBvc2l0aW9uJyxcclxuICAgICAgICBsaWdodEFtYmllbnQ6ICdMaWdodCBBbWJpZW50JyxcclxuICAgICAgICBsaWdodERpZmZ1c2U6ICdMaWdodCBEaWZmdXNlJyxcclxuICAgICAgICBsaWdodFNwZWN1bGFyOiAnTGlnaHQgU3BlY3VsYXInLFxyXG4gICAgICAgIGFtYmllbnRTdHJlbmd0aDogJ0FtYmllbnQgU3RyZW5ndGgnLFxyXG4gICAgICAgIHNwZWN1bGFyU3RyZW5ndGg6ICdTcGVjdWxhciBTdHJlbmd0aCcsXHJcbiAgICAgICAgbWF0ZXJpYWxTaGluaW5lc3M6ICdNYXRlcmlhbCBTaGluaW5lc3MnLFxyXG4gICAgICAgIG9wYWNpdHk6ICdPcGFjaXR5JyxcclxuICAgICAgICBmcm9udENvbG9yOiAnRnJvbnQgQ29sb3InLFxyXG4gICAgICAgIGJhY2tDb2xvcjogJ0JhY2sgQ29sb3InLFxyXG4gICAgICAgIGZpbGxDb2xvcjogJ0ZpbGwgQ29sb3InLFxyXG4gICAgICAgIGZpbGwgOiAnRmlsbCBDb2xvcicsXHJcbiAgICAgICAgc3Ryb2tlIDogJ3N0cm9rZSBjb2xvcicsXHJcbiAgICAgICAgbGluZVdpZHRoOiAnTGluZSBXaWR0aCcsXHJcbiAgICAgICAgYWxwaGE6ICdBbHBoYScsXHJcbiAgICAgICAgYW5pbWF0aW9uR3JvdXA6ICdBbmltYXRpb24nLFxyXG4gICAgICAgIHRocmVlR3JvdXA6ICdUaHJlZScsXHJcbiAgICAgICAgaGlnaExpZ2h0OiAnSGlnaExpZ2h0JyxcclxuICAgICAgICBkaWZmdXNlOiAnRGlmZnVzZScsXHJcbiAgICAgICAgY29sb3I6ICdDb2xvcicsXHJcbiAgICAgICAgd2lkdGg6ICdXaWR0aCcsXHJcbiAgICAgICAgZGVmYXVsdDogJ0RlZmF1bHQnLFxyXG4gICAgICAgIHNlZVRocm91Z2g6ICdTZWUgVGhyb3VnaCcsXHJcbiAgICAgICAgZGFzaDogJ0Rhc2ggTGluZScsXHJcbiAgICAgICAgZGFzaEVuYWJsZWQ6ICdFbmFibGUgRGFzaCcsXHJcbiAgICAgICAgZGFzaEFuaW1hdGU6ICdEYXNoIEFuaW1hdGlvbicsXHJcbiAgICAgICAgZGFzaE92ZXJsYXAgOiAnRGFzaCBPdmVybGFwJyxcclxuICAgICAgICBkYXNoUmVwZWF0cyA6ICdEYXNoIFJlcGVhdHMnLFxyXG4gICAgICAgIGRhc2hMZW5ndGggOiAnRGFzaCBMZW5ndGgnLFxyXG4gICAgICAgIHNxdWVlemUgOiAnU3F1ZWV6ZScsXHJcbiAgICAgICAgaW5zaWRlQWx0Q29sb3IgOiAnSW5zaWRlIENvbG9yJyxcclxuICAgICAgICBkdWFsU3Ryb2tlIDogJ0R1YWwgU3RyaWsnLFxyXG4gICAgICAgIHNxdWVlemVNaW4gOiAnTWluIFNxdWVlemUnLFxyXG4gICAgICAgIHNxdWVlemVNYXggOiAnTWF4IFNxdWVlemUnLFxyXG4gICAgICAgIFNsZWVrIDogJyBTbGVlaycsXHJcbiAgICAgICAgRnVua3lUb3J1cyA6ICdGdW5reVRvcnVzJyxcclxuICAgICAgICBCbG9ja3lGYWRlIDogJ0Jsb2NreUZhZGUnLFxyXG4gICAgICAgIFNpbXBsZVdpcmUgOiAnU2ltcGxlV2lyZScsXHJcbiAgICAgICAgTmljZXJXaXJlIDogJ05pY2VyV2lyZScsXHJcbiAgICAgICAgQW5pbWF0ZWQgOiAnQW5pbWF0ZWQnLFxyXG4gICAgICAgIEZ1blpvbmUgOiAnRnVuWm9uZScsXHJcbiAgICAgICAgRG90dGVkIDogJ0RvdHRlZCcsXHJcbiAgICAgICAgRmxvd2VyIDogJ0Zsb3dlcicsXHJcbiAgICAgICAgVGFwZXJlZCA6ICdUYXBlcmVkJ1xyXG4gICAgfVxyXG59O1xyXG4iLCJpbXBvcnQgbGFuZ3VhZ2UgZnJvbSAnLi9sYW5ndWFnZSc7XHJcblxyXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBnZXRTdHVkaW9UeXBpbmdzKCkge1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICBpMThuIDogbGFuZ3VhZ2UsXHJcbiAgICAgICAgZ3JvdXBzOiBbXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIG5hbWU6ICdhbmltYXRpb25Hcm91cCcsXHJcbiAgICAgICAgICAgICAgICBjaGlsZHJlbjogW1xyXG4gICAgICAgICAgICAgICAgICAgIHsgbmFtZTogJ2FuaW1hdGlvbicgfSxcclxuICAgICAgICAgICAgICAgICAgICB7IG5hbWU6ICdsb29wJyB9LFxyXG4gICAgICAgICAgICAgICAgICAgIHsgbmFtZTogJ3NwZWVkJyB9LFxyXG4gICAgICAgICAgICAgICAgICAgIHsgbmFtZTogJ3RyYW5zbGF0aW9uJyB9LFxyXG4gICAgICAgICAgICAgICAgICAgIHsgbmFtZTogJ3JvdGF0aW9uJyB9LFxyXG4gICAgICAgICAgICAgICAgICAgIHsgbmFtZTogJ3NjYWxlJyB9XHJcbiAgICAgICAgICAgICAgICBdXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIG5hbWU6ICd0aHJlZUdyb3VwJyxcclxuICAgICAgICAgICAgICAgIGNoaWxkcmVuOiBbXHJcbiAgICAgICAgICAgICAgICAgICAgeyBuYW1lOiAnc2hhZGVyJyB9LFxyXG4gICAgICAgICAgICAgICAgICAgIHsgbmFtZTogJ3VuaWZvcm1zJyB9LFxyXG4gICAgICAgICAgICAgICAgXVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgXSxcclxuICAgICAgICB0eXBpbmc6IHtcclxuICAgICAgICAgICAgbmFtZTogJ3N0eWxlJyxcclxuICAgICAgICAgICAgdHlwZTogJ2FycmF5JyxcclxuICAgICAgICAgICAgb25DaGFuZ2U6ICdzZXRTdHlsZScsXHJcbiAgICAgICAgICAgIGl0ZW1zOiBbXHJcbiAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXHJcbiAgICAgICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBmaWx0ZXI6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdmaWx0ZXInLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogJ2ZpbHRlcicsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZTogWyc9PScsICdsYXllciddXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHN5bWJvbDoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBuYW1lOiAnc3ltYm9sJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhbmltYXRpb246IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3N3aXRjaCcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5hbWU6ICdhbmltYXRpb24nLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZTogdHJ1ZVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9vcDoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnc3dpdGNoJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogJ2xvb3AnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZTogZmFsc2VcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNwZWVkOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdyYW5nZScsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5hbWU6ICdzcGVlZCcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbnM6IFswLCAyMCwgMC4xXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWU6IDIyLjVcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRyYW5zbGF0aW9uOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdhcnJheScsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5hbWU6ICd0cmFuc2xhdGlvbicsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlOiBbMSwgMSwgMV0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGl0ZW1zOiBbXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3JhbmdlJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuYW1lOiAnZGlyZWN0aW9uWCcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb3B0aW9uczogWzAuMSwgMTAsIDAuMV1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3JhbmdlJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuYW1lOiAnZGlyZWN0aW9uWScsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb3B0aW9uczogWzAuMSwgMTAsIDAuMV1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3JhbmdlJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuYW1lOiAnZGlyZWN0aW9uWicsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb3B0aW9uczogWzAuMSwgMTAsIDAuMV1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcm90YXRpb246IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2FycmF5JyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogJ3JvdGF0aW9uJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWU6IFswLCAwLCAwXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaXRlbXM6IFtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAncmFuZ2UnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5hbWU6ICdkaXJlY3Rpb25YJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zOiBbMC4xLCAxMCwgMC4xXVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAncmFuZ2UnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5hbWU6ICdkaXJlY3Rpb25ZJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zOiBbMC4xLCAxMCwgMC4xXVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAncmFuZ2UnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5hbWU6ICdkaXJlY3Rpb25aJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zOiBbMC4xLCAxMCwgMC4xXVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBdXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzY2FsZToge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnYXJyYXknLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuYW1lOiAnc2NhbGUnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZTogWzEsIDEsIDFdLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpdGVtczogW1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdyYW5nZScsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogJ2RpcmVjdGlvblgnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbnM6IFswLjEsIDEwLCAwLjFdXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdyYW5nZScsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogJ2RpcmVjdGlvblknLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbnM6IFswLjEsIDEwLCAwLjFdXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdyYW5nZScsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogJ2RpcmVjdGlvblonLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbnM6IFswLjEsIDEwLCAwLjFdXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIF1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNoYWRlcjoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAncmFkaW8nLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuYW1lOiAnc2hhZGVyJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb3B0aW9uczogW10sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlOiAncGhvbmcnXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB1bmlmb3Jtczoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogJ3VuaWZvcm1zJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWU6ICdwaG9uZycsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9uZU9mOiBbXVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXVxyXG4gICAgICAgIH1cclxuICAgIH07XHJcbn1cclxuIiwiaW1wb3J0IHsgdmVjMyB9IGZyb20gJ0BtYXB0YWxrcy9nbCc7XHJcblxyXG5jb25zdCBjdWJlUG9zaXRpb24gPSBbMSwgMSwgMSwgLTEsIDEsIDEsIC0xLCAtMSwgMSwgMSwgLTEsIDEsXHJcbiAgICAxLCAxLCAxLCAxLCAtMSwgMSwgMSwgLTEsIC0xLCAxLCAxLCAtMSxcclxuICAgIDEsIDEsIDEsIDEsIDEsIC0xLCAtMSwgMSwgLTEsIC0xLCAxLCAxLFxyXG4gICAgLTEsIDEsIDEsIC0xLCAxLCAtMSwgLTEsIC0xLCAtMSwgLTEsIC0xLCAxLFxyXG4gICAgLTEsIC0xLCAtMSwgMSwgLTEsIC0xLCAxLCAtMSwgMSwgLTEsIC0xLCAxLFxyXG4gICAgMSwgLTEsIC0xLCAtMSwgLTEsIC0xLCAtMSwgMSwgLTEsIDEsIDEsIC0xXTtcclxuY29uc3QgY3ViZU5vcm1hbCA9ICBbMCwgMCwgMSwgMCwgMCwgMSwgMCwgMCwgMSwgMCwgMCwgMSxcclxuICAgIDEsIDAsIDAsIDEsIDAsIDAsIDEsIDAsIDAsIDEsIDAsIDAsXHJcbiAgICAwLCAxLCAwLCAwLCAxLCAwLCAwLCAxLCAwLCAwLCAxLCAwLFxyXG4gICAgLTEsIDAsIDAsIC0xLCAwLCAwLCAtMSwgMCwgMCwgLTEsIDAsIDAsXHJcbiAgICAwLCAtMSwgMCwgMCwgLTEsIDAsIDAsIC0xLCAwLCAwLCAtMSwgMCxcclxuICAgIDAsIDAsIC0xLCAwLCAwLCAtMSwgMCwgMCwgLTEsIDAsIDAsIC0xXTtcclxuY29uc3QgY3ViZUluZGljZXMgPSBbMCwgMSwgMiwgMCwgMiwgMyxcclxuICAgIDQsIDUsIDYsIDQsIDYsIDcsXHJcbiAgICA4LCA5LCAxMCwgOCwgMTAsIDExLFxyXG4gICAgMTIsIDEzLCAxNCwgMTIsIDE0LCAxNSxcclxuICAgIDE2LCAxNywgMTgsIDE2LCAxOCwgMTksXHJcbiAgICAyMCwgMjEsIDIyLCAyMCwgMjIsIDIzXTtcclxuXHJcblxyXG5mdW5jdGlvbiBTcGhlcmVHZW9tZXRyeShyYWRpdXMsIHdpZHRoU2VnbWVudHMsIGhlaWdodFNlZ21lbnRzLCBwaGlTdGFydCwgcGhpTGVuZ3RoLCB0aGV0YVN0YXJ0LCB0aGV0YUxlbmd0aCkge1xyXG4gICAgcmFkaXVzID0gcmFkaXVzIHx8IDE7XHJcbiAgICB3aWR0aFNlZ21lbnRzID0gTWF0aC5tYXgoMywgTWF0aC5mbG9vcih3aWR0aFNlZ21lbnRzKSB8fCA4KTtcclxuICAgIGhlaWdodFNlZ21lbnRzID0gTWF0aC5tYXgoMiwgTWF0aC5mbG9vcihoZWlnaHRTZWdtZW50cykgfHwgNik7XHJcbiAgICBwaGlTdGFydCA9IHBoaVN0YXJ0ICE9PSB1bmRlZmluZWQgPyBwaGlTdGFydCA6IDA7XHJcbiAgICBwaGlMZW5ndGggPSBwaGlMZW5ndGggIT09IHVuZGVmaW5lZCA/IHBoaUxlbmd0aCA6IE1hdGguUEkgKiAyO1xyXG4gICAgdGhldGFTdGFydCA9IHRoZXRhU3RhcnQgIT09IHVuZGVmaW5lZCA/IHRoZXRhU3RhcnQgOiAwO1xyXG4gICAgdGhldGFMZW5ndGggPSB0aGV0YUxlbmd0aCAhPT0gdW5kZWZpbmVkID8gdGhldGFMZW5ndGggOiBNYXRoLlBJO1xyXG4gICAgY29uc3QgdGhldGFFbmQgPSB0aGV0YVN0YXJ0ICsgdGhldGFMZW5ndGg7XHJcbiAgICBsZXQgaXgsIGl5O1xyXG4gICAgbGV0IGluZGV4ID0gMDtcclxuICAgIGNvbnN0IGdyaWQgPSBbXTtcclxuICAgIGNvbnN0IHZlcnRleCA9IFtdO1xyXG4gICAgY29uc3Qgbm9ybWFsID0gW107XHJcbiAgICAvLyBidWZmZXJzXHJcbiAgICBjb25zdCBpbmRpY2VzID0gW107XHJcbiAgICBjb25zdCB2ZXJ0aWNlcyA9IFtdO1xyXG4gICAgY29uc3Qgbm9ybWFscyA9IFtdO1xyXG4gICAgY29uc3QgdXZzID0gW107XHJcbiAgICAvLyBnZW5lcmF0ZSB2ZXJ0aWNlcywgbm9ybWFscyBhbmQgdXZzXHJcbiAgICBmb3IgKGl5ID0gMDsgaXkgPD0gaGVpZ2h0U2VnbWVudHM7IGl5KyspIHtcclxuICAgICAgICBjb25zdCB2ZXJ0aWNlc1JvdyA9IFtdO1xyXG4gICAgICAgIGNvbnN0IHYgPSBpeSAvIGhlaWdodFNlZ21lbnRzO1xyXG4gICAgICAgIC8vIHNwZWNpYWwgY2FzZSBmb3IgdGhlIHBvbGVzXHJcbiAgICAgICAgY29uc3QgdU9mZnNldCA9IChpeSA9PT0gMCkgPyAwLjUgLyB3aWR0aFNlZ21lbnRzIDogKChpeSA9PT0gaGVpZ2h0U2VnbWVudHMpID8gLTAuNSAvIHdpZHRoU2VnbWVudHMgOiAwKTtcclxuICAgICAgICBmb3IgKGl4ID0gMDsgaXggPD0gd2lkdGhTZWdtZW50czsgaXgrKykge1xyXG4gICAgICAgICAgICBjb25zdCB1ID0gaXggLyB3aWR0aFNlZ21lbnRzO1xyXG4gICAgICAgICAgICAvLyB2ZXJ0ZXhcclxuICAgICAgICAgICAgdmVydGV4WzBdID0gLXJhZGl1cyAqIE1hdGguY29zKHBoaVN0YXJ0ICsgdSAqIHBoaUxlbmd0aCkgKiBNYXRoLnNpbih0aGV0YVN0YXJ0ICsgdiAqIHRoZXRhTGVuZ3RoKTtcclxuICAgICAgICAgICAgdmVydGV4WzFdID0gcmFkaXVzICogTWF0aC5jb3ModGhldGFTdGFydCArIHYgKiB0aGV0YUxlbmd0aCk7XHJcbiAgICAgICAgICAgIHZlcnRleFsyXSA9IHJhZGl1cyAqIE1hdGguc2luKHBoaVN0YXJ0ICsgdSAqIHBoaUxlbmd0aCkgKiBNYXRoLnNpbih0aGV0YVN0YXJ0ICsgdiAqIHRoZXRhTGVuZ3RoKTtcclxuICAgICAgICAgICAgdmVydGljZXMucHVzaCh2ZXJ0ZXhbMF0sIHZlcnRleFsxXSwgdmVydGV4WzJdKTtcclxuICAgICAgICAgICAgLy8gbm9ybWFsXHJcbiAgICAgICAgICAgIHZlYzMuc2V0KG5vcm1hbCwgdmVydGV4WzBdLCB2ZXJ0ZXhbMV0sIHZlcnRleFsyXSk7XHJcbiAgICAgICAgICAgIHZlYzMubm9ybWFsaXplKG5vcm1hbCwgbm9ybWFsKTtcclxuICAgICAgICAgICAgbm9ybWFscy5wdXNoKG5vcm1hbFswXSwgbm9ybWFsWzFdLCBub3JtYWxbMl0pO1xyXG4gICAgICAgICAgICAvLyB1dlxyXG4gICAgICAgICAgICB1dnMucHVzaCh1ICsgdU9mZnNldCwgMSAtIHYpO1xyXG4gICAgICAgICAgICB2ZXJ0aWNlc1Jvdy5wdXNoKGluZGV4KyspO1xyXG4gICAgICAgIH1cclxuICAgICAgICBncmlkLnB1c2godmVydGljZXNSb3cpO1xyXG4gICAgfVxyXG4gICAgLy8gaW5kaWNlc1xyXG4gICAgZm9yIChpeSA9IDA7IGl5IDwgaGVpZ2h0U2VnbWVudHM7IGl5KyspIHtcclxuICAgICAgICBmb3IgKGl4ID0gMDsgaXggPCB3aWR0aFNlZ21lbnRzOyBpeCsrKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGEgPSBncmlkW2l5XVtpeCArIDFdO1xyXG4gICAgICAgICAgICBjb25zdCBiID0gZ3JpZFtpeV1baXhdO1xyXG4gICAgICAgICAgICBjb25zdCBjID0gZ3JpZFtpeSArIDFdW2l4XTtcclxuICAgICAgICAgICAgY29uc3QgZCA9IGdyaWRbaXkgKyAxXVtpeCArIDFdO1xyXG4gICAgICAgICAgICBpZiAoaXkgIT09IDAgfHwgdGhldGFTdGFydCA+IDApIGluZGljZXMucHVzaChhLCBiLCBkKTtcclxuICAgICAgICAgICAgaWYgKGl5ICE9PSBoZWlnaHRTZWdtZW50cyAtIDEgfHwgdGhldGFFbmQgPCBNYXRoLlBJKSBpbmRpY2VzLnB1c2goYiwgYywgZCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiB7XHJcbiAgICAgICAgdmVydGljZXMsXHJcbiAgICAgICAgdGV4dHVyZXMgOiB1dnMsXHJcbiAgICAgICAgbm9ybWFscyxcclxuICAgICAgICBpbmRpY2VzXHJcbiAgICB9O1xyXG59XHJcblxyXG5jb25zdCBzcGhlcmUgPSBTcGhlcmVHZW9tZXRyeSgyLCAxMjgsIDEyOCk7XHJcbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIGdldE1vZGVsKG1vZGVsKSB7XHJcbiAgICBpZiAobW9kZWwgPT09ICdjdWJlJykge1xyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIGF0dHJpYnV0ZXMgOiB7XHJcbiAgICAgICAgICAgICAgICBQT1NJVElPTiA6IHtcclxuICAgICAgICAgICAgICAgICAgICBhcnJheSA6IG5ldyBJbnQ4QXJyYXkoY3ViZVBvc2l0aW9uKVxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIE5PUk1BTCA6e1xyXG4gICAgICAgICAgICAgICAgICAgIGFycmF5IDogbmV3IEludDhBcnJheShjdWJlTm9ybWFsKVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBpbmRpY2VzIDogbmV3IFVpbnQxNkFycmF5KGN1YmVJbmRpY2VzKSxcclxuICAgICAgICAgICAgbW9kZSA6IDRcclxuICAgICAgICB9O1xyXG4gICAgfSBlbHNlIGlmIChtb2RlbCA9PT0gJ3NwaGVyZScpIHtcclxuICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICBhdHRyaWJ1dGVzIDoge1xyXG4gICAgICAgICAgICAgICAgUE9TSVRJT04gOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgYXJyYXkgOiBzcGhlcmUudmVydGljZXNcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBOT1JNQUwgOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgYXJyYXkgOiBzcGhlcmUubm9ybWFsc1xyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIFRFWENPT1JEXzAgOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgYXJyYXkgOiBzcGhlcmUudGV4dHVyZXNcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgaW5kaWNlcyA6IHNwaGVyZS5pbmRpY2VzLFxyXG4gICAgICAgICAgICBtb2RlIDogNFxyXG4gICAgICAgIH07XHJcbiAgICB9XHJcbiAgICByZXR1cm4gbnVsbDtcclxufVxyXG4iLCJleHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBnZXREZWZhdWx0U2hhZGVyVHlwaW5ncygpIHtcclxuICAgIGNvbnN0IHBob25nU3R1ZGlvVHlwaW5ncyA9IHtcclxuICAgICAgICBzdHJ1Y3R1cmUgOiB7XHJcbiAgICAgICAgICAgIG5hbWU6ICdwaG9uZycsXHJcbiAgICAgICAgICAgIGdyb3VwczogW1xyXG4gICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIG5hbWU6ICdoaWdoTGlnaHQnLFxyXG4gICAgICAgICAgICAgICAgICAgIGNoaWxkcmVuOiBbXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHsgbmFtZTogJ2xpZ2h0UG9zaXRpb24nIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHsgbmFtZTogJ2xpZ2h0QW1iaWVudCcgfSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgeyBuYW1lOiAnbGlnaHREaWZmdXNlJyB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB7IG5hbWU6ICdsaWdodFNwZWN1bGFyJyB9XHJcbiAgICAgICAgICAgICAgICAgICAgXVxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICBuYW1lOiAnZGlmZnVzZScsXHJcbiAgICAgICAgICAgICAgICAgICAgY2hpbGRyZW46IFtcclxuICAgICAgICAgICAgICAgICAgICAgICAgeyBuYW1lOiAnYW1iaWVudFN0cmVuZ3RoJyB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB7IG5hbWU6ICdzcGVjdWxhclN0cmVuZ3RoJyB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB7IG5hbWU6ICdtYXRlcmlhbFNoaW5pbmVzcycgfVxyXG4gICAgICAgICAgICAgICAgICAgIF1cclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgbmFtZTogJ29wYWNpdHknLFxyXG4gICAgICAgICAgICAgICAgICAgIGNoaWxkcmVuOiBbeyBuYW1lOiAnb3BhY2l0eScgfV1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgdHlwaW5nIDp7XHJcbiAgICAgICAgICAgIG5hbWU6ICdwaG9uZycsXHJcbiAgICAgICAgICAgIHByZXNldHM6IFtcclxuICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICBuYW1lOiAnZGVmYXVsdCcsXHJcbiAgICAgICAgICAgICAgICAgICAgdmFsdWU6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgbGlnaHRQb3NpdGlvbjogWzEsIDEsIDFdLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBsaWdodEFtYmllbnQ6IFswLCAwLCAwLCAxXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgbGlnaHREaWZmdXNlOiBbMC41LCAwLjUsIDAuNSwgMV0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGxpZ2h0U3BlY3VsYXI6IFswLjEsIDAuNywgMC4zLCAxXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgc3BlY3VsYXJTdHJlbmd0aDogMC44LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBhbWJpZW50U3RyZW5ndGg6IDAuNSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgbWF0ZXJpYWxTaGluaW5lc3M6IDMyLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBvcGFjaXR5OiAxXHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICBuYW1lOiAnaGlnaExpZ2h0JyxcclxuICAgICAgICAgICAgICAgICAgICB2YWx1ZToge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBsaWdodFBvc2l0aW9uOiBbMSwgMSwgMV0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGxpZ2h0QW1iaWVudDogWzAuNywgMSwgMSwgMV0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGxpZ2h0RGlmZnVzZTogWzAuMiwgMC4xLCAwLjksIDFdLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBsaWdodFNwZWN1bGFyOiBbMC41LCAwLjMsIDAuNywgMV0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHNwZWN1bGFyU3RyZW5ndGg6IDAuNyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgYW1iaWVudFN0cmVuZ3RoOiAwLjgsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG1hdGVyaWFsU2hpbmluZXNzOiA2NCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgb3BhY2l0eTogMC41XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBdLFxyXG4gICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XHJcbiAgICAgICAgICAgICAgICBsaWdodFBvc2l0aW9uOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2FycmF5JyxcclxuICAgICAgICAgICAgICAgICAgICBuYW1lOiAnbGlnaHRQb3NpdGlvbicsXHJcbiAgICAgICAgICAgICAgICAgICAgdmFsdWU6IFsxLCAxLCAxXSxcclxuICAgICAgICAgICAgICAgICAgICBpdGVtczogW1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAncmFuZ2UnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogJ2RpcmVjdGlvblgnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb3B0aW9uczogWzAuMSwgMTAsIDAuMV1cclxuICAgICAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3JhbmdlJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5hbWU6ICdkaXJlY3Rpb25ZJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbnM6IFswLjEsIDEwLCAwLjFdXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdyYW5nZScsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBuYW1lOiAnZGlyZWN0aW9uWicsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zOiBbMC4xLCAxMCwgMC4xXVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgXVxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIGxpZ2h0QW1iaWVudDoge1xyXG4gICAgICAgICAgICAgICAgICAgIHR5cGU6ICdjb2xvcicsXHJcbiAgICAgICAgICAgICAgICAgICAgbmFtZTogJ2xpZ2h0QW1iaWVudCcsXHJcbiAgICAgICAgICAgICAgICAgICAgdmFsdWU6IFsxLjAsIDEuMCwgMS4wLCAxLjBdXHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgbGlnaHREaWZmdXNlOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2NvbG9yJyxcclxuICAgICAgICAgICAgICAgICAgICBuYW1lOiAnbGlnaHREaWZmdXNlJyxcclxuICAgICAgICAgICAgICAgICAgICB2YWx1ZTogWzAuNSwgMC41LCAwLjUsIDEuMF1cclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBsaWdodFNwZWN1bGFyOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2NvbG9yJyxcclxuICAgICAgICAgICAgICAgICAgICBuYW1lOiAnbGlnaHRTcGVjdWxhcicsXHJcbiAgICAgICAgICAgICAgICAgICAgdmFsdWU6IFswLjEsIDAuNywgMC4zLCAxLjBdXHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgYW1iaWVudFN0cmVuZ3RoOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3JhbmdlJyxcclxuICAgICAgICAgICAgICAgICAgICBuYW1lOiAnYW1iaWVudFN0cmVuZ3RoJyxcclxuICAgICAgICAgICAgICAgICAgICBvcHRpb25zOiBbMC4xLCAxLCAwLjFdLFxyXG4gICAgICAgICAgICAgICAgICAgIHZhbHVlOiAwLjVcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBzcGVjdWxhclN0cmVuZ3RoOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3JhbmdlJyxcclxuICAgICAgICAgICAgICAgICAgICBuYW1lOiAnc3BlY3VsYXJTdHJlbmd0aCcsXHJcbiAgICAgICAgICAgICAgICAgICAgb3B0aW9uczogWzAuMSwgMSwgMC4xXSxcclxuICAgICAgICAgICAgICAgICAgICB2YWx1ZTogMC44XHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgbWF0ZXJpYWxTaGluaW5lc3M6IHtcclxuICAgICAgICAgICAgICAgICAgICB0eXBlOiAncmFuZ2UnLFxyXG4gICAgICAgICAgICAgICAgICAgIG5hbWU6ICdtYXRlcmlhbFNoaW5pbmVzcycsXHJcbiAgICAgICAgICAgICAgICAgICAgb3B0aW9uczogWzEuMCwgNjQuMCwgMS4wXSxcclxuICAgICAgICAgICAgICAgICAgICB2YWx1ZTogMzJcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBvcGFjaXR5OiB7XHJcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3JhbmdlJyxcclxuICAgICAgICAgICAgICAgICAgICBuYW1lOiAnb3BhY2l0eScsXHJcbiAgICAgICAgICAgICAgICAgICAgb3B0aW9uczogWzAsIDEsIDAuMDFdLFxyXG4gICAgICAgICAgICAgICAgICAgIHZhbHVlOiAxXHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9O1xyXG4gICAgY29uc3Qgd2lyZWZyYW1lU3R1ZGlvVHlwaW5ncyA9IHtcclxuICAgICAgICBzdHJ1Y3R1cmUgOiB7XHJcbiAgICAgICAgICAgIG5hbWU6ICd3aXJlZnJhbWUnLFxyXG4gICAgICAgICAgICBncm91cHM6IFtcclxuICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICBuYW1lOiAnY29sb3InLFxyXG4gICAgICAgICAgICAgICAgICAgIGNoaWxkcmVuOiBbXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHsgbmFtZTogJ2ZpbGwnIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHsgbmFtZTogJ3N0cm9rZScgfSxcclxuICAgICAgICAgICAgICAgICAgICBdXHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIG5hbWU6ICdkYXNoJyxcclxuICAgICAgICAgICAgICAgICAgICBjaGlsZHJlbjogW1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB7IG5hbWU6ICdkYXNoRW5hYmxlZCcgfSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgeyBuYW1lOiAnZGFzaEFuaW1hdGUnIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHsgbmFtZTogJ2Rhc2hPdmVybGFwJyB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB7IG5hbWU6ICdkYXNoUmVwZWF0cycgfSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgeyBuYW1lOiAnZGFzaExlbmd0aCcgfVxyXG4gICAgICAgICAgICAgICAgICAgIF1cclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICB7ICAgbmFtZTogJ3NxdWVlemUnLFxyXG4gICAgICAgICAgICAgICAgICAgIGNoaWxkcmVuOiBbXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHsgbmFtZTogJ3NlZVRocm91Z2gnIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHsgbmFtZTogJ2luc2lkZUFsdENvbG9yJyB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB7IG5hbWU6ICdkdWFsU3Ryb2tlJyB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB7IG5hbWU6ICdzcXVlZXplTWluJyB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB7IG5hbWU6ICdzcXVlZXplTWF4JyB9XHJcbiAgICAgICAgICAgICAgICAgICAgXVxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICBuYW1lOiAnb3BhY2l0eScsXHJcbiAgICAgICAgICAgICAgICAgICAgY2hpbGRyZW46IFt7IG5hbWU6ICdhbHBoYScgfV1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgdHlwaW5nIDoge1xyXG4gICAgICAgICAgICBuYW1lOiAnd2lyZWZyYW1lJyxcclxuICAgICAgICAgICAgcHJlc2V0czogW1xyXG4gICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIG5hbWUgOiAnU2xlZWsnLFxyXG4gICAgICAgICAgICAgICAgICAgIHZhbHVlOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdzZWVUaHJvdWdoJzogdHJ1ZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ3RoaWNrbmVzcyc6IDAuMDEsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdmaWxsJzogWzAuNzcyNSwgMC43NzI1LCAwLjc3MjUsIDEuMF0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdzdHJva2UnOiBbMC4xMjU1LCAwLjEyNTUsIDAuMTI1NSwgMV0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdkYXNoRW5hYmxlZCc6IHRydWUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdkYXNoQW5pbWF0ZSc6IGZhbHNlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnZGFzaFJlcGVhdHMnOiA5LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnZGFzaExlbmd0aCc6IDAuNyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ2Rhc2hPdmVybGFwJzogdHJ1ZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ25vaXNlQSc6IGZhbHNlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnbm9pc2VCJzogZmFsc2UsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdpbnNpZGVBbHRDb2xvcic6IHRydWUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdzcXVlZXplJzogdHJ1ZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ3NxdWVlemVNaW4nOiAwLjEsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdzcXVlZXplTWF4JzogMSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ2R1YWxTdHJva2UnOiBmYWxzZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ3NlY29uZFRoaWNrbmVzcyc6IDAuMDVcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIG5hbWUgOiAnRnVua3lUb3J1cycsXHJcbiAgICAgICAgICAgICAgICAgICAgdmFsdWU6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ3NlZVRocm91Z2gnOiBmYWxzZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ3RoaWNrbmVzcyc6IDAuMDIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdmaWxsJzogWzAuMDU0OSwgMC4xNDExLCAwLjE4ODIsIDEuMF0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdzdHJva2UnOiBbMC45ODgyLCAwLjIyNzQsIDAuMzE3NiwgMS4wXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ2Rhc2hFbmFibGVkJzogZmFsc2UsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdkYXNoQW5pbWF0ZSc6IGZhbHNlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnZGFzaFJlcGVhdHMnOiAxLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnZGFzaExlbmd0aCc6IDAuOCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ2Rhc2hPdmVybGFwJzogdHJ1ZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ25vaXNlQSc6IGZhbHNlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnbm9pc2VCJzogZmFsc2UsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdpbnNpZGVBbHRDb2xvcic6IHRydWUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdzcXVlZXplJzogdHJ1ZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ3NxdWVlemVNaW4nOiAwLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnc3F1ZWV6ZU1heCc6IDEsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdkdWFsU3Ryb2tlJzogdHJ1ZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ3NlY29uZFRoaWNrbmVzcyc6IDAuMDVcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIG5hbWUgOiAnQmxvY2t5RmFkZScsXHJcbiAgICAgICAgICAgICAgICAgICAgdmFsdWU6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ3NlZVRocm91Z2gnOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAndGhpY2tuZXNzJzogMC4wMSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ2ZpbGwnOiBbMC42OTgsIDAuODM1MywgMC43Mjk0LCAxLjBdLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnc3Ryb2tlJzogWzAuMzgwMywgMC42Nzg0LCAwLjYyNzQsIDEuMF0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdkYXNoRW5hYmxlZCc6IGZhbHNlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnZGFzaEFuaW1hdGUnOiBmYWxzZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ2Rhc2hSZXBlYXRzJzogMSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ2Rhc2hMZW5ndGgnOiAwLjksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdkYXNoT3ZlcmxhcCc6IHRydWUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdub2lzZUEnOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnbm9pc2VCJzogZmFsc2UsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdpbnNpZGVBbHRDb2xvcic6IHRydWUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdzcXVlZXplJzogdHJ1ZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ3NxdWVlemVNaW4nOiAwLjEsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdzcXVlZXplTWF4JzogMSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ2R1YWxTdHJva2UnOiBmYWxzZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ3NlY29uZFRoaWNrbmVzcyc6IDAuMDVcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIG5hbWUgOiAnU2ltcGxlV2lyZScsXHJcbiAgICAgICAgICAgICAgICAgICAgdmFsdWUgOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdzZWVUaHJvdWdoJzogdHJ1ZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ3RoaWNrbmVzcyc6IDAuMDMsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdmaWxsJzogWzAuODIzNSwgMC44MjM1LCAwLjgyMzUsIDEuMF0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdzdHJva2UnOiBbMC42OTgsIDAuMjI3NCwgMC45MzMzLCAxLjBdLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnZGFzaEVuYWJsZWQnOiBmYWxzZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ2Rhc2hBbmltYXRlJzogZmFsc2UsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdkYXNoUmVwZWF0cyc6IDEsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdkYXNoTGVuZ3RoJzogMC44LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnZGFzaE92ZXJsYXAnOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnbm9pc2VBJzogZmFsc2UsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdub2lzZUInOiBmYWxzZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ2luc2lkZUFsdENvbG9yJzogZmFsc2UsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdzcXVlZXplJzogZmFsc2UsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdzcXVlZXplTWluJzogMC41LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnc3F1ZWV6ZU1heCc6IDEsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdkdWFsU3Ryb2tlJzogZmFsc2UsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdzZWNvbmRUaGlja25lc3MnOiAwLjA1XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICBuYW1lIDogJ05pY2VyV2lyZScsXHJcbiAgICAgICAgICAgICAgICAgICAgdmFsdWU6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ3NlZVRocm91Z2gnOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAndGhpY2tuZXNzJzogMC4wMyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ2ZpbGwnOiBbMC45MDE5LCAwLjkwMTksIDAuOTAxOSwgMS4wXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ3N0cm9rZSc6IFswLjE0NSwgMC4xNDUsIDAuMTQ1LCAxLjBdLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnZGFzaEVuYWJsZWQnOiBmYWxzZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ2Rhc2hBbmltYXRlJzogZmFsc2UsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdkYXNoUmVwZWF0cyc6IDEsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdkYXNoTGVuZ3RoJzogMC44LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnZGFzaE92ZXJsYXAnOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnbm9pc2VBJzogZmFsc2UsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdub2lzZUInOiBmYWxzZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ2luc2lkZUFsdENvbG9yJzogdHJ1ZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ3NxdWVlemUnOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnc3F1ZWV6ZU1pbic6IDAuNCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ3NxdWVlemVNYXgnOiAxLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnZHVhbFN0cm9rZSc6IGZhbHNlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnc2Vjb25kVGhpY2tuZXNzJzogMC4wNVxyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgbmFtZSA6ICdBbmltYXRlZCcsXHJcbiAgICAgICAgICAgICAgICAgICAgdmFsdWU6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ3NlZVRocm91Z2gnOiBmYWxzZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ3RoaWNrbmVzcyc6IDAuMDIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdmaWxsJzogWzAuNzc2NCwgMC44MzkyLCAwLjcyMTUsIDEuMF0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdzdHJva2UnOiBbMC41OTYsIDAuNDk4LCAwLjQxMTcsIDEuMF0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdkYXNoRW5hYmxlZCc6IHRydWUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdkYXNoQW5pbWF0ZSc6IHRydWUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdkYXNoUmVwZWF0cyc6IDYsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdkYXNoTGVuZ3RoJzogMC42LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnZGFzaE92ZXJsYXAnOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnbm9pc2VBJzogZmFsc2UsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdub2lzZUInOiBmYWxzZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ2luc2lkZUFsdENvbG9yJzogZmFsc2UsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdzcXVlZXplJzogdHJ1ZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ3NxdWVlemVNaW4nOiAwLjIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdzcXVlZXplTWF4JzogMSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ2R1YWxTdHJva2UnOiBmYWxzZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ3NlY29uZFRoaWNrbmVzcyc6IDAuMDNcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIG5hbWUgOiAnRnVuWm9uZScsXHJcbiAgICAgICAgICAgICAgICAgICAgdmFsdWU6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ3NlZVRocm91Z2gnOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAndGhpY2tuZXNzJzogMC4wMixcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ2ZpbGwnOiBbMC4xMDU4LCAwLjY5MDEsIDAuODA3OCwgMS4wXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ3N0cm9rZSc6IFswLjMwOTgsIDAuNTI1NSwgMC42LCAxLjBdLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnZGFzaEVuYWJsZWQnOiBmYWxzZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ2Rhc2hBbmltYXRlJzogZmFsc2UsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdkYXNoUmVwZWF0cyc6IDIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdkYXNoTGVuZ3RoJzogMC43LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnZGFzaE92ZXJsYXAnOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnbm9pc2VBJzogdHJ1ZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ25vaXNlQic6IHRydWUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdpbnNpZGVBbHRDb2xvcic6IHRydWUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdzcXVlZXplJzogdHJ1ZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ3NxdWVlemVNaW4nOiAwLjIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdzcXVlZXplTWF4JzogMSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ2R1YWxTdHJva2UnOiBmYWxzZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ3NlY29uZFRoaWNrbmVzcyc6IDAuMDNcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIG5hbWUgOiAnRG90dGVkJyxcclxuICAgICAgICAgICAgICAgICAgICB2YWx1ZToge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAnc2VlVGhyb3VnaCc6IHRydWUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICd0aGlja25lc3MnOiAwLjA0LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnZmlsbCc6IFswLjgxMTcsIDAuNDk4LCAwLjM2ODYsIDEuMF0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdzdHJva2UnOiBbMC41NzY1LCAwLjIsIDAuMiwgMS4wXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ2Rhc2hFbmFibGVkJzogdHJ1ZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ2Rhc2hBbmltYXRlJzogZmFsc2UsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdkYXNoUmVwZWF0cyc6IDgsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdkYXNoTGVuZ3RoJzogMC41LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnZGFzaE92ZXJsYXAnOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnbm9pc2VBJzogZmFsc2UsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdub2lzZUInOiBmYWxzZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ2luc2lkZUFsdENvbG9yJzogdHJ1ZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ3NxdWVlemUnOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnc3F1ZWV6ZU1pbic6IDAuMixcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ3NxdWVlemVNYXgnOiAxLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnZHVhbFN0cm9rZSc6IGZhbHNlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnc2Vjb25kVGhpY2tuZXNzJzogMC4wNVxyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgbmFtZSA6ICdGbG93ZXInLFxyXG4gICAgICAgICAgICAgICAgICAgIHZhbHVlOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdzZWVUaHJvdWdoJzogdHJ1ZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ3RoaWNrbmVzcyc6IDAuMDksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdmaWxsJzpbMC44MzkyLCAwLjg4MjMsIDAuNzgwNCwgMS4wXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ3N0cm9rZSc6IFswLjU4MDQsIDAuNzgwNCwgMC43MTM3LCAxLjBdLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnZGFzaEVuYWJsZWQnOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnZGFzaEFuaW1hdGUnOiBmYWxzZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ2Rhc2hSZXBlYXRzJzogMSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ2Rhc2hMZW5ndGgnOiAwLjgsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdkYXNoT3ZlcmxhcCc6IGZhbHNlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnbm9pc2VBJzogZmFsc2UsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdub2lzZUInOiBmYWxzZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ2luc2lkZUFsdENvbG9yJzogdHJ1ZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ3NxdWVlemUnOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnc3F1ZWV6ZU1pbic6IDAuMixcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ3NxdWVlemVNYXgnOiAwLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnZHVhbFN0cm9rZSc6IGZhbHNlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnc2Vjb25kVGhpY2tuZXNzJzogMC4wNVxyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgbmFtZSA6ICdUYXBlcmVkJyxcclxuICAgICAgICAgICAgICAgICAgICB2YWx1ZToge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAnc2VlVGhyb3VnaCc6IGZhbHNlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAndGhpY2tuZXNzJzogMC4wMTUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdmaWxsJzogWzAuODk4LCAwLjg2NjYsIDAuNzk2MSwgMS4wXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ3N0cm9rZSc6IFswLjkyMTUsIDAuNDgyMywgMC4zNDksIDEuMF0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdkYXNoRW5hYmxlZCc6IHRydWUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdkYXNoQW5pbWF0ZSc6IGZhbHNlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnZGFzaFJlcGVhdHMnOiAxLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnZGFzaExlbmd0aCc6IDAuNixcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ2Rhc2hPdmVybGFwJzogdHJ1ZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ25vaXNlQSc6IGZhbHNlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnbm9pc2VCJzogZmFsc2UsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdpbnNpZGVBbHRDb2xvcic6IHRydWUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdzcXVlZXplJzogdHJ1ZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ3NxdWVlemVNaW4nOiAwLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnc3F1ZWV6ZU1heCc6IDAuNjQsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdkdWFsU3Ryb2tlJzogZmFsc2UsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdzZWNvbmRUaGlja25lc3MnOiAwLjAzXHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBdLFxyXG4gICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XHJcbiAgICAgICAgICAgICAgICB0aW1lIDoge1xyXG4gICAgICAgICAgICAgICAgICAgIG5hbWUgOiAndGltZScsXHJcbiAgICAgICAgICAgICAgICAgICAgdHlwZSA6ICdyYW5nZScsXHJcbiAgICAgICAgICAgICAgICAgICAgdmFsdWUgOiAwLjBcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBzZWVUaHJvdWdoIDoge1xyXG4gICAgICAgICAgICAgICAgICAgIG5hbWUgOiAnc2VlVGhyb3VnaCcsXHJcbiAgICAgICAgICAgICAgICAgICAgdHlwZSA6ICdzd2l0Y2gnLFxyXG4gICAgICAgICAgICAgICAgICAgIHZhbHVlIDogdHJ1ZVxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIGZpbGwgOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgbmFtZSA6ICdmaWxsJyxcclxuICAgICAgICAgICAgICAgICAgICB0eXBlIDogJ2NvbG9yJyxcclxuICAgICAgICAgICAgICAgICAgICB2YWx1ZSA6ICBbMS4wLCAwLjUxMzcsIDAuOTgsIDEuMF1cclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBzdHJva2UgOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgbmFtZSA6ICdzdHJva2UnLFxyXG4gICAgICAgICAgICAgICAgICAgIHR5cGUgOiAnY29sb3InLFxyXG4gICAgICAgICAgICAgICAgICAgIHZhbHVlIDogWzAuNzAxOSwgMC45MzMzLCAwLjIyNzQsIDEuMF1cclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBkYXNoRW5hYmxlZCA6IHtcclxuICAgICAgICAgICAgICAgICAgICBuYW1lIDogJ2Rhc2hFbmFibGVkJyxcclxuICAgICAgICAgICAgICAgICAgICB0eXBlIDogJ3N3aXRjaCcsXHJcbiAgICAgICAgICAgICAgICAgICAgdmFsdWUgOiBmYWxzZVxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIGRhc2hBbmltYXRlIDoge1xyXG4gICAgICAgICAgICAgICAgICAgIG5hbWUgOiAnZGFzaEFuaW1hdGUnLFxyXG4gICAgICAgICAgICAgICAgICAgIHR5cGUgOiAnc3dpdGNoJyxcclxuICAgICAgICAgICAgICAgICAgICB2YWx1ZSA6IGZhbHNlXHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgZGFzaE92ZXJsYXAgOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgbmFtZSA6ICdkYXNoT3ZlcmxhcCcsXHJcbiAgICAgICAgICAgICAgICAgICAgdHlwZSA6ICdzd2l0Y2gnLFxyXG4gICAgICAgICAgICAgICAgICAgIHZhbHVlIDogdHJ1ZVxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIGRhc2hSZXBlYXRzIDoge1xyXG4gICAgICAgICAgICAgICAgICAgIG5hbWUgOiAnZGFzaFJlcGVhdHMnLFxyXG4gICAgICAgICAgICAgICAgICAgIHR5cGUgOiAncmFuZ2UnLFxyXG4gICAgICAgICAgICAgICAgICAgIG9wdGlvbnMgOiBbMC4wLCAxMC4wLCAxLjBdLFxyXG4gICAgICAgICAgICAgICAgICAgIHZhbHVlIDogMS4wXHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgZGFzaExlbmd0aCA6IHtcclxuICAgICAgICAgICAgICAgICAgICBuYW1lIDogJ2Rhc2hMZW5ndGgnLFxyXG4gICAgICAgICAgICAgICAgICAgIHR5cGUgOiAncmFuZ2UnLFxyXG4gICAgICAgICAgICAgICAgICAgIG9wdGlvbnMgOiBbMC4wLCAxMC4wLCAwLjFdLFxyXG4gICAgICAgICAgICAgICAgICAgIHZhbHVlIDogMC44XHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgdGhpY2tuZXNzIDoge1xyXG4gICAgICAgICAgICAgICAgICAgIG5hbWUgOiAndGhpY2tuZXNzJyxcclxuICAgICAgICAgICAgICAgICAgICB0eXBlIDogJ3JhbmdlJyxcclxuICAgICAgICAgICAgICAgICAgICBvcHRpb25zIDogWzAuMDEsIDEuMCwgMC4wMV0sXHJcbiAgICAgICAgICAgICAgICAgICAgdmFsdWUgOiAwLjAzXHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgc2Vjb25kVGhpY2tuZXNzIDoge1xyXG4gICAgICAgICAgICAgICAgICAgIG5hbWUgOiAnc2Vjb25kVGhpY2tuZXNzJyxcclxuICAgICAgICAgICAgICAgICAgICB0eXBlIDogJ3JhbmdlJyxcclxuICAgICAgICAgICAgICAgICAgICBvcHRpb25zIDogWzAuMDEsIDEuMCwgMC4wMV0sXHJcbiAgICAgICAgICAgICAgICAgICAgdmFsdWUgOiAwLjA1XHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgaW5zaWRlQWx0Q29sb3IgOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgbmFtZSA6ICdpbnNpZGVBbHRDb2xvcicsXHJcbiAgICAgICAgICAgICAgICAgICAgdHlwZSA6ICdzd2l0Y2gnLFxyXG4gICAgICAgICAgICAgICAgICAgIHZhbHVlIDogZmFsc2VcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBzcXVlZXplIDoge1xyXG4gICAgICAgICAgICAgICAgICAgIG5hbWUgOiAnc3F1ZWV6ZScsXHJcbiAgICAgICAgICAgICAgICAgICAgdHlwZSA6ICdzd2l0Y2gnLFxyXG4gICAgICAgICAgICAgICAgICAgIHZhbHVlIDogZmFsc2VcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBkdWFsU3Ryb2tlIDoge1xyXG4gICAgICAgICAgICAgICAgICAgIG5hbWUgOiAnZHVhbFN0cm9rZScsXHJcbiAgICAgICAgICAgICAgICAgICAgdHlwZSA6ICdzd2l0Y2gnLFxyXG4gICAgICAgICAgICAgICAgICAgIHZhbHVlIDogZmFsc2VcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBzcXVlZXplTWluIDoge1xyXG4gICAgICAgICAgICAgICAgICAgIG5hbWUgOiAnc3F1ZWV6ZU1pbicsXHJcbiAgICAgICAgICAgICAgICAgICAgdHlwZSA6ICdyYW5nZScsXHJcbiAgICAgICAgICAgICAgICAgICAgb3B0aW9ucyA6IFswLjEsIDEuMCwgMC4xXSxcclxuICAgICAgICAgICAgICAgICAgICB2YWx1ZSA6IDAuNVxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIHNxdWVlemVNYXggOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgbmFtZSA6ICdzcXVlZXplTWF4JyxcclxuICAgICAgICAgICAgICAgICAgICB0eXBlIDogJ3JhbmdlJyxcclxuICAgICAgICAgICAgICAgICAgICBvcHRpb25zIDogWzAuMSwgMS4wLCAwLjFdLFxyXG4gICAgICAgICAgICAgICAgICAgIHZhbHVlIDogMS4wXHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgb3BhY2l0eToge1xyXG4gICAgICAgICAgICAgICAgICAgIHR5cGU6ICdyYW5nZScsXHJcbiAgICAgICAgICAgICAgICAgICAgbmFtZTogJ29wYWNpdHknLFxyXG4gICAgICAgICAgICAgICAgICAgIG9wdGlvbnM6IFswLCAxLCAwLjAxXSxcclxuICAgICAgICAgICAgICAgICAgICB2YWx1ZTogMVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuICAgIHJldHVybiB7IHBob25nU3R1ZGlvVHlwaW5ncywgd2lyZWZyYW1lU3R1ZGlvVHlwaW5ncyB9O1xyXG59XHJcbiIsImltcG9ydCAqIGFzIG1hcHRhbGtzIGZyb20gJ21hcHRhbGtzJztcclxuaW1wb3J0IHsgcmVzaGFkZXIgfSBmcm9tICdAbWFwdGFsa3MvZ2wnO1xyXG5pbXBvcnQgeyBjb21waWxlU3R5bGUgfSBmcm9tICdAbWFwdGFsa3MvZmVhdHVyZS1maWx0ZXInO1xyXG5pbXBvcnQgeyBkZWZpbmVkLCBpc05pbCwgaW50ZXJzZWN0QXJyYXkgfSBmcm9tICcuL2NvbW1vbi9VdGlsJztcclxuaW1wb3J0IEdMVEZMYXllclJlbmRlcmVyIGZyb20gJy4vR0xURkxheWVyUmVuZGVyZXInO1xyXG5pbXBvcnQgR2VvSlNPTiBmcm9tICcuL2NvbW1vbi9HZW9KU09OJztcclxuaW1wb3J0IGdldFN0dWRpb1R5cGluZ3MgZnJvbSAnLi9jb21tb24vc3R1ZGlvVHlwaW5ncyc7XHJcbmltcG9ydCBzaW1wbGVNb2RlbCBmcm9tICcuL2NvbW1vbi9TaW1wbGVNb2RlbCc7XHJcbmltcG9ydCBTSEFERVJfTUFQIGZyb20gJy4vY29tbW9uL1NoYWRlck1hcCc7XHJcbmltcG9ydCBnZXREZWZhdWx0U2hhZGVyVHlwaW5ncyBmcm9tICcuL2NvbW1vbi9zaGFkZXJUeXBpbmdzJztcclxuaW1wb3J0IEdMVEZNYXJrZXIgZnJvbSAnLi9HTFRGTWFya2VyJztcclxuXHJcbmNvbnN0IG9wdGlvbnMgPSB7XHJcbiAgICAncmVuZGVyZXInOiAnZ2wnLFxyXG4gICAgJ2RvdWJsZUJ1ZmZlcic6IGZhbHNlLFxyXG4gICAgJ2dsT3B0aW9ucyc6IG51bGwsXHJcbiAgICAnbWFya2VyRXZlbnRzJzogdHJ1ZSxcclxuICAgIGZvcmNlUmVuZGVyT25ab29taW5nOiB0cnVlLFxyXG4gICAgZm9yY2VSZW5kZXJPbk1vdmluZzogdHJ1ZSxcclxuICAgIGZvcmNlUmVuZGVyT25Sb3RhdGluZzogdHJ1ZSxcclxufTtcclxuXHJcbmxldCB1aWQgPSAwO1xyXG4vL+m8oOagh+S6i+S7tuWIl+ihqFxyXG5jb25zdCBNQVBfRVZFTlRTID0gWydtb3VzZWRvd24nLCAnbW91c2V1cCcsICdtb3VzZW1vdmUnLCAnY2xpY2snLCAnZGJjbGljaycsICd0b3VjaHN0YXJ0JywgJ3RvdWNobW92ZScsICd0b3VjaGVuZCddO1xyXG5jb25zdCBQUkVGSUxURVJfQ1VCRV9TSVpFID0gNTEyO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgR0xURkxheWVyIGV4dGVuZHMgbWFwdGFsa3MuTGF5ZXIge1xyXG4gICAgLy9UT0RP5aKe5YqgdG9KU09O5pa55rOVXHJcbiAgICAvL1RPRE8g5Zyo5p6E6YCg5Ye95pWw6YeM6Z2i5aKe5Yqg5a+5Z2VvanNvbueahOaUr+aMge+8jOWinuWKoOesrOS6jOS4quWPguaVsOS9nOS4um1hcmtlcueahOi9veWFpVxyXG4gICAgLy8x44CB5Y2V5LiqTWFya2VyXHJcbiAgICAvLzLjgIFNYXJrZXIg5pWw57uEXHJcbiAgICAvLzPjgIFnZW9qc29u5a+56LGhLOWPquaUr+aMgXBvaW50LOi/mOWPr+iDveaYr+Wtl+espuS4slxyXG4gICAgLy8044CBZ2Vvam9zbuaWh+S7tueahHVybFxyXG4gICAgY29uc3RydWN0b3IoaWQsIG9wdGlvbnMpIHtcclxuICAgICAgICBzdXBlcihpZCwgb3B0aW9ucyk7XHJcbiAgICAgICAgdGhpcy5fbWFya2VyTWFwID0ge307XHJcbiAgICAgICAgdGhpcy5fbWFya2VyTGlzdCA9IFtdO1xyXG4gICAgICAgIHRoaXMucmVxdWVzdHMgPSB7fTtcclxuICAgICAgICB0aGlzLl9tb2RlbE1hcCA9IHt9O1xyXG4gICAgICAgIHRoaXMuX2lkTGlzdCA9IHt9O1xyXG4gICAgICAgIHRoaXMubWFwRXZlbnRzID0gJyc7XHJcbiAgICAgICAgLy90aGlzLl9pbml0RGVmYXVsdFNoYWRlcigpO1xyXG4gICAgICAgIGlmIChvcHRpb25zICYmIG9wdGlvbnMuZGF0YSkge1xyXG4gICAgICAgICAgICB0aGlzLmFkZE1hcmtlcihvcHRpb25zLmRhdGEpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBzdGF0aWMgcmVnaXN0ZXJTaGFkZXIobmFtZSwgdHlwZSwgY29uZmlnLCB1bmlmb3Jtcywgc2hhZGVyVHlwaW5ncykge1xyXG4gICAgICAgIGNoZWNrVHlwaW5ncyh1bmlmb3Jtcywgc2hhZGVyVHlwaW5ncyk7XHJcbiAgICAgICAgU0hBREVSX01BUFtuYW1lXSA9IHsgbmFtZSwgdHlwZSwgY29uZmlnLCB1bmlmb3Jtcywgc2hhZGVyVHlwaW5ncyB9O1xyXG4gICAgfVxyXG5cclxuICAgIHN0YXRpYyByZW1vdmVTaGFkZXIobmFtZSkge1xyXG4gICAgICAgIGRlbGV0ZSBTSEFERVJfTUFQW25hbWVdO1xyXG4gICAgfVxyXG5cclxuICAgIHN0YXRpYyBnZXRTaGFkZXJzKCkge1xyXG4gICAgICAgIGNvbnN0IHNoYWRlcnMgPSBbXTtcclxuICAgICAgICBmb3IgKGNvbnN0IG5hbWUgaW4gU0hBREVSX01BUCkge1xyXG4gICAgICAgICAgICBzaGFkZXJzLnB1c2goe1xyXG4gICAgICAgICAgICAgICAgc2hhZGVyOiBuYW1lLFxyXG4gICAgICAgICAgICAgICAgdW5pZm9ybXM6IFNIQURFUl9NQVBbbmFtZV0udW5pZm9ybXMsXHJcbiAgICAgICAgICAgICAgICBzaGFkZXJUeXBpbmdzOiBTSEFERVJfTUFQW25hbWVdLnNoYWRlclR5cGluZ3NcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBzaGFkZXJzO1xyXG4gICAgfVxyXG5cclxuICAgIHN0YXRpYyBnZXRTaGFkZXJNYXAoKSB7XHJcbiAgICAgICAgcmV0dXJuIFNIQURFUl9NQVA7XHJcbiAgICB9XHJcblxyXG4gICAgc3RhdGljIGluaXREZWZhdWx0U2hhZGVyKCkge1xyXG4gICAgICAgIGNvbnN0IGRlZmF1bHRTaGFkZXJUeXBpbmdzID0gZ2V0RGVmYXVsdFNoYWRlclR5cGluZ3MoKTtcclxuICAgICAgICBjb25zdCBwaG9uZ1NoYWRlciA9IGdldFBob25nU2hhZGVyKCk7XHJcbiAgICAgICAgR0xURkxheWVyLnJlZ2lzdGVyU2hhZGVyKCdwaG9uZycsICdQaG9uZ1NoYWRlcicsIHBob25nU2hhZGVyLnNoYWRlciwgcGhvbmdTaGFkZXIubWF0ZXJpYWwuZ2V0VW5pZm9ybXMoKSwgZGVmYXVsdFNoYWRlclR5cGluZ3MucGhvbmdTdHVkaW9UeXBpbmdzKTtcclxuICAgICAgICBjb25zdCB3aXJlRnJhbWVTaGFkZXIgPSBnZXRXaXJlRnJhbWVTaGFkZXIoKTtcclxuICAgICAgICBHTFRGTGF5ZXIucmVnaXN0ZXJTaGFkZXIoJ3dpcmVmcmFtZScsICdXaXJlZnJhbWVTaGFkZXInLCB3aXJlRnJhbWVTaGFkZXIuc2hhZGVyLCB3aXJlRnJhbWVTaGFkZXIubWF0ZXJpYWwuZ2V0VW5pZm9ybXMoKSwgZGVmYXVsdFNoYWRlclR5cGluZ3Mud2lyZWZyYW1lU3R1ZGlvVHlwaW5ncyk7XHJcbiAgICAgICAgY29uc3QgTGl0U2hhZGVyID0gZ2V0TGl0U2hhZGVyKCk7XHJcbiAgICAgICAgR0xURkxheWVyLnJlZ2lzdGVyU2hhZGVyKCdsaXQnLCAncGJyLkxpdFNoYWRlcicsIExpdFNoYWRlci5zaGFkZXIsIExpdFNoYWRlci5tYXRlcmlhbCk7XHJcbiAgICAgICAgY29uc3QgU3Vic3VmYWNlU2hhZGVyID0gZ2V0U3Vic3VyZmFjZVNoYWRlcigpO1xyXG4gICAgICAgIEdMVEZMYXllci5yZWdpc3RlclNoYWRlcignc3Vic3VyZmFjZScsICdwYnIuU3Vic3VyZmFjZVNoYWRlcicsIFN1YnN1ZmFjZVNoYWRlci5zaGFkZXIsIFN1YnN1ZmFjZVNoYWRlci5tYXRlcmlhbCk7XHJcbiAgICAgICAgY29uc3QgQ2xvdGhTaGFkZXIgPSBnZXRDbG90aFNoYWRlcigpO1xyXG4gICAgICAgIEdMVEZMYXllci5yZWdpc3RlclNoYWRlcignY2xvdGgnLCAncGJyLkNsb3RoU2hhZGVyJywgQ2xvdGhTaGFkZXIuc2hhZGVyLCBDbG90aFNoYWRlci5tYXRlcmlhbCk7XHJcbiAgICB9XHJcblxyXG4gICAgc3RhdGljIGdldFN0dWRpb1R5cGluZ3MoKSB7XHJcbiAgICAgICAgY29uc3Qgc3R1ZGlvVHlwaW5ncyA9IGdldFN0dWRpb1R5cGluZ3MoKTtcclxuICAgICAgICBjb25zdCBzaGFkZXJUeXBpbmdzID0gR0xURkxheWVyLmdldFNoYWRlcnMoKS5tYXAoc2hhZGVyID0+IHtcclxuICAgICAgICAgICAgcmV0dXJuIHNoYWRlci5zaGFkZXJUeXBpbmdzO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc2hhZGVyVHlwaW5ncy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICBjb25zdCBzaGFkZXJUeXBpbmcgPSBzaGFkZXJUeXBpbmdzW2ldO1xyXG4gICAgICAgICAgICBpZiAoc2hhZGVyVHlwaW5nKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBzeW1ib2xQcm9wZXJ0aWVzID0gc3R1ZGlvVHlwaW5ncy50eXBpbmcuaXRlbXNbMF0ucHJvcGVydGllcy5zeW1ib2wucHJvcGVydGllcztcclxuICAgICAgICAgICAgICAgIHN0dWRpb1R5cGluZ3MuZ3JvdXBzWzFdLmNoaWxkcmVuLnB1c2goc2hhZGVyVHlwaW5nLnN0cnVjdHVyZSk7XHJcbiAgICAgICAgICAgICAgICBzeW1ib2xQcm9wZXJ0aWVzLnNoYWRlci5vcHRpb25zLnB1c2goc2hhZGVyVHlwaW5nLnR5cGluZy5uYW1lKTtcclxuICAgICAgICAgICAgICAgIHN5bWJvbFByb3BlcnRpZXMudW5pZm9ybXMub25lT2YucHVzaChzaGFkZXJUeXBpbmcudHlwaW5nKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gc3R1ZGlvVHlwaW5ncztcclxuICAgIH1cclxuXHJcbiAgICBzdGF0aWMgZnJvbUpTT04oanNvbikge1xyXG4gICAgICAgIGlmICghanNvbiB8fCBqc29uWyd0eXBlJ10gIT09ICdHTFRGTGF5ZXInKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgIH1cclxuICAgICAgICBjb25zdCBsYXllciA9IG5ldyBHTFRGTGF5ZXIoanNvblsnaWQnXSwganNvblsnb3B0aW9ucyddKTtcclxuICAgICAgICBjb25zdCBnZW9KU09OcyA9IGpzb25bJ2dlb21ldHJpZXMnXTtcclxuICAgICAgICBjb25zdCBnZW9tZXRyaWVzID0gW107XHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBnZW9KU09Ocy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICBjb25zdCBnZW8gPSBHTFRGTWFya2VyLmZyb21KU09OKGdlb0pTT05zW2ldKTtcclxuICAgICAgICAgICAgaWYgKGdlbykge1xyXG4gICAgICAgICAgICAgICAgZ2VvbWV0cmllcy5wdXNoKGdlbyk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgbGF5ZXIuYWRkTWFya2VyKGdlb21ldHJpZXMpO1xyXG4gICAgICAgIGlmIChqc29uWydzdHlsZSddKSB7XHJcbiAgICAgICAgICAgIGxheWVyLnNldFN0eWxlKGpzb25bJ3N0eWxlJ10pO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gbGF5ZXI7XHJcbiAgICB9XHJcblxyXG4gICAgYWRkTWFya2VyKG1hcmtlcnMpIHtcclxuICAgICAgICAvL21hcmtlcuaVsOe7hOWSjOWNleS4quaUr+aMgVxyXG4gICAgICAgIC8vcmVuZGVyZXLlvILmraVcclxuICAgICAgICAvL+WIpOaWreaYr+WQpuS4umdlb2pzb25cclxuICAgICAgICBpZiAoR2VvSlNPTi5pc0dlb0pTT04obWFya2VycykpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuYWRkTWFya2VyKEdlb0pTT04udG9HZW9tZXRyeShtYXJrZXJzKSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChBcnJheS5pc0FycmF5KG1hcmtlcnMpKSB7XHJcbiAgICAgICAgICAgIG1hcmtlcnMuZm9yRWFjaChtYXJrZXIgPT4ge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5hZGRNYXJrZXIobWFya2VyKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgY29uc3QgbWFya2VyID0gbWFya2VycztcclxuICAgICAgICAgICAgbWFya2VyLl91aWQgPSB1aWQ7XHJcbiAgICAgICAgICAgIHRoaXMuX21hcmtlck1hcFt1aWRdID0gbWFya2VyO1xyXG4gICAgICAgICAgICB0aGlzLl9tYXJrZXJMaXN0LnB1c2gobWFya2VyKTtcclxuICAgICAgICAgICAgbWFya2VyLl9sYXllciA9IHRoaXM7XHJcbiAgICAgICAgICAgIHRoaXMuX2FkZEV2ZW50cyhtYXJrZXIuZ2V0TGlzdGVuaW5nRXZlbnRzKCkpO1xyXG4gICAgICAgICAgICBjb25zdCBpZCA9IG1hcmtlci5nZXRJZCgpO1xyXG4gICAgICAgICAgICBpZiAoaWQpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuX2lkTGlzdFtpZF0gPSBtYXJrZXI7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgdGhpcy5fbG9hZE1vZGVsKG1hcmtlcik7XHJcbiAgICAgICAgICAgIG1hcmtlci5maXJlKCdhZGQnLCB7IHR5cGUgOiAnYWRkJywgdGFyZ2V0IDogbWFya2VyLCBsYXllciA6IHRoaXMgfSk7XHJcbiAgICAgICAgICAgIGlmIChtYXJrZXIuZ2V0VHlwZSgpID09PSAnZ3JvdXBnbHRmbWFya2VyJykge1xyXG4gICAgICAgICAgICAgICAgdWlkICs9IG1hcmtlci5nZXRDb3VudCgpIC0gMTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHVpZCsrO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfVxyXG5cclxuICAgIC8v6I635Y+W5Zu+5bGC5LiK5Yqg6L2955qE5qih5Z6L5pWw5o2uXHJcbiAgICBnZXRNb2RlbHMoKSB7XHJcbiAgICAgICAgdGhpcy5fbW9kZWxNYXBbJ3NwaGVyZSddID0gc2ltcGxlTW9kZWwoJ3NwaGVyZScpO1xyXG4gICAgICAgIHJldHVybiB0aGlzLl9tb2RlbE1hcDtcclxuICAgIH1cclxuXHJcbiAgICAvL1xyXG4gICAgdG9KU09OKG9wdGlvbnMpIHtcclxuICAgICAgICBpZiAoIW9wdGlvbnMpIHtcclxuICAgICAgICAgICAgb3B0aW9ucyA9IHt9O1xyXG4gICAgICAgIH1cclxuICAgICAgICBjb25zdCBwcm9maWxlID0ge1xyXG4gICAgICAgICAgICAndHlwZSc6IHRoaXMuZ2V0SlNPTlR5cGUoKSxcclxuICAgICAgICAgICAgJ2lkJzogdGhpcy5nZXRJZCgpLFxyXG4gICAgICAgICAgICAnb3B0aW9ucyc6IHRoaXMuY29uZmlnKClcclxuICAgICAgICB9O1xyXG4gICAgICAgIGlmIChpc05pbChvcHRpb25zWydzdHlsZSddKSB8fCBvcHRpb25zWydzdHlsZSddKSB7XHJcbiAgICAgICAgICAgIHByb2ZpbGVbJ3N0eWxlJ10gPSB0aGlzLmdldFN0eWxlKCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChpc05pbChvcHRpb25zWydnZW9tZXRyaWVzJ10pIHx8IG9wdGlvbnNbJ2dlb21ldHJpZXMnXSkge1xyXG4gICAgICAgICAgICBjb25zdCBnZW9KU09OcyA9IFtdO1xyXG4gICAgICAgICAgICBjb25zdCBtYXJrZXJzID0gdGhpcy5nZXRNYXJrZXJzKCk7XHJcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbWFya2Vycy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgbWFya2VyID0gbWFya2Vyc1tpXTtcclxuICAgICAgICAgICAgICAgIGNvbnN0IGpzb24gPSBtYXJrZXIudG9KU09OKCk7XHJcbiAgICAgICAgICAgICAgICBnZW9KU09Ocy5wdXNoKGpzb24pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHByb2ZpbGVbJ2dlb21ldHJpZXMnXSA9IGdlb0pTT05zO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gcHJvZmlsZTtcclxuICAgIH1cclxuXHJcbiAgICBfbG9hZE1vZGVsKG1hcmtlcikge1xyXG4gICAgICAgIGNvbnN0IHVybCA9IG1hcmtlci5nZXRVcmwoKTtcclxuICAgICAgICBpZiAodXJsID09PSAnc3BoZXJlJykge1xyXG4gICAgICAgICAgICB0aGlzLl9sb2FkU2ltcGxlTW9kZWwobWFya2VyKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICB0aGlzLl9sb2FkR0xURkRhdGEobWFya2VyKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgX2xvYWRHTFRGRGF0YShtYXJrZXIpIHtcclxuICAgICAgICBjb25zdCByZW5kZXJlciA9IHRoaXMuZ2V0UmVuZGVyZXIoKTtcclxuICAgICAgICBpZiAocmVuZGVyZXIpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3JlcXVlc3RHTFRGRGF0YShtYXJrZXIpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHRoaXMub24oJ3JlbmRlcmVyY3JlYXRlJywgKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fcmVxdWVzdEdMVEZEYXRhKG1hcmtlcik7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgIH1cclxuXHJcbiAgICBfcmVxdWVzdEdMVEZEYXRhKG1hcmtlcikge1xyXG4gICAgICAgIGNvbnN0IHVybCA9IG1hcmtlci5nZXRVcmwoKTtcclxuICAgICAgICBjb25zdCByZW5kZXJlciA9IHRoaXMuZ2V0UmVuZGVyZXIoKTtcclxuICAgICAgICBpZiAoIXRoaXMucmVxdWVzdHNbdXJsXSkge1xyXG4gICAgICAgICAgICB0aGlzLnJlcXVlc3RzW3VybF0gPSBtYXJrZXIuX2xvYWREYXRhKCk7XHJcbiAgICAgICAgICAgIHRoaXMucmVxdWVzdHNbdXJsXS5jb3VudCA9IDA7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiB0aGlzLnJlcXVlc3RzW3VybF0udGhlbigoZGF0YSkgPT4ge1xyXG4gICAgICAgICAgICAvL+WmguaenG1hcmtlcuWcqOa3u+WKoOWQjuWPiOiiq+WIoOmZpOS6hu+8jOW6lOe7iOatouWIm+W7unNjZW5l55qE5pON5L2cXHJcbiAgICAgICAgICAgIGlmICghdGhpcy5fbWFya2VyTWFwW21hcmtlci5fdWlkXSB8fCAhdGhpcy5yZXF1ZXN0c1t1cmxdKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgY29uc3QgZ2x0ZkRhdGEgPSBtYXJrZXIuX2dldEdMVEZEYXRhKCk7XHJcbiAgICAgICAgICAgIGlmICghZ2x0ZkRhdGEpIHtcclxuICAgICAgICAgICAgICAgIG1hcmtlci5fc2V0R0xURkRhdGEoZGF0YSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgdGhpcy5yZXF1ZXN0c1t1cmxdLmdsdGZqc29uID0gbWFya2VyLl9nZXRHTFRGSnNvbigpO1xyXG4gICAgICAgICAgICB0aGlzLl9tb2RlbE1hcFt1cmxdID0gZGF0YTtcclxuICAgICAgICAgICAgcmVuZGVyZXIuX2NyZWF0ZVNjZW5lKG1hcmtlcik7XHJcbiAgICAgICAgICAgIHJlbmRlcmVyLl91cGRhdGVHZW9tZXRyaWVzKG1hcmtlcik7XHJcbiAgICAgICAgICAgIHRoaXMucmVxdWVzdHNbdXJsXS5jb3VudCArPSAxO1xyXG4gICAgICAgICAgICAvL+agh+ivhuW9k+WJjeivt+axguWujOaIkFxyXG4gICAgICAgICAgICB0aGlzLnJlcXVlc3RzW3VybF0uY29tcGxldGUgPSB0cnVlO1xyXG4gICAgICAgICAgICBtYXJrZXIuX3NldExvYWRTdGF0ZSh0cnVlKTtcclxuICAgICAgICAgICAgbWFya2VyLmZpcmUoJ2xvYWQnLCB7IGRhdGE6IGdsdGZEYXRhIH0pO1xyXG4gICAgICAgICAgICBpZiAodGhpcy5faXNNb2RlbHNMb2FkQ29tcGxldGUoKSkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5maXJlKCdtb2RlbGxvYWQnLCB7IG1vZGVsczogdGhpcy5nZXRNb2RlbHMoKSB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIC8v5Yik5pat5omA5pyJ6K+35rGC5piv5ZCm5a6M5oiQXHJcbiAgICBfaXNSZXF1ZXN0c0NvbXBsZXRlKCkge1xyXG4gICAgICAgIGZvciAoY29uc3QgaSBpbiB0aGlzLnJlcXVlc3RzKSB7XHJcbiAgICAgICAgICAgIGlmICghdGhpcy5yZXF1ZXN0c1tpXS5jb21wbGV0ZSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgfVxyXG5cclxuICAgIC8v5Yik5pat5qih5Z6L5pWw5o2u5piv5ZCm6YO96L295YWl5a6M5oiQXHJcbiAgICBfaXNNb2RlbHNMb2FkQ29tcGxldGUoKSB7XHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9tYXJrZXJMaXN0Lmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIGlmICghdGhpcy5fbWFya2VyTGlzdFtpXS5pc0xvYWRlZCgpKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICB9XHJcblxyXG4gICAgX2xvYWRTaW1wbGVNb2RlbChtYXJrZXIpIHtcclxuICAgICAgICBjb25zdCB1cmwgPSBtYXJrZXIuZ2V0VXJsKCk7XHJcbiAgICAgICAgbWFya2VyLl9nbHRmRGF0YSA9IHRoaXMuX21vZGVsTWFwW3VybF0gPSBzaW1wbGVNb2RlbCh1cmwpO1xyXG4gICAgICAgIGNvbnN0IHJlbmRlcmVyID0gdGhpcy5nZXRSZW5kZXJlcigpO1xyXG4gICAgICAgIGlmIChyZW5kZXJlcikge1xyXG4gICAgICAgICAgICByZW5kZXJlci5fY3JlYXRlU2NlbmUobWFya2VyKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICB0aGlzLm9uKCdyZW5kZXJlcmNyZWF0ZScsIChlKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBlLnJlbmRlcmVyLl9jcmVhdGVTY2VuZShtYXJrZXIpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICAgICAgbWFya2VyLl9zZXRMb2FkU3RhdGUodHJ1ZSk7XHJcbiAgICAgICAgbWFya2VyLmZpcmUoJ2xvYWQnLCB7IGRhdGE6IG1hcmtlci5fZ2x0ZkRhdGEgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgLy9sYXllclN0eWxl57uT5p6E5aaC5LiL77yaXHJcbiAgICAvKlxyXG4gICAgICAgIHtcclxuICAgICAgICAgICAgJHJvb3QgOiAnLi4vLi4vJyxcclxuICAgICAgICAgICAgc3R5bGUgOiBbXHJcbiAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgZmlsdGVyIDogWycnLCcnLC4uLl0sXHJcbiAgICAgICAgICAgICAgICAgICAgc3ltYm9sIDoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB1cmwgOiAneyRyb290fS8uLi8uZ2x0ZicsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHVuaWZvcm0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHNoYWRlclxyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAuLi5cclxuICAgICAgICAgICAgXVxyXG4gICAgICAgIH1cclxuICAgICovXHJcbiAgICBzZXRTdHlsZShsYXllclN0eWxlKSB7XHJcbiAgICAgICAgLy/lpoLmnpxsYXllclN0eWxl5Li656m677yM5YiZ5oGi5aSN6buY6K6k5qC35byPXHJcbiAgICAgICAgaWYgKCFsYXllclN0eWxlKSB7XHJcbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzLl9sYXllclN0eWxlO1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcztcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5fbGF5ZXJTdHlsZSA9IEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkobGF5ZXJTdHlsZSkpO1xyXG4gICAgICAgIHRoaXMuX3N0eWxlTWFya2VyTGlzdCgpO1xyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfVxyXG5cclxuICAgIGdldFN0eWxlKCkge1xyXG4gICAgICAgIGlmICh0aGlzLl9sYXllclN0eWxlKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9sYXllclN0eWxlLiRyb290ID8gdGhpcy5fbGF5ZXJTdHlsZS5zdHlsZSA6IHRoaXMuX2xheWVyU3R5bGU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiB0aGlzLl9sYXllclN0eWxlO1xyXG4gICAgfVxyXG5cclxuICAgIHVwZGF0ZVN5bWJvbChpZHgsIHN5bWJvbFByb3BlcnRpZXMpIHtcclxuICAgICAgICBjb25zdCBzdHlsZSA9IHRoaXMuZ2V0U3R5bGUoKTtcclxuICAgICAgICBpZiAoIXN0eWxlKSB7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgICAgY29uc3Qgc3ltYm9sID0gc3R5bGVbaWR4XS5zeW1ib2wgfHwge307XHJcbiAgICAgICAgZm9yIChjb25zdCBwIGluIHN5bWJvbFByb3BlcnRpZXMpIHtcclxuICAgICAgICAgICAgc3ltYm9sW3BdID0gc3ltYm9sUHJvcGVydGllc1twXTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5fc3R5bGVNYXJrZXJMaXN0KCk7XHJcbiAgICB9XHJcblxyXG4gICAgX3N0eWxlTWFya2VyTGlzdCgpIHtcclxuICAgICAgICB0aGlzLl9wcm9jZXNzUm9vdFVybCh0aGlzLl9sYXllclN0eWxlKTtcclxuICAgICAgICBjb25zdCBjb29rU3R5bGVzID0gdGhpcy5fbGF5ZXJTdHlsZS4kcm9vdCA/IHRoaXMuX2xheWVyU3R5bGUuc3R5bGUgOiB0aGlzLl9sYXllclN0eWxlO1xyXG4gICAgICAgIHRoaXMuX2Nvb2tlZFN0eWxlcyA9IGNvbXBpbGVTdHlsZShjb29rU3R5bGVzKTtcclxuICAgICAgICB0aGlzLl9tYXJrZXJMaXN0LmZvckVhY2goZnVuY3Rpb24gKG1hcmtlcikge1xyXG4gICAgICAgICAgICB0aGlzLl9zdHlsZU1hcmtlcihtYXJrZXIpO1xyXG4gICAgICAgIH0sIHRoaXMpO1xyXG4gICAgfVxyXG5cclxuICAgIGdldEdMVEZVcmxzKCkge1xyXG4gICAgICAgIHJldHVybiBPYmplY3Qua2V5cyh0aGlzLnJlcXVlc3RzKTtcclxuICAgIH1cclxuXHJcbiAgICAvL+WwhnN5bWJvbOS4rXVybOeahCRyb2906YOo5YiG55Soc3R5bGXnmoRyb2905pu/5o2iXHJcbiAgICBfcHJvY2Vzc1Jvb3RVcmwobGF5ZXJTdHlsZSkge1xyXG4gICAgICAgIGlmIChtYXB0YWxrcy5VdGlsLmlzU3RyaW5nKGxheWVyU3R5bGUuJHJvb3QpKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHJlZ2V4ID0gL1xceyooXFwkcm9vdCkqXFx9L2c7XHJcbiAgICAgICAgICAgIGxheWVyU3R5bGUuc3R5bGUuZm9yRWFjaChzdGwgPT4ge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgdXJsID0gc3RsLnN5bWJvbC51cmw7XHJcbiAgICAgICAgICAgICAgICBpZiAodXJsICYmIHVybC5pbmRleE9mKCd7JHJvb3R9JykgPiAtMSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHN0bC5zeW1ib2wudXJsID0gdXJsLnJlcGxhY2UocmVnZXgsIGxheWVyU3R5bGUuJHJvb3QpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgX3N0eWxlTWFya2VyKG1hcmtlcikge1xyXG4gICAgICAgIGlmICghdGhpcy5fY29va2VkU3R5bGVzKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHRoaXMuX2Nvb2tlZFN0eWxlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xyXG4gICAgICAgICAgICBpZiAodGhpcy5fY29va2VkU3R5bGVzW2ldWydmaWx0ZXInXSh7IHByb3BlcnRpZXM6IG1hcmtlci5nZXRQcm9wZXJ0aWVzKCkgfSkgPT09IHRydWUpIHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IHN5bWJvbCA9IHRoaXMuX2Nvb2tlZFN0eWxlc1tpXVsnc3ltYm9sJ107XHJcbiAgICAgICAgICAgICAgICBjb25zdCBuZXdVcmwgPSBzeW1ib2wudXJsO1xyXG4gICAgICAgICAgICAgICAgY29uc3Qgb2xkVXJsID0gbWFya2VyLmdldFVybCgpO1xyXG4gICAgICAgICAgICAgICAgbWFya2VyLl9zZXRQcm9wSW5FeHRlcm5TeW1ib2woJ3VybCcsIG5ld1VybCk7XHJcbiAgICAgICAgICAgICAgICBpZiAobmV3VXJsICYmIG5ld1VybCAhPT0gb2xkVXJsKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbG9hZEdMVEZEYXRhKG1hcmtlcikudGhlbigoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX3JlbW92ZUdMVEZSZXF1ZXN0cyhvbGRVcmwpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBtYXJrZXIuX3NldEV4dGVyblN5bWJvbChzeW1ib2wpO1xyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICBtYXJrZXIuX3NldEV4dGVyblN5bWJvbChzeW1ib2wpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfVxyXG5cclxuICAgIF91cGRhdGVHZW9tZXRyaWVzKG1hcmtlcikge1xyXG4gICAgICAgIGNvbnN0IHJlbmRlcmVyID0gdGhpcy5nZXRSZW5kZXJlcigpO1xyXG4gICAgICAgIGlmIChyZW5kZXJlcikge1xyXG4gICAgICAgICAgICByZW5kZXJlci5fdXBkYXRlR2VvbWV0cmllcyhtYXJrZXIpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBfYWRkRXZlbnRzKGV2ZW50cykge1xyXG4gICAgICAgIGNvbnN0IHNwbGl0RXZlbnRzID0gbWFwdGFsa3MuVXRpbC5pc1N0cmluZyhldmVudHMpID8gZXZlbnRzLnNwbGl0KC9cXHMrLykubWFwKGUgPT4ge1xyXG4gICAgICAgICAgICAvL21vdXNlbGVhdmXjgIFtb3VzZWVudGVy44CBbW91c2VvdXTpnIDopoHnva7mjaLmiJBtYXDnmoRtb3VzZW1vdmXkuovku7ZcclxuICAgICAgICAgICAgcmV0dXJuIChlID09PSAnbW91c2VsZWF2ZScgfHwgZSA9PT0gJ21vdXNlZW50ZXInIHx8IGUgPT09ICdtb3VzZW91dCcpID8gJ21vdXNlbW92ZScgOiBlO1xyXG4gICAgICAgIH0pIDogZXZlbnRzO1xyXG4gICAgICAgIGNvbnN0IGN1cnJlbnRFdmVudHMgPSB0aGlzLm1hcEV2ZW50cztcclxuICAgICAgICBjb25zdCBuZXdFdmVudHMgPSBpbnRlcnNlY3RBcnJheShzcGxpdEV2ZW50cywgTUFQX0VWRU5UUykuZmlsdGVyKGUgPT4ge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5tYXBFdmVudHMuaW5kZXhPZihlKSA8IDA7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgdGhpcy5tYXBFdmVudHMgKz0gJyAnICsgbmV3RXZlbnRzLmpvaW4oJyAnKTtcclxuICAgICAgICB0aGlzLm1hcEV2ZW50cyA9IHRoaXMubWFwRXZlbnRzLnRyaW0oKTtcclxuICAgICAgICBjb25zdCBtYXAgPSB0aGlzLmdldE1hcCgpO1xyXG4gICAgICAgIGlmIChtYXApIHtcclxuICAgICAgICAgICAgbWFwLm9mZihjdXJyZW50RXZlbnRzLCB0aGlzLl9tYXBFdmVudEhhbmRsZXIsIHRoaXMpO1xyXG4gICAgICAgICAgICBtYXAub24odGhpcy5tYXBFdmVudHMsIHRoaXMuX21hcEV2ZW50SGFuZGxlciwgdGhpcyk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgLy/ljrvph41cclxuICAgIF9yZW1vdmVFdmVudHMoKSB7XHJcbiAgICAgICAgY29uc3QgbmV3RXZlbnRzID0ge307XHJcbiAgICAgICAgY29uc3QgY3VycmVudEV2ZW50cyA9IHRoaXMubWFwRXZlbnRzO1xyXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fbWFya2VyTGlzdC5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICBjb25zdCBtYXJrZXIgPSB0aGlzLl9tYXJrZXJMaXN0W2ldO1xyXG4gICAgICAgICAgICAvL21hcmtlcuiHquW3seeahOS6i+S7tu+8jOe9ruaNom1vdXNlbGVhdmXjgIFtb3VzZWVudGVy44CBbW91c2VvdXTkuLptb3VzZW1vdmVcclxuICAgICAgICAgICAgY29uc3QgbWFya2VyRXZlbnRzID0gbWFya2VyLmdldExpc3RlbmluZ0V2ZW50cygpLm1hcChlID0+IHtcclxuICAgICAgICAgICAgICAgIHJldHVybiAoZSA9PT0gJ21vdXNlbGVhdmUnIHx8IGUgPT09ICdtb3VzZWVudGVyJyB8fCBlID09PSAnbW91c2VvdXQnKSA/ICdtb3VzZW1vdmUnIDogZTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIC8v5pyJ5pWI55qEbWFw5LqL5Lu2XHJcbiAgICAgICAgICAgIGZvciAobGV0IGlpID0gMDsgaWkgPCBtYXJrZXJFdmVudHMubGVuZ3RoOyBpaSsrKSB7XHJcbiAgICAgICAgICAgICAgICAvL+WIqeeUqOWvueixoeWtl+mdoumHj+i/m+ihjOWOu+mHje+8jOS+i+WmglthLCBiLCBjLCBtb3VzZW1vdmVdID0+ICB7YToxLGI6MSxjOjEsbW91c2Vtb3ZlOjF9XHJcbiAgICAgICAgICAgICAgICBuZXdFdmVudHNbbWFya2VyRXZlbnRzW2lpXV0gPSAxO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMubWFwRXZlbnRzID0gaW50ZXJzZWN0QXJyYXkoT2JqZWN0LmtleXMobmV3RXZlbnRzKSwgTUFQX0VWRU5UUykuam9pbignICcpO1xyXG4gICAgICAgIGNvbnN0IG1hcCA9IHRoaXMuZ2V0TWFwKCk7XHJcbiAgICAgICAgaWYgKG1hcCkge1xyXG4gICAgICAgICAgICBtYXAub2ZmKGN1cnJlbnRFdmVudHMsIHRoaXMuX21hcEV2ZW50SGFuZGxlciwgdGhpcyk7XHJcbiAgICAgICAgICAgIG1hcC5vbih0aGlzLm1hcEV2ZW50cywgdGhpcy5fbWFwRXZlbnRIYW5kbGVyLCB0aGlzKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcmVtb3ZlTWFya2VyKG1hcmtlcnMpIHtcclxuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShtYXJrZXJzKSkge1xyXG4gICAgICAgICAgICBtYXJrZXJzLmZvckVhY2gobWFya2VyID0+IHtcclxuICAgICAgICAgICAgICAgIHRoaXMucmVtb3ZlTWFya2VyKG1hcmtlcik7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2RlbGV0ZU1hcmtlcihtYXJrZXJzKTtcclxuICAgICAgICAgICAgdGhpcy5fcmVtb3ZlRXZlbnRzKCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHJlbW92ZSgpIHtcclxuICAgICAgICBjb25zdCBtYXAgPSB0aGlzLmdldE1hcCgpO1xyXG4gICAgICAgIGlmICghbWFwKSB7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgICAgbWFwLm9mZih0aGlzLm1hcEV2ZW50cywgdGhpcy5fbWFwRXZlbnRIYW5kbGVyKTtcclxuICAgICAgICBzdXBlci5yZW1vdmUoKTtcclxuICAgIH1cclxuXHJcbiAgICBpZGVudGlmeSh4LCB5LCBvcHRpb25zKSB7XHJcbiAgICAgICAgY29uc3QgcmVuZGVyZXIgPSB0aGlzLmdldFJlbmRlcmVyKCk7XHJcbiAgICAgICAgaWYgKHJlbmRlcmVyKSB7XHJcbiAgICAgICAgICAgIHJldHVybiByZW5kZXJlci5faWRlbnRpZnkoeCwgeSwgb3B0aW9ucyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgfVxyXG5cclxuICAgIF9kZWxldGVNYXJrZXIobWFya2VyKSB7XHJcbiAgICAgICAgY29uc3QgdXJsID0gbWFya2VyLmdldFVybCgpO1xyXG4gICAgICAgIGNvbnN0IGlkID0gbWFwdGFsa3MuVXRpbC5pc1N0cmluZyhtYXJrZXIpID8gdGhpcy5faWRMaXN0W21hcmtlcl0uX3VpZCA6IG1hcmtlci5fdWlkO1xyXG4gICAgICAgIHRoaXMuX21hcmtlckxpc3Quc3BsaWNlKHRoaXMuX21hcmtlckxpc3QuaW5kZXhPZih0aGlzLl9tYXJrZXJNYXBbaWRdKSwgMSk7XHJcbiAgICAgICAgaWYgKHRoaXMucmVxdWVzdHNbdXJsXSkge1xyXG4gICAgICAgICAgICB0aGlzLnJlcXVlc3RzW3VybF0uY291bnQgLT0gMTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHRoaXMucmVxdWVzdHNbdXJsXS5jb3VudCA8PSAwKSB7XHJcbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzLnJlcXVlc3RzW3VybF07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGNvbnN0IHJlbmRlcmVyID0gdGhpcy5nZXRSZW5kZXJlcigpO1xyXG4gICAgICAgIGlmIChyZW5kZXJlcikge1xyXG4gICAgICAgICAgICByZW5kZXJlci5fZGVsZXRlU2NlbmUoaWQpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBkZWxldGUgdGhpcy5fbWFya2VyTWFwW2lkXTtcclxuICAgICAgICBkZWxldGUgdGhpcy5faWRMaXN0W21hcmtlcl07XHJcbiAgICB9XHJcblxyXG4gICAgX3JlbW92ZUdMVEZSZXF1ZXN0cyh1cmwpIHtcclxuICAgICAgICBpZiAoIXRoaXMucmVxdWVzdHNbdXJsXSkge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMucmVxdWVzdHNbdXJsXS5jb3VudCAtPSAxO1xyXG4gICAgICAgIGlmICh0aGlzLnJlcXVlc3RzW3VybF0uY291bnQgPD0gMCkge1xyXG4gICAgICAgICAgICBkZWxldGUgdGhpcy5yZXF1ZXN0c1t1cmxdO1xyXG4gICAgICAgICAgICBkZWxldGUgdGhpcy5fbW9kZWxNYXBbdXJsXTtcclxuICAgICAgICB9XHJcbiAgICAgICAgY29uc3QgcmVuZGVyZXIgPSB0aGlzLmdldFJlbmRlcmVyKCk7XHJcbiAgICAgICAgaWYgKHJlbmRlcmVyKSB7XHJcbiAgICAgICAgICAgIHJlbmRlcmVyLl9yZW1vdmVHZW9tZXRyeSh1cmwpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBnZXRNYXJrZXJzKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLl9tYXJrZXJMaXN0O1xyXG4gICAgfVxyXG5cclxuICAgIGdldEJ5SWQoaWQpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5faWRMaXN0W2lkXTtcclxuICAgIH1cclxuXHJcbiAgICBnZXRDb3VudCgpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5fbWFya2VyTGlzdC5sZW5ndGg7XHJcbiAgICB9XHJcblxyXG4gICAgZ2V0QWxsKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLl9tYXJrZXJMaXN0LnNsaWNlKDApO1xyXG4gICAgfVxyXG5cclxuICAgIGNsZWFyKCkge1xyXG4gICAgICAgIGNvbnN0IHJlbmRlcmVyID0gdGhpcy5nZXRSZW5kZXJlcigpO1xyXG4gICAgICAgIGlmIChyZW5kZXJlcikge1xyXG4gICAgICAgICAgICByZW5kZXJlci5fZGVsZXRlQWxsKCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMuX21hcmtlck1hcCA9IHt9O1xyXG4gICAgICAgIHRoaXMuX21hcmtlckxpc3QgPSBbXTtcclxuICAgICAgICB0aGlzLnJlcXVlc3RzID0ge307XHJcbiAgICAgICAgdGhpcy5faWRMaXN0ID0ge307XHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9XHJcblxyXG4gICAgX21hcEV2ZW50SGFuZGxlcihlKSB7XHJcbiAgICAgICAgaWYgKCF0aGlzLm9wdGlvbnMubWFya2VyRXZlbnRzKSB7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgICAgY29uc3QgbWFwID0gdGhpcy5nZXRNYXAoKTtcclxuICAgICAgICBpZiAoIW1hcCkge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMuX2xhc3RUYXJnZXRJZCA9IHRoaXMuX2N1cnJlbnRUYXJnZXRJZDtcclxuICAgICAgICB0aGlzLl9sYXN0UG9pbnQgPSB0aGlzLl9jdXJyZW50UG9pbnQ7XHJcbiAgICAgICAgdGhpcy5fbGFzdE1lc2hJZCA9IHRoaXMuX2N1cnJlbnRNZXNoSWQ7XHJcbiAgICAgICAgdGhpcy5fbGFzdFBpY2tpbmdJZCA9IHRoaXMuX2N1cnJlbnRQaWNraW5nSWQ7XHJcbiAgICAgICAgY29uc3QgY29udGFpbmVyUG9pbnQgPSBtYXAuY29vcmRpbmF0ZVRvQ29udGFpbmVyUG9pbnQoZS5jb29yZGluYXRlLCBtYXAuZ2V0R0xab29tKCkpO1xyXG4gICAgICAgIGNvbnN0IHggPSBNYXRoLnJvdW5kKGNvbnRhaW5lclBvaW50LngpLCB5ID0gTWF0aC5yb3VuZChjb250YWluZXJQb2ludC55KTtcclxuICAgICAgICBpZiAoeCA8PSAwIHx8IHggPj0gbWFwLndpZHRoIHx8IHkgPD0gMCB8fCB5ID49IG1hcC5oZWlnaHQpIHtcclxuICAgICAgICAgICAgdGhpcy5fY3VycmVudFRhcmdldElkID0gbnVsbDtcclxuICAgICAgICAgICAgdGhpcy5fY3VycmVudE1lc2hJZCA9IG51bGw7XHJcbiAgICAgICAgICAgIHRoaXMuX2N1cnJlbnRQb2ludCA9IG51bGw7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gdGhpcy5pZGVudGlmeSh4LCB5KTtcclxuICAgICAgICBpZiAoIXJlc3VsdCkge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMuX2N1cnJlbnRUYXJnZXRJZCA9IHJlc3VsdC50YXJnZXQgPyByZXN1bHQudGFyZ2V0Ll91aWQgOiBudWxsO1xyXG4gICAgICAgIHRoaXMuX2N1cnJlbnRNZXNoSWQgPSByZXN1bHQubWVzaElkO1xyXG4gICAgICAgIHRoaXMuX2N1cnJlbnRQb2ludCA9IEpTT04uc3RyaW5naWZ5KHJlc3VsdC5wb2ludCk7XHJcbiAgICAgICAgdGhpcy5fY3VycmVudFBpY2tpbmdJZCA9IHJlc3VsdC5waWNraW5nSWQ7XHJcbiAgICAgICAgaWYgKGUudHlwZSA9PT0gJ21vdXNlbW92ZScpIHtcclxuICAgICAgICAgICAgY29uc3QgbW91c2Vtb3ZlVGFyZ2V0cyA9IHRoaXMuX2dldE1vdXNlTW92ZVRhcmdldHMoKTtcclxuICAgICAgICAgICAgbW91c2Vtb3ZlVGFyZ2V0cy5mb3JFYWNoKGUgPT4ge1xyXG4gICAgICAgICAgICAgICAgZS50YXJnZXQuZmlyZShlLnR5cGUsIGUpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9IGVsc2UgaWYgKHJlc3VsdC50YXJnZXQpIHtcclxuICAgICAgICAgICAgcmVzdWx0LnRhcmdldC5maXJlKGUudHlwZSwge1xyXG4gICAgICAgICAgICAgICAgdHlwZTogZS50eXBlLFxyXG4gICAgICAgICAgICAgICAgdGFyZ2V0OiByZXN1bHQudGFyZ2V0LFxyXG4gICAgICAgICAgICAgICAgbWVzaElkOiByZXN1bHQubWVzaElkLFxyXG4gICAgICAgICAgICAgICAgcGlja2luZ0lkIDogcmVzdWx0LnBpY2tpbmdJZCxcclxuICAgICAgICAgICAgICAgIHBvaW50OiByZXN1bHQucG9pbnRcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIF9nZXRNb3VzZU1vdmVUYXJnZXRzKCkge1xyXG4gICAgICAgIGNvbnN0IGV2ZW50VGFyZ2V0cyA9IFtdO1xyXG4gICAgICAgIGlmIChkZWZpbmVkKHRoaXMuX2N1cnJlbnRUYXJnZXRJZCkgJiYgIWRlZmluZWQodGhpcy5fbGFzdFRhcmdldElkKSkge1xyXG4gICAgICAgICAgICBldmVudFRhcmdldHMucHVzaCh7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiAnbW91c2VlbnRlcicsXHJcbiAgICAgICAgICAgICAgICB0YXJnZXQ6IHRoaXMuX21hcmtlck1hcFt0aGlzLl9jdXJyZW50VGFyZ2V0SWRdLFxyXG4gICAgICAgICAgICAgICAgbWVzaElkOiB0aGlzLl9jdXJyZW50TWVzaElkLFxyXG4gICAgICAgICAgICAgICAgcGlja2luZ0lkIDogdGhpcy5fY3VycmVudFBpY2tpbmdJZCxcclxuICAgICAgICAgICAgICAgIHBvaW50OiBKU09OLnBhcnNlKHRoaXMuX2N1cnJlbnRQb2ludClcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfSBlbHNlIGlmICghZGVmaW5lZCh0aGlzLl9jdXJyZW50VGFyZ2V0SWQpICYmIGRlZmluZWQodGhpcy5fbGFzdFRhcmdldElkKSkge1xyXG4gICAgICAgICAgICBldmVudFRhcmdldHMucHVzaCh7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiAnbW91c2VvdXQnLFxyXG4gICAgICAgICAgICAgICAgdGFyZ2V0OiB0aGlzLl9tYXJrZXJNYXBbdGhpcy5fbGFzdFRhcmdldElkXSxcclxuICAgICAgICAgICAgICAgIG1lc2hJZDogdGhpcy5fbGFzdE1lc2hJZCxcclxuICAgICAgICAgICAgICAgIHBpY2tpbmdJZCA6IHRoaXMuX2xhc3RQaWNraW5nSWQsXHJcbiAgICAgICAgICAgICAgICBwb2ludDogSlNPTi5wYXJzZSh0aGlzLl9sYXN0UG9pbnQpXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIHR5cGU6ICdtb3VzZWxlYXZlJyxcclxuICAgICAgICAgICAgICAgIHRhcmdldDogdGhpcy5fbWFya2VyTWFwW3RoaXMuX2xhc3RUYXJnZXRJZF0sXHJcbiAgICAgICAgICAgICAgICBtZXNoSWQ6IHRoaXMuX2xhc3RNZXNoSWQsXHJcbiAgICAgICAgICAgICAgICBwaWNraW5nSWQgOiB0aGlzLl9sYXN0UGlja2luZ0lkLFxyXG4gICAgICAgICAgICAgICAgcG9pbnQ6IEpTT04ucGFyc2UodGhpcy5fbGFzdFBvaW50KVxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9IGVsc2UgaWYgKGRlZmluZWQodGhpcy5fY3VycmVudFRhcmdldElkKSAmJiBkZWZpbmVkKHRoaXMuX2xhc3RUYXJnZXRJZCkpIHtcclxuICAgICAgICAgICAgaWYgKHRoaXMuX2N1cnJlbnRUYXJnZXRJZCA9PT0gdGhpcy5fbGFzdFRhcmdldElkKSB7XHJcbiAgICAgICAgICAgICAgICBldmVudFRhcmdldHMucHVzaCh7XHJcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ21vdXNlbW92ZScsXHJcbiAgICAgICAgICAgICAgICAgICAgdGFyZ2V0OiB0aGlzLl9tYXJrZXJNYXBbdGhpcy5fY3VycmVudFRhcmdldElkXSxcclxuICAgICAgICAgICAgICAgICAgICBtZXNoSWQ6IHRoaXMuX2N1cnJlbnRNZXNoSWQsXHJcbiAgICAgICAgICAgICAgICAgICAgcGlja2luZ0lkIDogdGhpcy5fY3VycmVudFBpY2tpbmdJZCxcclxuICAgICAgICAgICAgICAgICAgICBwb2ludDogSlNPTi5wYXJzZSh0aGlzLl9jdXJyZW50UG9pbnQpXHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIGV2ZW50VGFyZ2V0cy5wdXNoKHtcclxuICAgICAgICAgICAgICAgICAgICB0eXBlOiAnbW91c2VlbnRlcicsXHJcbiAgICAgICAgICAgICAgICAgICAgdGFyZ2V0OiB0aGlzLl9tYXJrZXJNYXBbdGhpcy5fY3VycmVudFRhcmdldElkXSxcclxuICAgICAgICAgICAgICAgICAgICBtZXNoSWQ6IHRoaXMuX2N1cnJlbnRNZXNoSWQsXHJcbiAgICAgICAgICAgICAgICAgICAgcGlja2luZ0lkIDogdGhpcy5fY3VycmVudFBpY2tpbmdJZCxcclxuICAgICAgICAgICAgICAgICAgICBwb2ludDogSlNPTi5wYXJzZSh0aGlzLl9jdXJyZW50UG9pbnQpXHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIHR5cGU6ICdtb3VzZW91dCcsXHJcbiAgICAgICAgICAgICAgICAgICAgdGFyZ2V0OiB0aGlzLl9tYXJrZXJNYXBbdGhpcy5fbGFzdFRhcmdldElkXSxcclxuICAgICAgICAgICAgICAgICAgICBtZXNoSWQ6IHRoaXMuX2xhc3RNZXNoSWQsXHJcbiAgICAgICAgICAgICAgICAgICAgcGlja2luZ0lkIDogdGhpcy5fbGFzdFBpY2tpbmdJZCxcclxuICAgICAgICAgICAgICAgICAgICBwb2ludDogSlNPTi5wYXJzZSh0aGlzLl9sYXN0UG9pbnQpXHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIHR5cGU6ICdtb3VzZWxlYXZlJyxcclxuICAgICAgICAgICAgICAgICAgICB0YXJnZXQ6IHRoaXMuX21hcmtlck1hcFt0aGlzLl9sYXN0VGFyZ2V0SWRdLFxyXG4gICAgICAgICAgICAgICAgICAgIG1lc2hJZDogdGhpcy5fbGFzdE1lc2hJZCxcclxuICAgICAgICAgICAgICAgICAgICBwaWNraW5nSWQgOiB0aGlzLl9sYXN0UGlja2luZ0lkLFxyXG4gICAgICAgICAgICAgICAgICAgIHBvaW50OiBKU09OLnBhcnNlKHRoaXMuX2xhc3RQb2ludClcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBldmVudFRhcmdldHM7XHJcbiAgICB9XHJcblxyXG4gICAgZ2V0UmVzb3VyY2VGaWxlcyhjYikge1xyXG4gICAgICAgIGlmICghY2IpIHtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAodGhpcy5faXNNb2RlbHNMb2FkQ29tcGxldGUoKSkge1xyXG4gICAgICAgICAgICBjYih0aGlzLl9jb3B5UmVzb3VyY2VzKCkpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHRoaXMub24oJ21vZGVsbG9hZCcsICgpID0+IHtcclxuICAgICAgICAgICAgICAgIGNiKHRoaXMuX2NvcHlSZXNvdXJjZXMoKSk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBfY29weVJlc291cmNlcygpIHtcclxuICAgICAgICBjb25zdCByZXNvdXJjZXMgPSB7fTtcclxuICAgICAgICBmb3IgKGNvbnN0IGtleSBpbiB0aGlzLnJlcXVlc3RzKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGpzb24gPSB0aGlzLnJlcXVlc3RzW2tleV0uZ2x0Zmpzb247XHJcbiAgICAgICAgICAgIGNvbnN0IGZpbGVzID0gcmVzb2x2ZVJlc291Y2VGaWxlcyhqc29uKTtcclxuICAgICAgICAgICAgcmVzb3VyY2VzW2tleV0gPSBmaWxlcztcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHJlc291cmNlcztcclxuICAgIH1cclxuXHJcbiAgICBzZXRJQkxTa3lCb3goc2t5Ym94VGV4dHVyZXMpIHtcclxuICAgICAgICBjb25zdCBwcm9taXNlcyA9IHNreWJveFRleHR1cmVzLm1hcCh1cmwgPT4gbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUpIHtcclxuICAgICAgICAgICAgY29uc3QgaW1nID0gbmV3IEltYWdlKCk7XHJcbiAgICAgICAgICAgIGltZy5vbmxvYWQgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgICAgICByZXNvbHZlKGltZyk7XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIGltZy5zcmMgPSB1cmw7XHJcbiAgICAgICAgfSkpO1xyXG4gICAgICAgIFByb21pc2UuYWxsKHByb21pc2VzKS50aGVuKGltYWdlcyA9PiB7XHJcbiAgICAgICAgICAgIGNvbnN0IHJlbmRlcmVyID0gdGhpcy5nZXRSZW5kZXJlcigpO1xyXG4gICAgICAgICAgICBpZiAocmVuZGVyZXIpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuX2NyZXN0ZUlCTE1hcHMoaW1hZ2VzLCByZW5kZXJlcik7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLm9uKCdyZW5kZXJlcmNyZWF0ZScsIChlKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fY3Jlc3RlSUJMTWFwcyhpbWFnZXMsIGUucmVuZGVyZXIpO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBfY3Jlc3RlSUJMTWFwcyhpbWFnZXMsIHJlbmRlcmVyKSB7XHJcbiAgICAgICAgY29uc3QgbWFwID0gdGhpcy5nZXRNYXAoKTtcclxuICAgICAgICBjb25zdCBpYmxNYXBzID0gY3JlYXRlTWFwcyhyZW5kZXJlci5yZWdsLCBpbWFnZXMuc2xpY2UoMCwgNikpO1xyXG4gICAgICAgIC8vIENMRUFSX0NPQVRfTk9STUFMX1RFWFRVUkUgPSBuZXcgcmVzaGFkZXIuVGV4dHVyZTJEKHJlZ2wudGV4dHVyZShpbWFnZXNbOV0pKTtcclxuICAgICAgICByZW5kZXJlci5faWJsVW5pZm9ybXMgPSB7XHJcbiAgICAgICAgICAgICdsaWdodF9pYmxERkcnOiBpYmxNYXBzLmRmZ0xVVCxcclxuICAgICAgICAgICAgJ2xpZ2h0X2libFNwZWN1bGFyJzogaWJsTWFwcy5wcmVmaWx0ZXJNYXAsXHJcbiAgICAgICAgICAgICdyZXNvbHV0aW9uJzogW3JlbmRlcmVyLmNhbnZhcy53aWR0aCwgcmVuZGVyZXIuY2FudmFzLmhlaWdodCwgMSAvIHJlbmRlcmVyLmNhbnZhcy53aWR0aCwgMSAvIHJlbmRlcmVyLmNhbnZhcy5oZWlnaHRdLFxyXG4gICAgICAgICAgICAnY2FtZXJhUG9zaXRpb24nOiBtYXAuY2FtZXJhUG9zaXRpb24sXHJcbiAgICAgICAgICAgICdpYmxTSCc6IGlibE1hcHMuc2hcclxuICAgICAgICB9O1xyXG4gICAgICAgIHJlbmRlcmVyLl91bmlmb3JtcyA9IG1hcHRhbGtzLlV0aWwuZXh0ZW5kKHt9LCByZW5kZXJlci5faWJsVW5pZm9ybXMsIHJlbmRlcmVyLl91bmlmb3Jtcyk7XHJcbiAgICB9XHJcbn1cclxuXHJcbkdMVEZMYXllci5pbml0RGVmYXVsdFNoYWRlcigpO1xyXG5cclxuR0xURkxheWVyLm1lcmdlT3B0aW9ucyhvcHRpb25zKTtcclxuR0xURkxheWVyLnJlZ2lzdGVySlNPTlR5cGUoJ0dMVEZMYXllcicpO1xyXG5cclxuR0xURkxheWVyLnJlZ2lzdGVyUmVuZGVyZXIoJ2dsJywgR0xURkxheWVyUmVuZGVyZXIpO1xyXG5cclxuZnVuY3Rpb24gY2hlY2tUeXBpbmdzKHVuaWZvcm1zLCBzdHVkaW9UeXBpbmdzKSB7XHJcbiAgICBpZiAoIXN0dWRpb1R5cGluZ3MpIHtcclxuICAgICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICBjb25zdCBuYW1lcyA9IE9iamVjdC5rZXlzKHVuaWZvcm1zKTtcclxuICAgIGNvbnN0IHN0dWRpb1R5cGVOYW1lcyA9IE9iamVjdC5rZXlzKHN0dWRpb1R5cGluZ3MudHlwaW5nLnByb3BlcnRpZXMpO1xyXG4gICAgLy/mo4Dmn6VzdHVkaW9UeXBpbmdz6YeM5o+Q5L6b55qEdHlwZeeahOWQjeensOWSjHVuaWZvcm1z6YeM6Z2i5o+Q5L6b55qE5ZCN56ew5piv5ZCm5LiA6Ie0XHJcbiAgICBjb25zdCBpbnRlcnNlY3QgPSBpbnRlcnNlY3RBcnJheShuYW1lcywgc3R1ZGlvVHlwZU5hbWVzKTtcclxuICAgIGlmIChpbnRlcnNlY3QubGVuZ3RoIDwgbmFtZXMubGVuZ3RoKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdzdHVkaW9UeXBpbmdzXFwncyBuYW1lIGlzIG5vdCBtYXRjaGluZyB3aXRoIHVuaWZyb21zXFwncyBuYW1lJyk7XHJcbiAgICB9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGdldFBob25nU2hhZGVyKCkge1xyXG4gICAgY29uc3Qgc2hhZGVyID0ge1xyXG4gICAgICAgIHBvc2l0aW9uQXR0cmlidXRlOiAnUE9TSVRJT04nXHJcbiAgICB9O1xyXG4gICAgY29uc3QgbWF0ZXJpYWwgPSBuZXcgcmVzaGFkZXIuUGhvbmdNYXRlcmlhbCgpO1xyXG4gICAgcmV0dXJuIHsgc2hhZGVyLCBtYXRlcmlhbCB9O1xyXG59XHJcblxyXG5mdW5jdGlvbiBnZXRXaXJlRnJhbWVTaGFkZXIoKSB7XHJcbiAgICBjb25zdCBzaGFkZXIgPSB7XHJcbiAgICAgICAgcG9zaXRpb25BdHRyaWJ1dGU6ICdQT1NJVElPTicsXHJcbiAgICAgICAgZXh0cmFDb21tYW5kUHJvcHM6IHtcclxuICAgICAgICAgICAgY3VsbDoge1xyXG4gICAgICAgICAgICAgICAgZW5hYmxlOiBmYWxzZSxcclxuICAgICAgICAgICAgICAgIGZhY2U6ICdiYWNrJ1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBmcm9udEZhY2U6ICdjdydcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG4gICAgY29uc3QgbWF0ZXJpYWwgPSBuZXcgcmVzaGFkZXIuV2lyZUZyYW1lTWF0ZXJpYWwoKTtcclxuICAgIHJldHVybiB7IHNoYWRlciwgbWF0ZXJpYWwgfTtcclxufVxyXG5cclxuZnVuY3Rpb24gZ2V0TGl0U2hhZGVyKCkge1xyXG4gICAgY29uc3Qgc2hhZGVyID0ge1xyXG4gICAgICAgIHBvc2l0aW9uQXR0cmlidXRlIDogJ1BPU0lUSU9OJyxcclxuICAgICAgICBub3JtYWxBdHRyaWJ1dGUgOiAnTk9STUFMJyxcclxuICAgICAgICB0YW5nZW50QXR0cmlidXRlIDogJ1RBTkdFTlQnLFxyXG4gICAgICAgIGNvbG9yQXR0cmlidXRlIDogJ0NPTE9SXzAnLFxyXG4gICAgICAgIHV2MEF0dHJpYnV0ZSA6ICdURVhDT09SRF8wJyxcclxuICAgICAgICB1djFBdHRyaWJ1dGUgOiAnVEVYQ09PUkRfMScsXHJcbiAgICAgICAgLy9UT0RPLCDmmK/lkKblj6/ku6XljrvmjolcclxuICAgICAgICBleHRyYUNvbW1hbmRQcm9wczoge1xyXG4gICAgICAgICAgICBjdWxsOiB7XHJcbiAgICAgICAgICAgICAgICBlbmFibGU6IGZhbHNlLFxyXG4gICAgICAgICAgICAgICAgZmFjZTogJ2JhY2snXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9O1xyXG4gICAgY29uc3QgbWF0ZXJpYWwgPSBuZXcgcmVzaGFkZXIucGJyLkxpdE1hdGVyaWFsKHtcclxuICAgICAgICAnYmFzZUNvbG9yRmFjdG9yJzogWzEuMCwgMS4wLCAxLjAsIDEuMF0sXHJcbiAgICAgICAgJ21ldGFsbGljRmFjdG9yJyA6IDAuNSxcclxuICAgICAgICAncm91Z2huZXNzRmFjdG9yJyA6IDAuNSxcclxuICAgICAgICAncmVmbGVjdGFuY2UnOiAwLjUsXHJcbiAgICAgICAgJ2NsZWFyQ29hdCc6IDAsXHJcbiAgICAgICAgJ2NsZWFyQ29hdFJvdWdobmVzcyc6IDAuMyxcclxuICAgICAgICAnYW5pc290cm9weSc6IDBcclxuICAgIH0pO1xyXG4gICAgcmV0dXJuIHsgc2hhZGVyLCBtYXRlcmlhbCB9O1xyXG59XHJcblxyXG5mdW5jdGlvbiBnZXRTdWJzdXJmYWNlU2hhZGVyKCkge1xyXG4gICAgY29uc3Qgc2hhZGVyID0ge1xyXG4gICAgICAgIHBvc2l0aW9uQXR0cmlidXRlIDogJ1BPU0lUSU9OJyxcclxuICAgICAgICBub3JtYWxBdHRyaWJ1dGUgOiAnTk9STUFMJyxcclxuICAgICAgICB0YW5nZW50QXR0cmlidXRlIDogJ1RBTkdFTlQnLFxyXG4gICAgICAgIGNvbG9yQXR0cmlidXRlIDogJ0NPTE9SXzAnLFxyXG4gICAgICAgIHV2MEF0dHJpYnV0ZSA6ICdURVhDT09SRF8wJyxcclxuICAgICAgICB1djFBdHRyaWJ1dGUgOiAnVEVYQ09PUkRfMSdcclxuICAgIH07XHJcbiAgICBjb25zdCBtYXRlcmlhbCA9IG5ldyByZXNoYWRlci5wYnIuU3Vic3VyZmFjZU1hdGVyaWFsKCk7XHJcbiAgICByZXR1cm4geyBzaGFkZXIsIG1hdGVyaWFsIH07XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGdldENsb3RoU2hhZGVyKCkge1xyXG4gICAgY29uc3Qgc2hhZGVyID0ge1xyXG4gICAgICAgIHBvc2l0aW9uQXR0cmlidXRlIDogJ1BPU0lUSU9OJyxcclxuICAgICAgICBub3JtYWxBdHRyaWJ1dGUgOiAnTk9STUFMJyxcclxuICAgICAgICB0YW5nZW50QXR0cmlidXRlIDogJ1RBTkdFTlQnLFxyXG4gICAgICAgIGNvbG9yQXR0cmlidXRlIDogJ0NPTE9SXzAnLFxyXG4gICAgICAgIHV2MEF0dHJpYnV0ZSA6ICdURVhDT09SRF8wJyxcclxuICAgICAgICB1djFBdHRyaWJ1dGUgOiAnVEVYQ09PUkRfMSdcclxuICAgIH07XHJcbiAgICBjb25zdCBtYXRlcmlhbCA9IG5ldyByZXNoYWRlci5wYnIuQ2xvdGhNYXRlcmlhbCgpO1xyXG4gICAgcmV0dXJuIHsgc2hhZGVyLCBtYXRlcmlhbCB9O1xyXG59XHJcblxyXG5mdW5jdGlvbiByZXNvbHZlUmVzb3VjZUZpbGVzKGdsdGYpIHtcclxuICAgIGxldCByZXNvdXJjZXMgPSBbXTtcclxuICAgIGNvbnN0IGdldFVyaSA9IGZ1bmN0aW9uIChyZXMpIHtcclxuICAgICAgICBjb25zdCB1cmkgPSBbXTtcclxuICAgICAgICBpZiAocmVzKSB7XHJcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcmVzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCByID0gcmVzW2ldO1xyXG4gICAgICAgICAgICAgICAgaWYgKHIgJiYgdHlwZW9mIHIudXJpID09PSAnc3RyaW5nJykge1xyXG4gICAgICAgICAgICAgICAgICAgIHVyaS5wdXNoKHIudXJpKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gdXJpO1xyXG4gICAgfTtcclxuICAgIHJlc291cmNlcyA9IHJlc291cmNlcy5jb25jYXQoZ2V0VXJpKGdsdGYuYnVmZmVycykpO1xyXG4gICAgcmVzb3VyY2VzID0gcmVzb3VyY2VzLmNvbmNhdChnZXRVcmkoZ2x0Zi5pbWFnZXMpKTtcclxuICAgIHJldHVybiByZXNvdXJjZXM7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGNyZWF0ZU1hcHMocmVnbCwgaGRyKSB7XHJcbiAgICByZXR1cm4gcmVzaGFkZXIucGJyLlBCUkhlbHBlci5jcmVhdGVJQkxNYXBzKHJlZ2wsIHtcclxuICAgICAgICBlbnZUZXh0dXJlIDogaGRyLFxyXG4gICAgICAgIGVudkN1YmVTaXplOiBQUkVGSUxURVJfQ1VCRV9TSVpFLFxyXG4gICAgICAgIHByZWZpbHRlckN1YmVTaXplOiA1MTJcclxuICAgIH0pO1xyXG59XHJcbiJdLCJuYW1lcyI6WyJ0eXBlcyIsImNyZWF0ZUZpbHRlciIsImZpbHRlciIsIkZ1bmN0aW9uIiwiY29tcGlsZSIsIm9wIiwibGVuZ3RoIiwic3RyIiwiY29tcGlsZUNvbXBhcmlzb25PcCIsImNvbXBpbGVMb2dpY2FsT3AiLCJzbGljZSIsImNvbXBpbGVOZWdhdGlvbiIsImNvbXBpbGVJbk9wIiwiY29tcGlsZUhhc09wIiwiY29tcGlsZVByb3BlcnR5UmVmZXJlbmNlIiwicHJvcGVydHkiLCJzdWJzdHJpbmciLCJKU09OIiwic3RyaW5naWZ5IiwidmFsdWUiLCJjaGVja1R5cGUiLCJsZWZ0IiwicmlnaHQiLCJpbmRleE9mIiwiZXhwcmVzc2lvbnMiLCJtYXAiLCJqb2luIiwidmFsdWVzIiwic29ydCIsImNvbXBhcmUiLCJleHByZXNzaW9uIiwiYSIsImIiLCJjb21waWxlU3R5bGUiLCJzdHlsZXMiLCJBcnJheSIsImlzQXJyYXkiLCJjb21waWxlZCIsImkiLCJwdXNoIiwiZXh0ZW5kIiwiZGVzdCIsImFyZ3VtZW50cyIsInNyYyIsImsiLCJpc05pbCIsIm9iaiIsImRlZmluZWQiLCJpc0VtcHR5T2JqZWN0IiwiZSIsInQiLCJpbnRlcnNlY3RBcnJheSIsImJTZXQiLCJTZXQiLCJmcm9tIiwidiIsImhhcyIsImRlY29tcG9zZSIsIm1hdCIsInRyYW5zbGF0aW9uIiwicXVhdGVybmlvbiIsInNjYWxlIiwic3giLCJzeSIsInN6IiwiZGV0IiwiZGV0ZXJtaW5hdGUiLCJtYXRyaXgiLCJjb3B5IiwiaW52U1giLCJpbnZTWSIsImludlNaIiwicXVhdEZyb21Sb3RhdGlvbk1hdHJpeCIsIk1hdGgiLCJzcXJ0IiwibSIsImRzdCIsIm0xMSIsIm0xMiIsIm0xMyIsIm0yMSIsIm0yMiIsIm0yMyIsIm0zMSIsIm0zMiIsIm0zMyIsInRyYWNlIiwicyIsIkZsb2F0MzJBcnJheSIsIm0wMCIsIm0wMSIsIm0wMiIsIm0wMyIsIm0xMCIsIm0yMCIsIm0zMCIsInRtcDAiLCJ0bXAxIiwidG1wMiIsInRtcDMiLCJ0bXA0IiwidG1wNSIsInRtcDYiLCJ0bXA3IiwidG1wOCIsInRtcDkiLCJ0bXAxMCIsInRtcDExIiwidDAiLCJ0MSIsInQyIiwidDMiLCJjIiwidSIsImYiLCJuIiwibyIsImNvbnNvbGUiLCJlcnJvciIsInNwbGljZSIsInIiLCJNdXRhdGlvbk9ic2VydmVyIiwicHJvY2VzcyIsIm5leHRUaWNrIiwic2V0SW1tZWRpYXRlIiwic2V0VGltZW91dCIsImRvY3VtZW50IiwiY3JlYXRlRWxlbWVudCIsIm9ic2VydmUiLCJhdHRyaWJ1dGVzIiwic2V0QXR0cmlidXRlIiwibCIsIlR5cGVFcnJvciIsInJlc29sdmUiLCJyZWplY3QiLCJoIiwieSIsImNhbGwiLCJwIiwicHJvdG90eXBlIiwic3RhdGUiLCJ0aGVuIiwiaGFuZGxlZCIsInN1cHByZXNzVW5jYXVnaHRSZWplY3Rpb25FcnJvciIsIndhcm4iLCJzdGFjayIsImNhdGNoIiwiZmluYWxseSIsInRpbWVvdXQiLCJFcnJvciIsImFsbCIsIm1vZHVsZSIsImV4cG9ydHMiLCJkZWZpbmUiLCJhbWQiLCJab3VzYW4iLCJzb29uIiwiZ2xvYmFsIiwidGhpcyIsIkVQU0lMT04iLCJBUlJBWV9UWVBFIiwiZGVncmVlIiwiUEkiLCJjcmVhdGUiLCJvdXQiLCJnbE1hdHJpeCIsImZyb21Sb3RhdGlvblRyYW5zbGF0aW9uU2NhbGUiLCJxIiwieCIsInoiLCJ3IiwieDIiLCJ5MiIsInoyIiwieHgiLCJ4eSIsInh6IiwieXkiLCJ5eiIsInp6Iiwid3giLCJ3eSIsInd6IiwiZnJvbVZhbHVlcyIsIm5vcm1hbGl6ZSIsImxlbiIsImRvdCIsImNyb3NzIiwiYXgiLCJheSIsImF6IiwiYngiLCJieSIsImJ6IiwiZm9yRWFjaCIsInZlYyIsInN0cmlkZSIsIm9mZnNldCIsImNvdW50IiwiZm4iLCJhcmciLCJtaW4iLCJzZXRBeGlzQW5nbGUiLCJheGlzIiwicmFkIiwic2luIiwiY29zIiwic2xlcnAiLCJhdyIsImJ3Iiwib21lZ2EiLCJjb3NvbSIsInNpbm9tIiwic2NhbGUwIiwic2NhbGUxIiwiYWNvcyIsImZyb21NYXQzIiwiZlRyYWNlIiwiZlJvb3QiLCJqIiwidmVjNCIsInJvdGF0aW9uVG8iLCJ0bXB2ZWMzIiwidmVjMyIsInhVbml0VmVjMyIsInlVbml0VmVjMyIsInNxbGVycCIsInRlbXAxIiwidGVtcDIiLCJkIiwic2V0QXhlcyIsIm1hdHIiLCJtYXQzIiwidmlldyIsInVwIiwiUHJvbWlzZSIsImdldCIsIl9nZXRDbGllbnQiLCJvcGVuIiwiaGVhZGVycyIsInNldFJlcXVlc3RIZWFkZXIiLCJ3aXRoQ3JlZGVudGlhbHMiLCJjcmVkZW50aWFscyIsInJlc3BvbnNlVHlwZSIsIm9ucmVhZHlzdGF0ZWNoYW5nZSIsIl93cmFwQ2FsbGJhY2siLCJzZW5kIiwieGhyIiwicmVhZHlTdGF0ZSIsInN0YXR1cyIsInJlc3BvbnNlIiwiYnl0ZUxlbmd0aCIsImRhdGEiLCJjYWNoZUNvbnRyb2wiLCJnZXRSZXNwb25zZUhlYWRlciIsImV4cGlyZXMiLCJjb250ZW50VHlwZSIsInJlc3BvbnNlVGV4dCIsInN0YXR1c1RleHQiLCJYTUxIdHRwUmVxdWVzdCIsIkFjdGl2ZVhPYmplY3QiLCJnZXRBcnJheUJ1ZmZlciIsImlzRmluaXRlIiwiZ2V0SlNPTiIsInBhcnNlIiwicm9vdFBhdGgiLCJnbHRmIiwiaXRlcmF0ZSIsImNyZWF0ZU5vZGUiLCJuYW1lIiwiY2hpbGRyZW4iLCJqb2ludE5hbWUiLCJyb3RhdGlvbiIsImV4dHJhcyIsIm1lc2hlcyIsImdldEJhc2VDb2xvclRleHR1cmUiLCJtYXRlcmlhbHMiLCJpbnN0YW5jZVRlY2huaXF1ZSIsImRpZmZ1c2UiLCJ0ZXgiLCJ0ZXh0dXJlcyIsInNhbXBsZXJzIiwic2FtcGxlciIsImZvcm1hdCIsImludGVybmFsRm9ybWF0IiwidHlwZSIsInNvdXJjZSIsImltYWdlcyIsImdldE1hdGVyaWFsIiwiZ2V0QW5pbWF0aW9ucyIsImdsYkJ1ZmZlciIsImJ1ZmZlcnMiLCJyZXF1ZXN0cyIsIl9yZXF1ZXN0RGF0YSIsImFjY2Vzc29ycyIsImJ1ZmZlclZpZXdzIiwiYnVmZmVyVmlldyIsImJ1ZmZlciIsInVyaSIsIl90b1R5cGVkQXJyYXkiLCJhcnJheSIsIml0ZW1TaXplIiwiYWNjZXNzb3JOYW1lIiwiYnl0ZU9mZnNldCIsIl9nZXRUeXBlSXRlbVNpemUiLCJfZ2V0QXJyYXlDdG9yIiwiY29tcG9uZW50VHlwZSIsImJ5dGVTdHJpZGUiLCJCWVRFU19QRVJfRUxFTUVOVCIsIkludDhBcnJheSIsIlVpbnQ4QXJyYXkiLCJJbnQxNkFycmF5IiwiVWludDE2QXJyYXkiLCJJbnQzMkFycmF5IiwiVWludDMyQXJyYXkiLCJnIiwiX3JlcXVlc3RJbWFnZSIsImFjY2Vzc29yIiwibWVzaCIsInNraW4iLCJza2luSW5kZXgiLCJwYnJNZXRhbGxpY1JvdWdobmVzcyIsIm5vcm1hbFRleHR1cmUiLCJvY2NsdXNpb25UZXh0dXJlIiwiZW1pc3NpdmVUZXh0dXJlIiwiX2dldFBick1ldGFsbGljUm91Z2huZXNzIiwiX2dldFRleHR1cmVJbmZvIiwibWF0ZXJpYWwiLCJiYXNlQ29sb3JUZXh0dXJlIiwibWV0YWxsaWNSb3VnaG5lc3NUZXh0dXJlIiwiaW5kZXgiLCJfZ2V0VGV4dHVyZSIsInRleHR1cmUiLCJfbG9hZEltYWdlIiwiaW1hZ2UiLCJ3aWR0aCIsImhlaWdodCIsIm1pbWVUeXBlIiwiZXh0ZW5zaW9ucyIsIl9yZXF1ZXN0RnJvbVVybCIsIl9yZXF1ZXN0RnJvbUFycmF5QnVmZmVyIiwiX3JlcXVlc3RGcm9tR2xiQnVmZmVyIiwiX2dldEltYWdlSW5mbyIsIl9jcmVhdGVEYXRhVmlldyIsIkJsb2IiLCJVUkwiLCJjcmVhdGVPYmplY3RVUkwiLCJfdHJhbnNmb3JtQXJyYXlCdWZmZXJUb0Jhc2U2NCIsIlN0cmluZyIsImZyb21DaGFyQ29kZSIsIndpbmRvdyIsImJ0b2EiLCJ1bmVzY2FwZSIsImVuY29kZVVSSUNvbXBvbmVudCIsImdldFNhbXBsZXJzIiwiaW5wdXQiLCJvdXRwdXQiLCJpbnRlcnBvbGF0aW9uIiwiVGV4dERlY29kZXIiLCJCSU4iLCJyZWFkIiwiRGF0YVZpZXciLCJnZXRVaW50MzIiLCJyZWFkVjEiLCJyZWFkVjIiLCJqc29uIiwiZGVjb2RlIiwiXyIsIl9nZXRUUlNXIiwiYW5pbWF0aW9ucyIsImNoYW5uZWxzIiwidGFyZ2V0Iiwibm9kZSIsInBhdGgiLCJUIiwiX2dldEFuaW1hdGVEYXRhIiwiUiIsIl9nZXRRdWF0ZXJuaW9uIiwiUyIsIlciLCJfZ2V0UHJlTmV4dCIsInByZXZpb3VzIiwibmV4dCIsIl9nZXRDdWJpY1NwbGluZSIsIl9nZXRJbnRlcnBvbGF0aW9uIiwicHJlSW5kZXgiLCJuZXh0SW5kZXgiLCJtYXgiLCJwb3ciLCJnZXRBbmltYXRpb25DbGlwIiwibm9kZXMiLCJ3ZWlnaHRzIiwidHJzIiwiZ2V0VGltZVNwYW4iLCJvcHRpb25zIiwiQXJyYXlCdWZmZXIiLCJfaW5pdCIsImxvYWQiLCJfbG9hZFNjZW5lIiwiX2xvYWRBbmltYXRpb25zIiwiZ2V0QW5pbWF0aW9uVGltZVNwYW4iLCJ2ZXJzaW9uIiwiYXNzZXQiLCJyZXF1ZXN0SW1hZ2UiLCJJIiwiYWRhcHRlciIsIl9wYXJzZU5vZGVzIiwiY29uc3RydWN0b3IiLCJub2RlSW5kZXgiLCJqb2ludHMiLCJfbG9hZE5vZGVzIiwic2NlbmVzIiwiTnVtYmVyIiwic2NlbmUiLCJza2lucyIsIl9sb2FkTWVzaGVzIiwiX2xvYWRTa2lucyIsIl9sb2FkU2tpbiIsImludmVyc2VCaW5kTWF0cmljZXMiLCJfbG9hZE1lc2giLCJjb25jYXQiLCJwcmltaXRpdmVzIiwiX2xvYWRQcmltaXRpdmUiLCJfbG9hZE1hdGVyaWFsIiwiaW5kaWNlcyIsInRhcmdldHMiLCJ0cmFuc2ZlcmFibGVzIiwicmVkdWNlIiwibW9kZSIsIktIUl9iaW5hcnlfZ2xURiIsImJpbmFyeV9nbFRGIiwiT2JqZWN0Iiwia2V5cyIsIkltYWdlIiwib25sb2FkIiwiZ2V0Q29udGV4dCIsImRyYXdJbWFnZSIsImdldEltYWdlRGF0YSIsIm9uZXJyb3IiLCJwbGFuZXMiLCJpbnRlcnNlY3RzQm94IiwiYm94IiwibWFzayIsInNldFBsYW5lcyIsImNoYXJBdCIsInBsYW5lIiwiZGlzdGFuY2VUb1BvaW50IiwibWUiLCJtZTAiLCJtZTEiLCJtZTIiLCJtZTMiLCJtZTQiLCJtZTUiLCJtZTYiLCJtZTciLCJtZTgiLCJtZTkiLCJtZTEwIiwibWUxMSIsIm1lMTIiLCJtZTEzIiwibWUxNCIsIm1lMTUiLCJzZXRDb21wb25lbnRzIiwibm9ybWFsTGVuZ3RoIiwiU0hBREVSX01BUCIsIlNraW4iLCJpbnZlcnNlQmluZE1hdHJpeERhdGEiLCJqb2ludFRleHR1cmUiLCJqb2ludE1hdHJpY2VzIiwiam9pbnREYXRhIiwiam9pbnRUZXh0dXJlU2l6ZSIsInVwZGF0ZSIsIm5vZGVNYXRyaXgiLCJnbG9iYWxXb3JsZEludmVyc2UiLCJtYXQ0IiwiaW52ZXJ0Iiwiam9pbnQiLCJtdWx0aXBseSIsIlRSUyIsInNldE1hdHJpeCIsIkFOSU1BVElPTl9USU1FIiwicGlja2luZ1ZlcnQiLCJtb3JwaFZTIiwibW9ycGhGUyIsIlYwIiwiVjEiLCJNT0RFUyIsIlRFWFRVUkVfU0FNUExFUiIsIlBSRUZJTFRFUl9DVUJFX1NJWkUiLCJHTFRGTGF5ZXJSZW5kZXJlciIsImxheWVyIiwiZ2x0ZlNjZW5lcyIsIl9nZW9tZXRyaWVzIiwiX3NoYWRlckxpc3QiLCJzaWduIiwiX2luaXRTaGFkZXIiLCJkcmF3IiwidGltZXN0YW1wIiwicHJlcGFyZUNhbnZhcyIsIl9yZW5kZXJTY2VuZSIsImRyYXdPbkludGVyYWN0aW5nIiwibmVlZFRvUmVkcmF3IiwidWlkIiwiX21hcmtlck1hcCIsIm1hcmtlciIsImlzRGlydHkiLCJoaXREZXRlY3QiLCJjcmVhdGVDb250ZXh0IiwiY2FudmFzIiwiZ2wiLCJ3cmFwIiwiZ2xPcHRpb25zIiwiYWxwaGEiLCJkZXB0aCIsInN0ZW5jaWwiLCJfY3JlYXRlR0xDb250ZXh0IiwicmVnbCIsImNyZWF0ZVJFR0wiLCJvcHRpb25hbEV4dGVuc2lvbnMiLCJfaW5pdFJlbmRlcmVyIiwiZmlyZSIsImNvbnRleHQiLCJnZXRNYXAiLCJyZW5kZXJlciIsInJlc2hhZGVyIiwiUmVuZGVyZXIiLCJfdW5pZm9ybXMiLCJwcm9qTWF0cml4IiwicHJvalZpZXdNYXRyaXgiLCJ2aWV3TWF0cml4IiwiY2FtZXJhUG9zaXRpb24iLCJwaWNraW5nRkJPIiwiZnJhbWVidWZmZXIiLCJfcGlja2luZyIsIkZCT1JheVBpY2tpbmciLCJ2ZXJ0IiwidW5pZm9ybXMiLCJwcm9wcyIsInNoYWRlck1hcCIsInNoYWRlciIsIl9yZWdpc3RlclNoYWRlciIsImNvbmZpZyIsInZpZXdwb3J0IiwiX21vcnBoU2hhZGVyIiwiTWVzaFNoYWRlciIsImZyYWciLCJkZWZpbmVzIiwiZXh0cmFDb21tYW5kUHJvcHMiLCJfdXBkYXRlR2VvbWV0cmllcyIsImdldFNoYWRlciIsImdlb21ldHJ5T2JqZWN0IiwiZ2V0VXJsIiwiZ2VvbWV0cmllcyIsImdlb09iamVjdCIsImdlb21ldHJ5IiwiYnVpbGRVbmlxdWVWZXJ0ZXgiLCJhQmFyeWNlbnRyaWMiLCJjcmVhdGVCYXJ5Y2VudHJpYyIsImNvcHlDb25maWciLCJtYXB0YWxrcyIsImNvcHlVbmlmb3JtcyIsIk1hdGVyaWFsIiwic3BsaXQiLCJuYW1lc3BhY2UiLCJzaGFkZXJMaXN0VGVzdCIsImNsZWFyQ2FudmFzIiwiY2xlYXIiLCJjb2xvciIsInJlc2l6ZUNhbnZhcyIsInNpemUiLCJyZXNpemUiLCJyZW5kZXJDb3VudCIsIl9pYmxVbmlmb3JtcyIsInZpc2libGVNYXJrZXJzIiwiX21hcmtlckxpc3QiLCJpc1Zpc2libGUiLCJfY2hlY2tNYXJrZXJzRGlydHkiLCJfdG9SZW5kZXJTY2VuZSIsIl9jcmVhdGVTY2VuZUluRnJ1c3R1bSIsInJlbmRlciIsIl9uZWVkUmVmcmVzaFBpY2tpbmciLCJjb21wbGV0ZVJlbmRlciIsIm1hcmtlcnMiLCJfdWlkIiwiX3VwZGF0ZVNjZW5lTWF0cml4IiwiaXNBbmltYXRlZCIsImhhc0Z1bmN0aW9uRGVmaW5pdGlvbiIsInNldERpcnR5IiwidmlzaWJsZXMiLCJtb2RlbE1lc2hlcyIsImlpIiwiZ2V0VW5pZm9ybXMiLCJfc2V0TWVzaFVuaWZvcm1zIiwic2V0IiwiSW5zdGFuY2VkTWVzaCIsImJvdW5kaW5nQm94IiwiYm94TWluIiwidHJhbnNmb3JtTWF0NCIsImxvY2FsVHJhbnNmb3JtIiwiYm94TWF4Iiwic2V0VW5pZm9ybSIsIlNjZW5lIiwiX3ByZXBhcmVNZXNoIiwic2hhZGVyTmFtZSIsIm1vZGVsTWVzaCIsIl9idWlsZE1lc2giLCJ1UGlja2luZ0lkIiwiX3NldE1lc2hEZWZpbmVzIiwiZ2V0VHlwZSIsInBvc2l0aW9uIiwiX2dldFBvc2l0aW9uIiwiZ2V0Q2VudGVyIiwicHJpbWl0aXZlIiwiX3NldFBob25nVGV4dHVyZSIsIl9pc1BCUlNoYWRlciIsIm1hdGVyaWFsTWFwVGFibGUiLCJsaXQiLCJzdWJzdXJmYWNlIiwiY2xvdGgiLCJtYXRlcmlhbFVuaWZvcm1zIiwiX3NldFBCUlRleHR1cmUiLCJwYnIiLCJtYXJrZXJUeXBlIiwiZ2V0RGVmaW5lcyIsIlVTRV9QSUNLSU5HX0lEIiwiVVNFX1NLSU4iLCJfZ2V0R2VvbWV0cnlEZWZpbmVzIiwic2V0RGVmaW5lcyIsIlVTRV9JTlNUQU5DRSIsIl9nZXRJbnN0YW5jZUF0dHJpYnV0ZXNEYXRhIiwiZ2V0Q291bnQiLCJpbnN0YW5jZU1lc2giLCJnZW5lcmF0ZUluc3RhbmNlZEJ1ZmZlcnMiLCJvbiIsIk1lc2giLCJwcm9wZXJ0aWVzIiwibWFya2VySWQiLCJfbm9kZU1hdHJpeCIsImdldEdlb21ldHJ5RGVmaW5lcyIsImxvZyIsIl9leHRlbmRVbmlmb3JtcyIsIm1hcmtlclVuaWZvcm1zIiwiZGVmYXVsdFVuaWZvcm1zIiwiX2NyZWF0ZVNjZW5lIiwidXJsIiwic2hhcmVkR2VvbWV0cnkiLCJfZ2V0R0xURkRhdGEiLCJfY3JlYXRlU2ltcGxlU2NlbmUiLCJfY3JlYXRlR0xURlNjZW5lIiwic2V0VG9SZWRyYXciLCJfcGFyc2VyTm9kZSIsIm1vZGVsR2VvbWV0cnkiLCJfY3JlYXRlR2VvbWV0cnkiLCJpc1BhcnNlZCIsImlkZW50aXR5IiwibG9jYWxNYXRyaXgiLCJjaGlsZCIsImF0dHIiLCJHZW9tZXRyeSIsImlzTnVtYmVyIiwicG9zaXRpb25BdHRyaWJ1dGUiLCJub3JtYWxBdHRyaWJ1dGUiLCJ1djBBdHRyaWJ1dGUiLCJjcmVhdGVUYW5nZW50IiwiX3RvVGV4dHVyZSIsIlVTRV9CQVNFQ09MT1JURVhUVVJFIiwiYmFzZUNvbG9yRmFjdG9yIiwicGJyTWF0ZXJpYWwiLCJtZXRhbGxpY0ZhY3RvciIsInJvdWdobmVzc0ZhY3RvciIsIm1hZyIsIm1hZ0ZpbHRlciIsIm1pbkZpbHRlciIsIndyYXBTIiwid3JhcFQiLCJfdXBkYXRlTm9kZU1hdHJpeCIsInBhcmVudE5vZGVNYXRyaXgiLCJzcGVlZCIsImdldEFuaW1hdGlvblNwZWVkIiwiaXNMb29wZWQiLCJ0aW1lc3BhbiIsImFuaW1UaW1lIiwiYW5pbUNsaXAiLCJhbmltVHJhbnNmb3JtTWF0IiwibW9ycGhXZWlnaHRzIiwiYW5pbVNraW5NYXQiLCJfdXBkYXRlTWF0cml4IiwidHJhbnNmb3JtTWF0IiwiZ2V0TW9kZWxNYXRyaXgiLCJzZXRMb2NhbFRyYW5zZm9ybSIsIl91cGRhdGVJbnN0YW5jZWRNZXNoRGF0YSIsIl9hdHRyaWJ0ZU1hdHJpeHMiLCJrZXkiLCJ1cGRhdGVJbnN0YW5jZWREYXRhIiwiaW5zdGFuY2VDb3VudCIsIl9kZWxldGVTY2VuZSIsIl9kaXNwb3NlTWVzaCIsIl9kZWxldGVBbGwiLCJkaXNwb3NlIiwiX3JlbW92ZUdlb21ldHJ5IiwibmFtZXMiLCJfaWRlbnRpZnkiLCJnZXRNZXNoZXMiLCJwaWNrIiwidG9sZXJhbmNlIiwicmV0dXJuUG9pbnQiLCJtZXNoSWQiLCJwaWNraW5nSWQiLCJwb2ludCIsIl9zcXVlZXplVGFyZ2V0Iiwia2V5MCIsImtleTEiLCJlbmRLZXkiLCJDYW52YXNSZW5kZXJlciIsImNyZWF0ZUZ1bmN0aW9uIiwicGFyYW1ldGVycyIsImRlZmF1bHRUeXBlIiwiZnVuIiwiaXNGZWF0dXJlQ29uc3RhbnQiLCJpc1pvb21Db25zdGFudCIsImlzRnVuY3Rpb25EZWZpbml0aW9uIiwiem9vbUFuZEZlYXR1cmVEZXBlbmRlbnQiLCJzdG9wcyIsImZlYXR1cmVEZXBlbmRlbnQiLCJ1bmRlZmluZWQiLCJ6b29tRGVwZW5kZW50IiwiaW5uZXJGdW4iLCJldmFsdWF0ZUV4cG9uZW50aWFsRnVuY3Rpb24iLCJldmFsdWF0ZUludGVydmFsRnVuY3Rpb24iLCJldmFsdWF0ZUNhdGVnb3JpY2FsRnVuY3Rpb24iLCJldmFsdWF0ZUlkZW50aXR5RnVuY3Rpb24iLCJmZWF0dXJlRnVuY3Rpb25zIiwiZmVhdHVyZUZ1bmN0aW9uU3RvcHMiLCJzdG9wIiwiem9vbSIsImRlZmF1bHQiLCJmZWF0dXJlIiwiYmFzZSIsImNvYWxlc2NlIiwiaW50ZXJwb2xhdGUiLCJpbnB1dExvd2VyIiwiaW5wdXRVcHBlciIsIm91dHB1dExvd2VyIiwib3V0cHV0VXBwZXIiLCJldmFsdWF0ZWRMb3dlciIsImFwcGx5IiwiZXZhbHVhdGVkVXBwZXIiLCJpbnRlcnBvbGF0ZUFycmF5IiwiaW50ZXJwb2xhdGVOdW1iZXIiLCJkaWZmZXJlbmNlIiwicHJvZ3Jlc3MiLCJyYXRpbyIsImludGVycG9sYXRlZCIsImNyZWF0ZUZ1bmN0aW9uMSIsImxvYWRGdW5jdGlvblR5cGVzIiwiYXJnRm4iLCJoaXQiLCJtdWx0UmVzdWx0IiwibG9hZGVkIiwicmVzdWx0IiwiaGFzT3duUHJvcGVydHkiLCJidWlsZEZuIiwiZGVmaW5lUHJvcGVydHkiLCJjb25maWd1cmFibGUiLCJlbnVtZXJhYmxlIiwiREVGQVVMVF9ST1RBVElPTiIsInZpc2libGUiLCJHTFRGTWFya2VyIiwiY29vcmRpbmF0ZXMiLCJzZXRDb29yZGluYXRlcyIsIl9sb2FkZWQiLCJfaW5pdFN5bWJvbCIsIl90eXBlIiwiZnJvbUpTT04iLCJfbG9hZERhdGEiLCJsYXN0SW5kZXhPZiIsInJvb3QiLCJwb3N0Zml4IiwiX2dsdGZqc29uIiwibG9hZGVyIiwiX2V4cG9ydEdMVEZEYXRhIiwiZ2x0ZkRhdGEiLCJfc2V0R0xURkRhdGEiLCJzeW1ib2wiLCJzZXRTeW1ib2wiLCJfZXh0ZXJuU3ltYm9sIiwiX2dsdGZEYXRhIiwiX2dldEdMVEZKc29uIiwiX3NldFByb3BJblN5bWJvbCIsInByb3AiLCJfc2V0UHJvcEluRXh0ZXJuU3ltYm9sIiwiX2xheWVyIiwiZ2V0TGF5ZXIiLCJzZXRVcmwiLCJvbGRVcmwiLCJfbG9hZEdMVEZEYXRhIiwiX3JlbW92ZUdMVEZSZXF1ZXN0cyIsIl9kaXJ0eSIsIl9nZXRJbnRlcm5hbFN5bWJvbCIsImFkZFRvIiwiYWRkTWFya2VyIiwicmVtb3ZlIiwicmVtb3ZlTWFya2VyIiwic2hvdyIsImhpZGUiLCJnZXRDb29yZGluYXRlcyIsIl9jb29yZGluYXRlcyIsIkNvb3JkaW5hdGUiLCJqc29uRGF0YSIsInRvSlNPTiIsInNldElkIiwiaWQiLCJnZXRJZCIsInNldFNoYWRlciIsInNldFVuaWZvcm1zIiwiVXRpbCIsImdldFVuaWZvcm0iLCJzZXRNYXRlcmlhbCIsImFuaW1hdGlvbiIsInNldEFuaW1hdGlvbiIsImlzQW5pbWF0aW9uIiwic2V0QW5pbWF0aW9ubG9vcCIsImxvb3BlZCIsImxvb3AiLCJzZXRBbmltYXRpb25TcGVlZCIsImNvb3JkaW5hdGUiLCJjb29yZGluYXRlVG9Xb3JsZCIsInNldFRyYW5zbGF0aW9uIiwiZ2V0VHJhbnNsYXRpb24iLCJfZ2V0V29ybGRUcmFuc2xhdGlvbiIsInRyYW5zIiwiYWRkIiwic2V0Um90YXRpb24iLCJ4QW5nbGUiLCJ5QW5nbGUiLCJ6QW5nbGUiLCJnZXRSb3RhdGlvbiIsInNldFNjYWxlIiwiZ2V0U2NhbGUiLCJfY2hlY2tVcmwiLCJfcHJlcGFyZVN5bWJvbCIsIl9vblN5bWJvbENoYW5nZWQiLCJnZXRTeW1ib2wiLCJfc2V0RXh0ZXJuU3ltYm9sIiwiX2xvYWRGdW5jdGlvblR5cGVzIiwiZ2V0Wm9vbSIsImNvcHlTeW1ib2wiLCJmdW5jdGlvblN5bWJvbCIsIl9oYXNGdW5jRGVmaW5pdGlvbiIsInVwZGF0ZVN5bWJvbCIsIm5ld1VybCIsInNldE1vZGVsTWF0cml4IiwiX21vZGVsTWF0cml4IiwiZWx1ZXJRdWF0IiwicXVhdCIsImZyb21FdWxlciIsInNldFByb3BlcnRpZXMiLCJnZXRQcm9wZXJ0aWVzIiwiZGlydHkiLCJldmVudHMiLCJjYWxsYmFjayIsIl9hZGRFdmVudHMiLCJvZmYiLCJfcmVtb3ZlRXZlbnRzIiwiX3NldExvYWRTdGF0ZSIsImlzTG9hZGVkIiwiX2dldFVJRCIsIkV2ZW50YWJsZSIsIkhhbmRsZXJhYmxlIiwiQ2xhc3MiLCJtZXJnZU9wdGlvbnMiLCJjb29yZGluYXRlVG9Qb2ludCIsImdldFRhcmdldFpvb20iLCJnZXRHTFpvb20iLCJtZW1vIiwiR2VvSlNPTiIsInRvR2VvbWV0cnkiLCJnZW9KU09OIiwiaXNTdHJpbmciLCJwYXJzZUpTT04iLCJyZXN1bHRHZW9zIiwiZ2VvIiwiX2NvbnZlcnQiLCJwdXNoSW4iLCJyZXN1bHRHZW8iLCJmZWF0dXJlcyIsIm1HZW9zIiwiaXNHZW9KU09OIiwibW9kZWwiLCJwaG9uZyIsIndpcmVmcmFtZSIsImxpZ2h0UG9zaXRpb24iLCJsaWdodEFtYmllbnQiLCJsaWdodERpZmZ1c2UiLCJsaWdodFNwZWN1bGFyIiwiYW1iaWVudFN0cmVuZ3RoIiwic3BlY3VsYXJTdHJlbmd0aCIsIm1hdGVyaWFsU2hpbmluZXNzIiwib3BhY2l0eSIsImZyb250Q29sb3IiLCJiYWNrQ29sb3IiLCJmaWxsQ29sb3IiLCJmaWxsIiwic3Ryb2tlIiwibGluZVdpZHRoIiwiYW5pbWF0aW9uR3JvdXAiLCJ0aHJlZUdyb3VwIiwiaGlnaExpZ2h0Iiwic2VlVGhyb3VnaCIsImRhc2giLCJkYXNoRW5hYmxlZCIsImRhc2hBbmltYXRlIiwiZGFzaE92ZXJsYXAiLCJkYXNoUmVwZWF0cyIsImRhc2hMZW5ndGgiLCJzcXVlZXplIiwiaW5zaWRlQWx0Q29sb3IiLCJkdWFsU3Ryb2tlIiwic3F1ZWV6ZU1pbiIsInNxdWVlemVNYXgiLCJTbGVlayIsIkZ1bmt5VG9ydXMiLCJCbG9ja3lGYWRlIiwiU2ltcGxlV2lyZSIsIk5pY2VyV2lyZSIsIkFuaW1hdGVkIiwiRnVuWm9uZSIsIkRvdHRlZCIsIkZsb3dlciIsIlRhcGVyZWQiLCJnZXRTdHVkaW9UeXBpbmdzIiwiaTE4biIsImxhbmd1YWdlIiwiZ3JvdXBzIiwidHlwaW5nIiwib25DaGFuZ2UiLCJpdGVtcyIsIm9uZU9mIiwiY3ViZVBvc2l0aW9uIiwiY3ViZU5vcm1hbCIsImN1YmVJbmRpY2VzIiwiU3BoZXJlR2VvbWV0cnkiLCJyYWRpdXMiLCJ3aWR0aFNlZ21lbnRzIiwiaGVpZ2h0U2VnbWVudHMiLCJwaGlTdGFydCIsInBoaUxlbmd0aCIsInRoZXRhU3RhcnQiLCJ0aGV0YUxlbmd0aCIsImZsb29yIiwidGhldGFFbmQiLCJpeCIsIml5IiwiZ3JpZCIsInZlcnRleCIsIm5vcm1hbCIsInZlcnRpY2VzIiwibm9ybWFscyIsInV2cyIsInZlcnRpY2VzUm93IiwidU9mZnNldCIsInNwaGVyZSIsImdldE1vZGVsIiwiUE9TSVRJT04iLCJOT1JNQUwiLCJURVhDT09SRF8wIiwiZ2V0RGVmYXVsdFNoYWRlclR5cGluZ3MiLCJwaG9uZ1N0dWRpb1R5cGluZ3MiLCJzdHJ1Y3R1cmUiLCJwcmVzZXRzIiwid2lyZWZyYW1lU3R1ZGlvVHlwaW5ncyIsInRpbWUiLCJ0aGlja25lc3MiLCJzZWNvbmRUaGlja25lc3MiLCJmb3JjZVJlbmRlck9uWm9vbWluZyIsImZvcmNlUmVuZGVyT25Nb3ZpbmciLCJmb3JjZVJlbmRlck9uUm90YXRpbmciLCJNQVBfRVZFTlRTIiwiR0xURkxheWVyIiwiX21vZGVsTWFwIiwiX2lkTGlzdCIsIm1hcEV2ZW50cyIsInJlZ2lzdGVyU2hhZGVyIiwic2hhZGVyVHlwaW5ncyIsImNoZWNrVHlwaW5ncyIsInJlbW92ZVNoYWRlciIsImdldFNoYWRlcnMiLCJzaGFkZXJzIiwiZ2V0U2hhZGVyTWFwIiwiaW5pdERlZmF1bHRTaGFkZXIiLCJkZWZhdWx0U2hhZGVyVHlwaW5ncyIsInBob25nU2hhZGVyIiwiZ2V0UGhvbmdTaGFkZXIiLCJ3aXJlRnJhbWVTaGFkZXIiLCJnZXRXaXJlRnJhbWVTaGFkZXIiLCJMaXRTaGFkZXIiLCJnZXRMaXRTaGFkZXIiLCJTdWJzdWZhY2VTaGFkZXIiLCJnZXRTdWJzdXJmYWNlU2hhZGVyIiwiQ2xvdGhTaGFkZXIiLCJnZXRDbG90aFNoYWRlciIsInN0dWRpb1R5cGluZ3MiLCJzaGFkZXJUeXBpbmciLCJzeW1ib2xQcm9wZXJ0aWVzIiwiZ2VvSlNPTnMiLCJzZXRTdHlsZSIsImdldExpc3RlbmluZ0V2ZW50cyIsIl9sb2FkTW9kZWwiLCJnZXRNb2RlbHMiLCJzaW1wbGVNb2RlbCIsInByb2ZpbGUiLCJnZXRKU09OVHlwZSIsImdldFN0eWxlIiwiZ2V0TWFya2VycyIsIl9sb2FkU2ltcGxlTW9kZWwiLCJnZXRSZW5kZXJlciIsIl9yZXF1ZXN0R0xURkRhdGEiLCJnbHRmanNvbiIsImNvbXBsZXRlIiwiX2lzTW9kZWxzTG9hZENvbXBsZXRlIiwibW9kZWxzIiwiX2lzUmVxdWVzdHNDb21wbGV0ZSIsImxheWVyU3R5bGUiLCJfbGF5ZXJTdHlsZSIsIl9zdHlsZU1hcmtlckxpc3QiLCIkcm9vdCIsInN0eWxlIiwiaWR4IiwiX3Byb2Nlc3NSb290VXJsIiwiY29va1N0eWxlcyIsIl9jb29rZWRTdHlsZXMiLCJfc3R5bGVNYXJrZXIiLCJnZXRHTFRGVXJscyIsInJlZ2V4Iiwic3RsIiwicmVwbGFjZSIsInNwbGl0RXZlbnRzIiwiY3VycmVudEV2ZW50cyIsIm5ld0V2ZW50cyIsInRyaW0iLCJfbWFwRXZlbnRIYW5kbGVyIiwibWFya2VyRXZlbnRzIiwiX2RlbGV0ZU1hcmtlciIsImlkZW50aWZ5IiwiZ2V0QnlJZCIsImdldEFsbCIsIl9sYXN0VGFyZ2V0SWQiLCJfY3VycmVudFRhcmdldElkIiwiX2xhc3RQb2ludCIsIl9jdXJyZW50UG9pbnQiLCJfbGFzdE1lc2hJZCIsIl9jdXJyZW50TWVzaElkIiwiX2xhc3RQaWNraW5nSWQiLCJfY3VycmVudFBpY2tpbmdJZCIsImNvbnRhaW5lclBvaW50IiwiY29vcmRpbmF0ZVRvQ29udGFpbmVyUG9pbnQiLCJyb3VuZCIsIm1vdXNlbW92ZVRhcmdldHMiLCJfZ2V0TW91c2VNb3ZlVGFyZ2V0cyIsImV2ZW50VGFyZ2V0cyIsImdldFJlc291cmNlRmlsZXMiLCJjYiIsIl9jb3B5UmVzb3VyY2VzIiwicmVzb3VyY2VzIiwiZmlsZXMiLCJyZXNvbHZlUmVzb3VjZUZpbGVzIiwic2V0SUJMU2t5Qm94Iiwic2t5Ym94VGV4dHVyZXMiLCJwcm9taXNlcyIsImltZyIsIl9jcmVzdGVJQkxNYXBzIiwiaWJsTWFwcyIsImNyZWF0ZU1hcHMiLCJkZmdMVVQiLCJwcmVmaWx0ZXJNYXAiLCJzaCIsInJlZ2lzdGVySlNPTlR5cGUiLCJyZWdpc3RlclJlbmRlcmVyIiwic3R1ZGlvVHlwZU5hbWVzIiwiaW50ZXJzZWN0IiwiUGhvbmdNYXRlcmlhbCIsImN1bGwiLCJlbmFibGUiLCJmYWNlIiwiZnJvbnRGYWNlIiwiV2lyZUZyYW1lTWF0ZXJpYWwiLCJ0YW5nZW50QXR0cmlidXRlIiwiY29sb3JBdHRyaWJ1dGUiLCJ1djFBdHRyaWJ1dGUiLCJMaXRNYXRlcmlhbCIsIlN1YnN1cmZhY2VNYXRlcmlhbCIsIkNsb3RoTWF0ZXJpYWwiLCJnZXRVcmkiLCJyZXMiLCJoZHIiLCJQQlJIZWxwZXIiLCJjcmVhdGVJQkxNYXBzIiwiZW52VGV4dHVyZSIsImVudkN1YmVTaXplIiwicHJlZmlsdGVyQ3ViZVNpemUiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7O0VBT0EsSUFBTUEsS0FBSyxHQUFHLENBQUMsU0FBRCxFQUFZLE9BQVosRUFBcUIsWUFBckIsRUFBbUMsU0FBbkMsRUFBOEMsWUFBOUMsRUFBNEQsaUJBQTVELEVBQStFLGNBQS9FLEVBQStGLG9CQUEvRixDQUFkO0FBVUEsRUFBTyxTQUFTQyxZQUFULENBQXNCQyxNQUF0QixFQUE4QjtFQUNqQyxTQUFPLElBQUlDLFFBQUosQ0FBYSxHQUFiLGlEQUErREMsT0FBTyxDQUFDRixNQUFELENBQXRFLENBQVA7RUFDSDs7RUFFRCxTQUFTRSxPQUFULENBQWlCRixNQUFqQixFQUF5QjtFQUNyQixNQUFJLENBQUNBLE1BQUwsRUFBYSxPQUFPLE1BQVA7RUFDYixNQUFNRyxFQUFFLEdBQUdILE1BQU0sQ0FBQyxDQUFELENBQWpCO0VBQ0EsTUFBSUEsTUFBTSxDQUFDSSxNQUFQLElBQWlCLENBQXJCLEVBQXdCLE9BQU9ELEVBQUUsS0FBSyxLQUFQLEdBQWUsT0FBZixHQUF5QixNQUFoQztFQUN4QixNQUFNRSxHQUFHLEdBQ0xGLEVBQUUsS0FBSyxJQUFQLEdBQWNHLG1CQUFtQixDQUFDTixNQUFNLENBQUMsQ0FBRCxDQUFQLEVBQVlBLE1BQU0sQ0FBQyxDQUFELENBQWxCLEVBQXVCLEtBQXZCLEVBQThCLEtBQTlCLENBQWpDLEdBQ0lHLEVBQUUsS0FBSyxJQUFQLEdBQWNHLG1CQUFtQixDQUFDTixNQUFNLENBQUMsQ0FBRCxDQUFQLEVBQVlBLE1BQU0sQ0FBQyxDQUFELENBQWxCLEVBQXVCLEtBQXZCLEVBQThCLEtBQTlCLENBQWpDLEdBQ0lHLEVBQUUsS0FBSyxHQUFQLElBQ0lBLEVBQUUsS0FBSyxHQURYLElBRVJBLEVBQUUsS0FBSyxJQUZDLElBR1JBLEVBQUUsS0FBSyxJQUhDLEdBR01HLG1CQUFtQixDQUFDTixNQUFNLENBQUMsQ0FBRCxDQUFQLEVBQVlBLE1BQU0sQ0FBQyxDQUFELENBQWxCLEVBQXVCRyxFQUF2QixFQUEyQixJQUEzQixDQUh6QixHQUlJQSxFQUFFLEtBQUssS0FBUCxHQUFlSSxnQkFBZ0IsQ0FBQ1AsTUFBTSxDQUFDUSxLQUFQLENBQWEsQ0FBYixDQUFELEVBQWtCLElBQWxCLENBQS9CLEdBQ0lMLEVBQUUsS0FBSyxLQUFQLEdBQWVJLGdCQUFnQixDQUFDUCxNQUFNLENBQUNRLEtBQVAsQ0FBYSxDQUFiLENBQUQsRUFBa0IsSUFBbEIsQ0FBL0IsR0FDSUwsRUFBRSxLQUFLLE1BQVAsR0FBZ0JNLGVBQWUsQ0FBQ0YsZ0JBQWdCLENBQUNQLE1BQU0sQ0FBQ1EsS0FBUCxDQUFhLENBQWIsQ0FBRCxFQUFrQixJQUFsQixDQUFqQixDQUEvQixHQUNJTCxFQUFFLEtBQUssSUFBUCxHQUFjTyxXQUFXLENBQUNWLE1BQU0sQ0FBQyxDQUFELENBQVAsRUFBWUEsTUFBTSxDQUFDUSxLQUFQLENBQWEsQ0FBYixDQUFaLENBQXpCLEdBQ0lMLEVBQUUsS0FBSyxLQUFQLEdBQWVNLGVBQWUsQ0FBQ0MsV0FBVyxDQUFDVixNQUFNLENBQUMsQ0FBRCxDQUFQLEVBQVlBLE1BQU0sQ0FBQ1EsS0FBUCxDQUFhLENBQWIsQ0FBWixDQUFaLENBQTlCLEdBQ0lMLEVBQUUsS0FBSyxLQUFQLEdBQWVRLFlBQVksQ0FBQ1gsTUFBTSxDQUFDLENBQUQsQ0FBUCxDQUEzQixHQUNJRyxFQUFFLEtBQUssTUFBUCxHQUFnQk0sZUFBZSxDQUFDRSxZQUFZLENBQUNYLE1BQU0sQ0FBQyxDQUFELENBQVAsQ0FBYixDQUEvQixHQUNJLE1BZDVDO0VBZUEsZUFBV0ssR0FBWDtFQUNIOztFQUVELFNBQVNPLHdCQUFULENBQWtDQyxRQUFsQyxFQUE0QztFQUt4QyxTQUFPQSxRQUFRLENBQUMsQ0FBRCxDQUFSLEtBQWdCLEdBQWhCLEdBQXNCLE9BQU9BLFFBQVEsQ0FBQ0MsU0FBVCxDQUFtQixDQUFuQixDQUE3QixHQUFxRCxPQUFPQyxJQUFJLENBQUNDLFNBQUwsQ0FBZUgsUUFBZixDQUFQLEdBQWtDLEdBQTlGO0VBQ0g7O0VBRUQsU0FBU1AsbUJBQVQsQ0FBNkJPLFFBQTdCLEVBQXVDSSxLQUF2QyxFQUE4Q2QsRUFBOUMsRUFBa0RlLFNBQWxELEVBQTZEO0VBQ3pELE1BQU1DLElBQUksR0FBR1Asd0JBQXdCLENBQUNDLFFBQUQsQ0FBckM7RUFDQSxNQUFNTyxLQUFLLEdBQUdQLFFBQVEsS0FBSyxPQUFiLEdBQXVCZixLQUFLLENBQUN1QixPQUFOLENBQWNKLEtBQWQsQ0FBdkIsR0FBOENGLElBQUksQ0FBQ0MsU0FBTCxDQUFlQyxLQUFmLENBQTVEO0VBQ0EsU0FBTyxDQUFDQyxTQUFTLGVBQWFDLElBQWIsbUJBQStCQyxLQUEvQixVQUEyQyxFQUFyRCxJQUEyREQsSUFBM0QsR0FBa0VoQixFQUFsRSxHQUF1RWlCLEtBQTlFO0VBQ0g7O0VBRUQsU0FBU2IsZ0JBQVQsQ0FBMEJlLFdBQTFCLEVBQXVDbkIsRUFBdkMsRUFBMkM7RUFDdkMsU0FBT21CLFdBQVcsQ0FBQ0MsR0FBWixDQUFnQnJCLE9BQWhCLEVBQXlCc0IsSUFBekIsQ0FBOEJyQixFQUE5QixDQUFQO0VBQ0g7O0VBRUQsU0FBU08sV0FBVCxDQUFxQkcsUUFBckIsRUFBK0JZLE1BQS9CLEVBQXVDO0VBQ25DLE1BQUlaLFFBQVEsS0FBSyxPQUFqQixFQUEwQlksTUFBTSxHQUFHQSxNQUFNLENBQUNGLEdBQVAsQ0FBVyxVQUFDTixLQUFELEVBQVc7RUFDckQsV0FBT25CLEtBQUssQ0FBQ3VCLE9BQU4sQ0FBY0osS0FBZCxDQUFQO0VBQ0gsR0FGa0MsQ0FBVDtFQUcxQixNQUFNRSxJQUFJLEdBQUdKLElBQUksQ0FBQ0MsU0FBTCxDQUFlUyxNQUFNLENBQUNDLElBQVAsQ0FBWUMsT0FBWixDQUFmLENBQWI7RUFDQSxNQUFNUCxLQUFLLEdBQUdSLHdCQUF3QixDQUFDQyxRQUFELENBQXRDO0VBRUEsTUFBSVksTUFBTSxDQUFDckIsTUFBUCxJQUFpQixHQUFyQixFQUEwQixPQUFVZSxJQUFWLGlCQUEwQkMsS0FBMUI7RUFFMUIsd01BSWtCQSxLQUpsQixVQUk0QkQsSUFKNUIsWUFJc0NNLE1BQU0sQ0FBQ3JCLE1BQVAsR0FBZ0IsQ0FKdEQ7RUFLSDs7RUFFRCxTQUFTTyxZQUFULENBQXNCRSxRQUF0QixFQUFnQztFQUM1QixTQUFPQSxRQUFRLEtBQUssS0FBYixHQUFxQixXQUFyQixHQUFzQ0UsSUFBSSxDQUFDQyxTQUFMLENBQWVILFFBQWYsQ0FBdEMsVUFBUDtFQUNIOztFQUVELFNBQVNKLGVBQVQsQ0FBeUJtQixVQUF6QixFQUFxQztFQUNqQyxnQkFBWUEsVUFBWjtFQUNIOztFQUdELFNBQVNELE9BQVQsQ0FBaUJFLENBQWpCLEVBQW9CQyxDQUFwQixFQUF1QjtFQUNuQixTQUFPRCxDQUFDLEdBQUdDLENBQUosR0FBUSxDQUFDLENBQVQsR0FBYUQsQ0FBQyxHQUFHQyxDQUFKLEdBQVEsQ0FBUixHQUFZLENBQWhDO0VBQ0g7RUE0Qk0sU0FBU0MsWUFBVCxDQUFzQkMsTUFBdEIsRUFBOEI7RUFDakMsTUFBSSxDQUFDQyxLQUFLLENBQUNDLE9BQU4sQ0FBY0YsTUFBZCxDQUFMLEVBQTRCO0VBQ3hCLFdBQU9ELFlBQVksQ0FBQyxDQUFDQyxNQUFELENBQUQsQ0FBbkI7RUFDSDs7RUFDRCxNQUFNRyxRQUFRLEdBQUcsRUFBakI7O0VBQ0EsT0FBSyxJQUFJQyxDQUFDLEdBQUcsQ0FBYixFQUFnQkEsQ0FBQyxHQUFHSixNQUFNLENBQUM1QixNQUEzQixFQUFtQ2dDLENBQUMsRUFBcEMsRUFBd0M7RUFDcEMsUUFBSXBDLE1BQU0sU0FBVjs7RUFDQSxRQUFJZ0MsTUFBTSxDQUFDSSxDQUFELENBQU4sQ0FBVSxRQUFWLE1BQXdCLElBQTVCLEVBQWtDO0VBQzlCcEMsTUFBQUEsTUFBTSxHQUFHLGtCQUFZO0VBQUUsZUFBTyxJQUFQO0VBQWMsT0FBckM7RUFDSCxLQUZELE1BRU87RUFDSEEsTUFBQUEsTUFBTSxHQUFHRCxZQUFZLENBQUNpQyxNQUFNLENBQUNJLENBQUQsQ0FBTixDQUFVLFFBQVYsQ0FBRCxDQUFyQjtFQUNIOztFQUNERCxJQUFBQSxRQUFRLENBQUNFLElBQVQsQ0FBY0MsTUFBTSxDQUFDLEVBQUQsRUFBS04sTUFBTSxDQUFDSSxDQUFELENBQVgsRUFBZ0I7RUFDaENwQyxNQUFBQSxNQUFNLEVBQUdBO0VBRHVCLEtBQWhCLENBQXBCO0VBR0g7O0VBQ0QsU0FBT21DLFFBQVA7RUFDSDs7RUFFRCxTQUFTRyxNQUFULENBQWdCQyxJQUFoQixFQUFzQjtFQUNsQixPQUFLLElBQUlILENBQUMsR0FBRyxDQUFiLEVBQWdCQSxDQUFDLEdBQUdJLFNBQVMsQ0FBQ3BDLE1BQTlCLEVBQXNDZ0MsQ0FBQyxFQUF2QyxFQUEyQztFQUN2QyxRQUFNSyxHQUFHLEdBQUdELFNBQVMsQ0FBQ0osQ0FBRCxDQUFyQjs7RUFDQSxTQUFLLElBQU1NLENBQVgsSUFBZ0JELEdBQWhCLEVBQXFCO0VBQ2pCRixNQUFBQSxJQUFJLENBQUNHLENBQUQsQ0FBSixHQUFVRCxHQUFHLENBQUNDLENBQUQsQ0FBYjtFQUNIO0VBQ0o7O0VBQ0QsU0FBT0gsSUFBUDtFQUNIOztFQzFJTSxTQUFTSSxLQUFULENBQWVDLEdBQWYsRUFBb0I7RUFDdkIsU0FBT0EsR0FBRyxJQUFJLElBQWQ7RUFDSDtBQUdELEVBQU8sU0FBU0MsT0FBVCxDQUFpQkQsR0FBakIsRUFBc0I7RUFDekIsU0FBTyxDQUFDRCxLQUFLLENBQUNDLEdBQUQsQ0FBYjtFQUNIO0FBRUQsRUFBTyxTQUFTRSxhQUFULENBQXVCQyxDQUF2QixFQUEwQjtFQUM3QixNQUFJQyxDQUFKOztFQUNBLE9BQUtBLENBQUwsSUFBVUQsQ0FBVjtFQUNJLFdBQU8sQ0FBQyxDQUFSO0VBREo7O0VBRUEsU0FBTyxDQUFDLENBQVI7RUFDSDtBQUVELEVBQU8sU0FBU0UsY0FBVCxDQUF3QnBCLENBQXhCLEVBQTJCQyxDQUEzQixFQUE4QjtFQUNqQyxNQUFNb0IsSUFBSSxHQUFHLElBQUlDLEdBQUosQ0FBUXJCLENBQVIsQ0FBYjtFQUNBLFNBQU9HLEtBQUssQ0FBQ21CLElBQU4sQ0FBVyxJQUFJRCxHQUFKLENBQVF0QixDQUFDLENBQUM3QixNQUFGLENBQVMsVUFBQXFELENBQUM7RUFBQSxXQUFJSCxJQUFJLENBQUNJLEdBQUwsQ0FBU0QsQ0FBVCxDQUFKO0VBQUEsR0FBVixDQUFSLENBQVgsQ0FBUDtFQUNIO0FBRUQsRUFBTyxTQUFTRSxTQUFULENBQW1CQyxHQUFuQixFQUF3QkMsV0FBeEIsRUFBcUNDLFVBQXJDLEVBQWlEQyxLQUFqRCxFQUF3RDtFQUMzRCxNQUFJQyxFQUFFLEdBQUd4RCxNQUFNLENBQUNvRCxHQUFHLENBQUNoRCxLQUFKLENBQVUsQ0FBVixFQUFhLENBQWIsQ0FBRCxDQUFmO0VBQ0EsTUFBTXFELEVBQUUsR0FBR3pELE1BQU0sQ0FBQ29ELEdBQUcsQ0FBQ2hELEtBQUosQ0FBVSxDQUFWLEVBQWEsQ0FBYixDQUFELENBQWpCO0VBQ0EsTUFBTXNELEVBQUUsR0FBRzFELE1BQU0sQ0FBQ29ELEdBQUcsQ0FBQ2hELEtBQUosQ0FBVSxDQUFWLEVBQWEsRUFBYixDQUFELENBQWpCO0VBR0EsTUFBTXVELEdBQUcsR0FBR0MsV0FBVyxDQUFDUixHQUFELENBQXZCOztFQUNBLE1BQUlPLEdBQUcsR0FBRyxDQUFWLEVBQWE7RUFDVEgsSUFBQUEsRUFBRSxHQUFHLENBQUNBLEVBQU47RUFDSDs7RUFFREgsRUFBQUEsV0FBVyxDQUFDLENBQUQsQ0FBWCxHQUFpQkQsR0FBRyxDQUFDLEVBQUQsQ0FBcEI7RUFDQUMsRUFBQUEsV0FBVyxDQUFDLENBQUQsQ0FBWCxHQUFpQkQsR0FBRyxDQUFDLEVBQUQsQ0FBcEI7RUFDQUMsRUFBQUEsV0FBVyxDQUFDLENBQUQsQ0FBWCxHQUFpQkQsR0FBRyxDQUFDLEVBQUQsQ0FBcEI7RUFHQSxNQUFNUyxNQUFNLEdBQUdDLElBQUksQ0FBQ1YsR0FBRCxDQUFuQjtFQUVBLE1BQU1XLEtBQUssR0FBRyxJQUFJUCxFQUFsQjtFQUNBLE1BQU1RLEtBQUssR0FBRyxJQUFJUCxFQUFsQjtFQUNBLE1BQU1RLEtBQUssR0FBRyxJQUFJUCxFQUFsQjtFQUVBRyxFQUFBQSxNQUFNLENBQUMsQ0FBRCxDQUFOLElBQWFFLEtBQWI7RUFDQUYsRUFBQUEsTUFBTSxDQUFDLENBQUQsQ0FBTixJQUFhRSxLQUFiO0VBQ0FGLEVBQUFBLE1BQU0sQ0FBQyxDQUFELENBQU4sSUFBYUUsS0FBYjtFQUVBRixFQUFBQSxNQUFNLENBQUMsQ0FBRCxDQUFOLElBQWFHLEtBQWI7RUFDQUgsRUFBQUEsTUFBTSxDQUFDLENBQUQsQ0FBTixJQUFhRyxLQUFiO0VBQ0FILEVBQUFBLE1BQU0sQ0FBQyxDQUFELENBQU4sSUFBYUcsS0FBYjtFQUVBSCxFQUFBQSxNQUFNLENBQUMsQ0FBRCxDQUFOLElBQWFJLEtBQWI7RUFDQUosRUFBQUEsTUFBTSxDQUFDLENBQUQsQ0FBTixJQUFhSSxLQUFiO0VBQ0FKLEVBQUFBLE1BQU0sQ0FBQyxFQUFELENBQU4sSUFBY0ksS0FBZDtFQUVBQyxFQUFBQSxzQkFBc0IsQ0FBQ0wsTUFBRCxFQUFTUCxVQUFULENBQXRCO0VBRUFDLEVBQUFBLEtBQUssQ0FBQyxDQUFELENBQUwsR0FBV0MsRUFBWDtFQUNBRCxFQUFBQSxLQUFLLENBQUMsQ0FBRCxDQUFMLEdBQVdFLEVBQVg7RUFDQUYsRUFBQUEsS0FBSyxDQUFDLENBQUQsQ0FBTCxHQUFXRyxFQUFYO0VBQ0g7O0VBRUQsU0FBUzFELE1BQVQsQ0FBZ0JpRCxDQUFoQixFQUFtQjtFQUNmLFNBQU9rQixJQUFJLENBQUNDLElBQUwsQ0FBVW5CLENBQUMsQ0FBQyxDQUFELENBQUQsR0FBT0EsQ0FBQyxDQUFDLENBQUQsQ0FBUixHQUFjQSxDQUFDLENBQUMsQ0FBRCxDQUFELEdBQU9BLENBQUMsQ0FBQyxDQUFELENBQXRCLEdBQTRCQSxDQUFDLENBQUMsQ0FBRCxDQUFELEdBQU9BLENBQUMsQ0FBQyxDQUFELENBQTlDLENBQVA7RUFDSDs7RUFFRCxTQUFTaUIsc0JBQVQsQ0FBZ0NHLENBQWhDLEVBQW1DQyxHQUFuQyxFQUF3QztFQUlwQyxNQUFNQyxHQUFHLEdBQUdGLENBQUMsQ0FBQyxDQUFELENBQWI7RUFDQSxNQUFNRyxHQUFHLEdBQUdILENBQUMsQ0FBQyxDQUFELENBQWI7RUFDQSxNQUFNSSxHQUFHLEdBQUdKLENBQUMsQ0FBQyxDQUFELENBQWI7RUFDQSxNQUFNSyxHQUFHLEdBQUdMLENBQUMsQ0FBQyxDQUFELENBQWI7RUFDQSxNQUFNTSxHQUFHLEdBQUdOLENBQUMsQ0FBQyxDQUFELENBQWI7RUFDQSxNQUFNTyxHQUFHLEdBQUdQLENBQUMsQ0FBQyxDQUFELENBQWI7RUFDQSxNQUFNUSxHQUFHLEdBQUdSLENBQUMsQ0FBQyxDQUFELENBQWI7RUFDQSxNQUFNUyxHQUFHLEdBQUdULENBQUMsQ0FBQyxDQUFELENBQWI7RUFDQSxNQUFNVSxHQUFHLEdBQUdWLENBQUMsQ0FBQyxFQUFELENBQWI7RUFFQSxNQUFNVyxLQUFLLEdBQUdULEdBQUcsR0FBR0ksR0FBTixHQUFZSSxHQUExQjs7RUFFQSxNQUFJQyxLQUFLLEdBQUcsQ0FBWixFQUFlO0VBQ1gsUUFBTUMsQ0FBQyxHQUFHLE1BQU1kLElBQUksQ0FBQ0MsSUFBTCxDQUFVWSxLQUFLLEdBQUcsQ0FBbEIsQ0FBaEI7RUFDQVYsSUFBQUEsR0FBRyxDQUFDLENBQUQsQ0FBSCxHQUFTLE9BQU9XLENBQWhCO0VBQ0FYLElBQUFBLEdBQUcsQ0FBQyxDQUFELENBQUgsR0FBUyxDQUFDUSxHQUFHLEdBQUdGLEdBQVAsSUFBY0ssQ0FBdkI7RUFDQVgsSUFBQUEsR0FBRyxDQUFDLENBQUQsQ0FBSCxHQUFTLENBQUNHLEdBQUcsR0FBR0ksR0FBUCxJQUFjSSxDQUF2QjtFQUNBWCxJQUFBQSxHQUFHLENBQUMsQ0FBRCxDQUFILEdBQVMsQ0FBQ0ksR0FBRyxHQUFHRixHQUFQLElBQWNTLENBQXZCO0VBQ0gsR0FORCxNQU1PLElBQUlWLEdBQUcsR0FBR0ksR0FBTixJQUFhSixHQUFHLEdBQUdRLEdBQXZCLEVBQTRCO0VBQy9CLFFBQU1FLEVBQUMsR0FBRyxJQUFJZCxJQUFJLENBQUNDLElBQUwsQ0FBVSxJQUFJRyxHQUFKLEdBQVVJLEdBQVYsR0FBZ0JJLEdBQTFCLENBQWQ7O0VBQ0FULElBQUFBLEdBQUcsQ0FBQyxDQUFELENBQUgsR0FBUyxDQUFDUSxHQUFHLEdBQUdGLEdBQVAsSUFBY0ssRUFBdkI7RUFDQVgsSUFBQUEsR0FBRyxDQUFDLENBQUQsQ0FBSCxHQUFTLE9BQU9XLEVBQWhCO0VBQ0FYLElBQUFBLEdBQUcsQ0FBQyxDQUFELENBQUgsR0FBUyxDQUFDRSxHQUFHLEdBQUdFLEdBQVAsSUFBY08sRUFBdkI7RUFDQVgsSUFBQUEsR0FBRyxDQUFDLENBQUQsQ0FBSCxHQUFTLENBQUNHLEdBQUcsR0FBR0ksR0FBUCxJQUFjSSxFQUF2QjtFQUNILEdBTk0sTUFNQSxJQUFJTixHQUFHLEdBQUdJLEdBQVYsRUFBZTtFQUNsQixRQUFNRSxHQUFDLEdBQUcsSUFBSWQsSUFBSSxDQUFDQyxJQUFMLENBQVUsSUFBSU8sR0FBSixHQUFVSixHQUFWLEdBQWdCUSxHQUExQixDQUFkOztFQUNBVCxJQUFBQSxHQUFHLENBQUMsQ0FBRCxDQUFILEdBQVMsQ0FBQ0csR0FBRyxHQUFHSSxHQUFQLElBQWNJLEdBQXZCO0VBQ0FYLElBQUFBLEdBQUcsQ0FBQyxDQUFELENBQUgsR0FBUyxDQUFDRSxHQUFHLEdBQUdFLEdBQVAsSUFBY08sR0FBdkI7RUFDQVgsSUFBQUEsR0FBRyxDQUFDLENBQUQsQ0FBSCxHQUFTLE9BQU9XLEdBQWhCO0VBQ0FYLElBQUFBLEdBQUcsQ0FBQyxDQUFELENBQUgsR0FBUyxDQUFDTSxHQUFHLEdBQUdFLEdBQVAsSUFBY0csR0FBdkI7RUFDSCxHQU5NLE1BTUE7RUFDSCxRQUFNQSxHQUFDLEdBQUcsSUFBSWQsSUFBSSxDQUFDQyxJQUFMLENBQVUsSUFBSVcsR0FBSixHQUFVUixHQUFWLEdBQWdCSSxHQUExQixDQUFkOztFQUNBTCxJQUFBQSxHQUFHLENBQUMsQ0FBRCxDQUFILEdBQVMsQ0FBQ0ksR0FBRyxHQUFHRixHQUFQLElBQWNTLEdBQXZCO0VBQ0FYLElBQUFBLEdBQUcsQ0FBQyxDQUFELENBQUgsR0FBUyxDQUFDRyxHQUFHLEdBQUdJLEdBQVAsSUFBY0ksR0FBdkI7RUFDQVgsSUFBQUEsR0FBRyxDQUFDLENBQUQsQ0FBSCxHQUFTLENBQUNNLEdBQUcsR0FBR0UsR0FBUCxJQUFjRyxHQUF2QjtFQUNBWCxJQUFBQSxHQUFHLENBQUMsQ0FBRCxDQUFILEdBQVMsT0FBT1csR0FBaEI7RUFDSDtFQUNKOztFQUVELFNBQVNuQixJQUFULENBQWN6QixHQUFkLEVBQW1CaUMsR0FBbkIsRUFBd0I7RUFDcEJBLEVBQUFBLEdBQUcsR0FBR0EsR0FBRyxJQUFJLElBQUlZLFlBQUosQ0FBaUIsRUFBakIsQ0FBYjtFQUVBWixFQUFBQSxHQUFHLENBQUUsQ0FBRixDQUFILEdBQVVqQyxHQUFHLENBQUUsQ0FBRixDQUFiO0VBQ0FpQyxFQUFBQSxHQUFHLENBQUUsQ0FBRixDQUFILEdBQVVqQyxHQUFHLENBQUUsQ0FBRixDQUFiO0VBQ0FpQyxFQUFBQSxHQUFHLENBQUUsQ0FBRixDQUFILEdBQVVqQyxHQUFHLENBQUUsQ0FBRixDQUFiO0VBQ0FpQyxFQUFBQSxHQUFHLENBQUUsQ0FBRixDQUFILEdBQVVqQyxHQUFHLENBQUUsQ0FBRixDQUFiO0VBQ0FpQyxFQUFBQSxHQUFHLENBQUUsQ0FBRixDQUFILEdBQVVqQyxHQUFHLENBQUUsQ0FBRixDQUFiO0VBQ0FpQyxFQUFBQSxHQUFHLENBQUUsQ0FBRixDQUFILEdBQVVqQyxHQUFHLENBQUUsQ0FBRixDQUFiO0VBQ0FpQyxFQUFBQSxHQUFHLENBQUUsQ0FBRixDQUFILEdBQVVqQyxHQUFHLENBQUUsQ0FBRixDQUFiO0VBQ0FpQyxFQUFBQSxHQUFHLENBQUUsQ0FBRixDQUFILEdBQVVqQyxHQUFHLENBQUUsQ0FBRixDQUFiO0VBQ0FpQyxFQUFBQSxHQUFHLENBQUUsQ0FBRixDQUFILEdBQVVqQyxHQUFHLENBQUUsQ0FBRixDQUFiO0VBQ0FpQyxFQUFBQSxHQUFHLENBQUUsQ0FBRixDQUFILEdBQVVqQyxHQUFHLENBQUUsQ0FBRixDQUFiO0VBQ0FpQyxFQUFBQSxHQUFHLENBQUMsRUFBRCxDQUFILEdBQVVqQyxHQUFHLENBQUMsRUFBRCxDQUFiO0VBQ0FpQyxFQUFBQSxHQUFHLENBQUMsRUFBRCxDQUFILEdBQVVqQyxHQUFHLENBQUMsRUFBRCxDQUFiO0VBQ0FpQyxFQUFBQSxHQUFHLENBQUMsRUFBRCxDQUFILEdBQVVqQyxHQUFHLENBQUMsRUFBRCxDQUFiO0VBQ0FpQyxFQUFBQSxHQUFHLENBQUMsRUFBRCxDQUFILEdBQVVqQyxHQUFHLENBQUMsRUFBRCxDQUFiO0VBQ0FpQyxFQUFBQSxHQUFHLENBQUMsRUFBRCxDQUFILEdBQVVqQyxHQUFHLENBQUMsRUFBRCxDQUFiO0VBQ0FpQyxFQUFBQSxHQUFHLENBQUMsRUFBRCxDQUFILEdBQVVqQyxHQUFHLENBQUMsRUFBRCxDQUFiO0VBRUEsU0FBT2lDLEdBQVA7RUFDSDs7RUFFRCxTQUFTVixXQUFULENBQXFCUyxDQUFyQixFQUF3QjtFQUNwQixNQUFNYyxHQUFHLEdBQUdkLENBQUMsQ0FBQyxJQUFJLENBQUosR0FBUSxDQUFULENBQWI7RUFDQSxNQUFNZSxHQUFHLEdBQUdmLENBQUMsQ0FBQyxJQUFJLENBQUosR0FBUSxDQUFULENBQWI7RUFDQSxNQUFNZ0IsR0FBRyxHQUFHaEIsQ0FBQyxDQUFDLElBQUksQ0FBSixHQUFRLENBQVQsQ0FBYjtFQUNBLE1BQU1pQixHQUFHLEdBQUdqQixDQUFDLENBQUMsSUFBSSxDQUFKLEdBQVEsQ0FBVCxDQUFiO0VBQ0EsTUFBTWtCLEdBQUcsR0FBR2xCLENBQUMsQ0FBQyxJQUFJLENBQUosR0FBUSxDQUFULENBQWI7RUFDQSxNQUFNRSxHQUFHLEdBQUdGLENBQUMsQ0FBQyxJQUFJLENBQUosR0FBUSxDQUFULENBQWI7RUFDQSxNQUFNRyxHQUFHLEdBQUdILENBQUMsQ0FBQyxJQUFJLENBQUosR0FBUSxDQUFULENBQWI7RUFDQSxNQUFNSSxHQUFHLEdBQUdKLENBQUMsQ0FBQyxJQUFJLENBQUosR0FBUSxDQUFULENBQWI7RUFDQSxNQUFNbUIsR0FBRyxHQUFHbkIsQ0FBQyxDQUFDLElBQUksQ0FBSixHQUFRLENBQVQsQ0FBYjtFQUNBLE1BQU1LLEdBQUcsR0FBR0wsQ0FBQyxDQUFDLElBQUksQ0FBSixHQUFRLENBQVQsQ0FBYjtFQUNBLE1BQU1NLEdBQUcsR0FBR04sQ0FBQyxDQUFDLElBQUksQ0FBSixHQUFRLENBQVQsQ0FBYjtFQUNBLE1BQU1PLEdBQUcsR0FBR1AsQ0FBQyxDQUFDLElBQUksQ0FBSixHQUFRLENBQVQsQ0FBYjtFQUNBLE1BQU1vQixHQUFHLEdBQUdwQixDQUFDLENBQUMsSUFBSSxDQUFKLEdBQVEsQ0FBVCxDQUFiO0VBQ0EsTUFBTVEsR0FBRyxHQUFHUixDQUFDLENBQUMsSUFBSSxDQUFKLEdBQVEsQ0FBVCxDQUFiO0VBQ0EsTUFBTVMsR0FBRyxHQUFHVCxDQUFDLENBQUMsSUFBSSxDQUFKLEdBQVEsQ0FBVCxDQUFiO0VBQ0EsTUFBTVUsR0FBRyxHQUFHVixDQUFDLENBQUMsSUFBSSxDQUFKLEdBQVEsQ0FBVCxDQUFiO0VBQ0EsTUFBTXFCLElBQUksR0FBSWYsR0FBRyxHQUFHSSxHQUFwQjtFQUNBLE1BQU1ZLElBQUksR0FBSWIsR0FBRyxHQUFHRixHQUFwQjtFQUNBLE1BQU1nQixJQUFJLEdBQUlwQixHQUFHLEdBQUdPLEdBQXBCO0VBQ0EsTUFBTWMsSUFBSSxHQUFJZixHQUFHLEdBQUdMLEdBQXBCO0VBQ0EsTUFBTXFCLElBQUksR0FBSXRCLEdBQUcsR0FBR0ksR0FBcEI7RUFDQSxNQUFNbUIsSUFBSSxHQUFJcEIsR0FBRyxHQUFHRixHQUFwQjtFQUNBLE1BQU11QixJQUFJLEdBQUlYLEdBQUcsR0FBR04sR0FBcEI7RUFDQSxNQUFNa0IsSUFBSSxHQUFJbkIsR0FBRyxHQUFHUSxHQUFwQjtFQUNBLE1BQU1ZLElBQUksR0FBSWIsR0FBRyxHQUFHVCxHQUFwQjtFQUNBLE1BQU11QixJQUFJLEdBQUl4QixHQUFHLEdBQUdXLEdBQXBCO0VBQ0EsTUFBTWMsS0FBSyxHQUFHZixHQUFHLEdBQUdaLEdBQXBCO0VBQ0EsTUFBTTRCLEtBQUssR0FBRzdCLEdBQUcsR0FBR2MsR0FBcEI7RUFFQSxNQUFNZ0IsRUFBRSxHQUFJWixJQUFJLEdBQUduQixHQUFQLEdBQWFzQixJQUFJLEdBQUduQixHQUFwQixHQUEwQm9CLElBQUksR0FBR2pCLEdBQWxDLElBQ05jLElBQUksR0FBR3BCLEdBQVAsR0FBYXFCLElBQUksR0FBR2xCLEdBQXBCLEdBQTBCcUIsSUFBSSxHQUFHbEIsR0FEM0IsQ0FBWDtFQUVBLE1BQU0wQixFQUFFLEdBQUlaLElBQUksR0FBR1AsR0FBUCxHQUFhWSxJQUFJLEdBQUd0QixHQUFwQixHQUEwQnlCLElBQUksR0FBR3RCLEdBQWxDLElBQ05hLElBQUksR0FBR04sR0FBUCxHQUFhYSxJQUFJLEdBQUd2QixHQUFwQixHQUEwQndCLElBQUksR0FBR3JCLEdBRDNCLENBQVg7RUFFQSxNQUFNMkIsRUFBRSxHQUFJWixJQUFJLEdBQUdSLEdBQVAsR0FBYWEsSUFBSSxHQUFHMUIsR0FBcEIsR0FBMEI2QixLQUFLLEdBQUd2QixHQUFuQyxJQUNOZ0IsSUFBSSxHQUFHVCxHQUFQLEdBQWFZLElBQUksR0FBR3pCLEdBQXBCLEdBQTBCOEIsS0FBSyxHQUFHeEIsR0FENUIsQ0FBWDtFQUVBLE1BQU00QixFQUFFLEdBQUlWLElBQUksR0FBR1gsR0FBUCxHQUFhYyxJQUFJLEdBQUczQixHQUFwQixHQUEwQjhCLEtBQUssR0FBRzNCLEdBQW5DLElBQ05vQixJQUFJLEdBQUdWLEdBQVAsR0FBYWUsSUFBSSxHQUFHNUIsR0FBcEIsR0FBMEI2QixLQUFLLEdBQUcxQixHQUQ1QixDQUFYO0VBR0EsU0FBTyxPQUFPUyxHQUFHLEdBQUdtQixFQUFOLEdBQVdmLEdBQUcsR0FBR2dCLEVBQWpCLEdBQXNCZixHQUFHLEdBQUdnQixFQUE1QixHQUFpQ2YsR0FBRyxHQUFHZ0IsRUFBOUMsQ0FBUDtFQUNIOzs7Ozs7Ozs7RUNqTEQsR0FBQyxVQUFTekUsQ0FBVCxFQUFXO0FBQUM7RUFBYSxRQUFJMEUsQ0FBSjtFQUFBLFFBQU16QixDQUFOO0VBQUEsUUFBUTBCLENBQUMsR0FBQyxXQUFWO0VBQUEsUUFBc0JDLENBQUMsR0FBQyxXQUF4QjtFQUFBLFFBQW9DbkYsQ0FBQyxHQUFDLFlBQVU7RUFBQyxVQUFJa0IsQ0FBQyxHQUFDLEVBQU47RUFBQSxVQUFTa0UsQ0FBQyxHQUFDLENBQVg7O0VBQWEsZUFBU0MsQ0FBVCxHQUFZO0VBQUMsZUFBS25FLENBQUMsQ0FBQzNDLE1BQUYsR0FBUzZHLENBQWQsR0FBaUI7RUFBQyxjQUFHO0VBQUNsRSxZQUFBQSxDQUFDLENBQUNrRSxDQUFELENBQUQ7RUFBTyxXQUFYLENBQVcsT0FBTWpFLENBQU4sRUFBUTtFQUFDWixZQUFBQSxDQUFDLENBQUMrRSxPQUFGLElBQVcvRSxDQUFDLENBQUMrRSxPQUFGLENBQVVDLEtBQVYsQ0FBZ0JwRSxDQUFoQixDQUFYO0VBQThCOztFQUFBRCxVQUFBQSxDQUFDLENBQUNrRSxDQUFDLEVBQUYsQ0FBRCxHQUFPNUIsQ0FBUCxFQUFTLFFBQU00QixDQUFOLEtBQVVsRSxDQUFDLENBQUNzRSxNQUFGLENBQVMsQ0FBVCxFQUFXLElBQVgsR0FBaUJKLENBQUMsR0FBQyxDQUE3QixDQUFUO0VBQXlDO0VBQUM7O0VBQUEsVUFBSUssQ0FBQyxHQUFDLFlBQVU7RUFBQyxZQUFHLE9BQU9DLGdCQUFQLEtBQTBCUCxDQUE3QixFQUErQixPQUFPLE9BQU9RLE9BQVAsS0FBaUJSLENBQWpCLElBQW9CLGNBQVksT0FBT1EsT0FBTyxDQUFDQyxRQUEvQyxHQUF3RCxZQUFVO0VBQUNELFVBQUFBLE9BQU8sQ0FBQ0MsUUFBUixDQUFpQlAsQ0FBakI7RUFBb0IsU0FBdkYsR0FBd0YsT0FBT1EsWUFBUCxLQUFzQlYsQ0FBdEIsR0FBd0IsWUFBVTtFQUFDVSxVQUFBQSxZQUFZLENBQUNSLENBQUQsQ0FBWjtFQUFnQixTQUFuRCxHQUFvRCxZQUFVO0VBQUNTLFVBQUFBLFVBQVUsQ0FBQ1QsQ0FBRCxFQUFHLENBQUgsQ0FBVjtFQUFnQixTQUE5SztFQUErSyxZQUFJbEUsQ0FBQyxHQUFDNEUsUUFBUSxDQUFDQyxhQUFULENBQXVCLEtBQXZCLENBQU47RUFBb0MsZUFBTyxJQUFJTixnQkFBSixDQUFxQkwsQ0FBckIsRUFBd0JZLE9BQXhCLENBQWdDOUUsQ0FBaEMsRUFBa0M7RUFBQytFLFVBQUFBLFVBQVUsRUFBQyxDQUFDO0VBQWIsU0FBbEMsR0FBbUQsWUFBVTtFQUFDL0UsVUFBQUEsQ0FBQyxDQUFDZ0YsWUFBRixDQUFlLEdBQWYsRUFBbUIsQ0FBbkI7RUFBc0IsU0FBM0Y7RUFBNEYsT0FBelYsRUFBTjs7RUFBa1csYUFBTyxVQUFTaEYsQ0FBVCxFQUFXO0VBQUNELFFBQUFBLENBQUMsQ0FBQ1YsSUFBRixDQUFPVyxDQUFQLEdBQVVELENBQUMsQ0FBQzNDLE1BQUYsR0FBUzZHLENBQVQsSUFBWSxDQUFaLElBQWVLLENBQUMsRUFBMUI7RUFBNkIsT0FBaEQ7RUFBaUQsS0FBdGlCLEVBQXRDOztFQUEra0IsYUFBU1csQ0FBVCxDQUFXakYsQ0FBWCxFQUFhO0VBQUMsVUFBRyxFQUFFLGdCQUFnQmlGLENBQWxCLENBQUgsRUFBd0IsTUFBTSxJQUFJQyxTQUFKLENBQWMsNkNBQWQsQ0FBTjs7RUFBbUUsVUFBRyxjQUFZLE9BQU9sRixDQUF0QixFQUF3QjtFQUFDLFlBQUlELENBQUMsR0FBQyxJQUFOOztFQUFXLFlBQUc7RUFBQ0MsVUFBQUEsQ0FBQyxDQUFDLFVBQVNBLENBQVQsRUFBVztFQUFDRCxZQUFBQSxDQUFDLENBQUNvRixPQUFGLENBQVVuRixDQUFWO0VBQWEsV0FBMUIsRUFBMkIsVUFBU0EsQ0FBVCxFQUFXO0VBQUNELFlBQUFBLENBQUMsQ0FBQ3FGLE1BQUYsQ0FBU3BGLENBQVQ7RUFBWSxXQUFuRCxDQUFEO0VBQXNELFNBQTFELENBQTBELE9BQU1BLENBQU4sRUFBUTtFQUFDRCxVQUFBQSxDQUFDLENBQUNxRixNQUFGLENBQVNwRixDQUFUO0VBQVk7RUFBQyxPQUFwSCxNQUF5SCxJQUFHLElBQUVSLFNBQVMsQ0FBQ3BDLE1BQWYsRUFBc0IsTUFBTSxJQUFJOEgsU0FBSixDQUFjLHFCQUFtQmxGLENBQW5CLEdBQXFCLG9CQUFuQyxDQUFOO0VBQStEOztFQUFBLGFBQVNxRixDQUFULENBQVd0RixDQUFYLEVBQWFDLENBQWIsRUFBZTtFQUFDLFVBQUcsY0FBWSxPQUFPRCxDQUFDLENBQUN1RixDQUF4QixFQUEwQixJQUFHO0VBQUMsWUFBSXJCLENBQUMsR0FBQ2xFLENBQUMsQ0FBQ3VGLENBQUYsQ0FBSUMsSUFBSixDQUFTbEQsQ0FBVCxFQUFXckMsQ0FBWCxDQUFOO0VBQW9CRCxRQUFBQSxDQUFDLENBQUN5RixDQUFGLENBQUlMLE9BQUosQ0FBWWxCLENBQVo7RUFBZSxPQUF2QyxDQUF1QyxPQUFNakUsQ0FBTixFQUFRO0VBQUNELFFBQUFBLENBQUMsQ0FBQ3lGLENBQUYsQ0FBSUosTUFBSixDQUFXcEYsQ0FBWDtFQUFjLE9BQXhGLE1BQTZGRCxDQUFDLENBQUN5RixDQUFGLENBQUlMLE9BQUosQ0FBWW5GLENBQVo7RUFBZTs7RUFBQSxhQUFTSyxDQUFULENBQVdOLENBQVgsRUFBYUMsQ0FBYixFQUFlO0VBQUMsVUFBRyxjQUFZLE9BQU9ELENBQUMsQ0FBQ2tFLENBQXhCLEVBQTBCLElBQUc7RUFBQyxZQUFJQSxDQUFDLEdBQUNsRSxDQUFDLENBQUNrRSxDQUFGLENBQUlzQixJQUFKLENBQVNsRCxDQUFULEVBQVdyQyxDQUFYLENBQU47RUFBb0JELFFBQUFBLENBQUMsQ0FBQ3lGLENBQUYsQ0FBSUwsT0FBSixDQUFZbEIsQ0FBWjtFQUFlLE9BQXZDLENBQXVDLE9BQU1qRSxDQUFOLEVBQVE7RUFBQ0QsUUFBQUEsQ0FBQyxDQUFDeUYsQ0FBRixDQUFJSixNQUFKLENBQVdwRixDQUFYO0VBQWMsT0FBeEYsTUFBNkZELENBQUMsQ0FBQ3lGLENBQUYsQ0FBSUosTUFBSixDQUFXcEYsQ0FBWDtFQUFjOztFQUFBaUYsSUFBQUEsQ0FBQyxDQUFDUSxTQUFGLEdBQVk7RUFBQ04sTUFBQUEsT0FBTyxFQUFDLGlCQUFTbEIsQ0FBVCxFQUFXO0VBQUMsWUFBRyxLQUFLeUIsS0FBTCxLQUFhNUIsQ0FBaEIsRUFBa0I7RUFBQyxjQUFHRyxDQUFDLEtBQUcsSUFBUCxFQUFZLE9BQU8sS0FBS21CLE1BQUwsQ0FBWSxJQUFJRixTQUFKLENBQWMsc0NBQWQsQ0FBWixDQUFQO0VBQTBFLGNBQUloQixDQUFDLEdBQUMsSUFBTjtFQUFXLGNBQUdELENBQUMsS0FBRyxjQUFZLE9BQU9BLENBQW5CLElBQXNCLFlBQVUsT0FBT0EsQ0FBMUMsQ0FBSixFQUFpRCxJQUFHO0VBQUMsZ0JBQUlsRSxDQUFDLEdBQUMsQ0FBQyxDQUFQO0VBQUEsZ0JBQVNDLENBQUMsR0FBQ2lFLENBQUMsQ0FBQzBCLElBQWI7RUFBa0IsZ0JBQUcsY0FBWSxPQUFPM0YsQ0FBdEIsRUFBd0IsT0FBTyxLQUFLQSxDQUFDLENBQUN1RixJQUFGLENBQU90QixDQUFQLEVBQVMsVUFBU2pFLENBQVQsRUFBVztFQUFDRCxjQUFBQSxDQUFDLEtBQUdBLENBQUMsR0FBQyxDQUFDLENBQUgsRUFBS21FLENBQUMsQ0FBQ2lCLE9BQUYsQ0FBVW5GLENBQVYsQ0FBUixDQUFEO0VBQXVCLGFBQTVDLEVBQTZDLFVBQVNBLENBQVQsRUFBVztFQUFDRCxjQUFBQSxDQUFDLEtBQUdBLENBQUMsR0FBQyxDQUFDLENBQUgsRUFBS21FLENBQUMsQ0FBQ2tCLE1BQUYsQ0FBU3BGLENBQVQsQ0FBUixDQUFEO0VBQXNCLGFBQS9FLENBQVo7RUFBNkYsV0FBM0ksQ0FBMkksT0FBTUEsQ0FBTixFQUFRO0VBQUMsbUJBQU8sTUFBS0QsQ0FBQyxJQUFFLEtBQUtxRixNQUFMLENBQVlwRixDQUFaLENBQVIsQ0FBUDtFQUErQjtFQUFBLGVBQUswRixLQUFMLEdBQVczQixDQUFYLEVBQWEsS0FBSzFELENBQUwsR0FBTzRELENBQXBCLEVBQXNCQyxDQUFDLENBQUNKLENBQUYsSUFBS2pGLENBQUMsQ0FBQyxZQUFVO0VBQUMsaUJBQUksSUFBSW1CLENBQUMsR0FBQyxDQUFOLEVBQVFELENBQUMsR0FBQ21FLENBQUMsQ0FBQ0osQ0FBRixDQUFJMUcsTUFBbEIsRUFBeUI0QyxDQUFDLEdBQUNELENBQTNCLEVBQTZCQyxDQUFDLEVBQTlCO0VBQWlDcUYsY0FBQUEsQ0FBQyxDQUFDbkIsQ0FBQyxDQUFDSixDQUFGLENBQUk5RCxDQUFKLENBQUQsRUFBUWlFLENBQVIsQ0FBRDtFQUFqQztFQUE2QyxXQUF6RCxDQUE1QjtFQUF1RjtFQUFDLE9BQXJjO0VBQXNjbUIsTUFBQUEsTUFBTSxFQUFDLGdCQUFTbkIsQ0FBVCxFQUFXO0VBQUMsWUFBRyxLQUFLeUIsS0FBTCxLQUFhNUIsQ0FBaEIsRUFBa0I7RUFBQyxjQUFJOUQsQ0FBQyxHQUFDLElBQU47RUFBVyxlQUFLMEYsS0FBTCxHQUFXLFVBQVgsRUFBc0IsS0FBS3JGLENBQUwsR0FBTzRELENBQTdCO0VBQStCLGNBQUlDLENBQUMsR0FBQyxLQUFLSixDQUFYO0VBQWFqRixVQUFBQSxDQUFDLENBQUNxRixDQUFDLEdBQUMsWUFBVTtFQUFDLGlCQUFJLElBQUlsRSxDQUFDLEdBQUMsQ0FBTixFQUFRRCxDQUFDLEdBQUNtRSxDQUFDLENBQUM5RyxNQUFoQixFQUF1QjRDLENBQUMsR0FBQ0QsQ0FBekIsRUFBMkJDLENBQUMsRUFBNUI7RUFBK0JLLGNBQUFBLENBQUMsQ0FBQzZELENBQUMsQ0FBQ2xFLENBQUQsQ0FBRixFQUFNaUUsQ0FBTixDQUFEO0VBQS9CO0VBQXlDLFdBQXJELEdBQXNELFlBQVU7RUFBQ2pFLFlBQUFBLENBQUMsQ0FBQzRGLE9BQUYsSUFBVyxDQUFDWCxDQUFDLENBQUNZLDhCQUFILElBQW1DekcsQ0FBQyxDQUFDK0UsT0FBckMsSUFBOENjLENBQUMsQ0FBQ2EsSUFBRixDQUFPLDZDQUFQLEVBQXFEN0IsQ0FBckQsRUFBdURBLENBQUMsR0FBQ0EsQ0FBQyxDQUFDOEIsS0FBSCxHQUFTLElBQWpFLENBQXpEO0VBQWdJLFdBQW5NLENBQUQ7RUFBc007RUFBQyxPQUExdUI7RUFBMnVCSixNQUFBQSxJQUFJLEVBQUMsY0FBUzNGLENBQVQsRUFBV0QsQ0FBWCxFQUFhO0VBQUMsWUFBSWtFLENBQUMsR0FBQyxJQUFJZ0IsQ0FBSixFQUFOO0VBQUEsWUFBWWYsQ0FBQyxHQUFDO0VBQUNvQixVQUFBQSxDQUFDLEVBQUN0RixDQUFIO0VBQUtpRSxVQUFBQSxDQUFDLEVBQUNsRSxDQUFQO0VBQVN5RixVQUFBQSxDQUFDLEVBQUN2QjtFQUFYLFNBQWQ7RUFBNEIsWUFBRyxLQUFLeUIsS0FBTCxLQUFhNUIsQ0FBaEIsRUFBa0IsS0FBS0EsQ0FBTCxHQUFPLEtBQUtBLENBQUwsQ0FBT3pFLElBQVAsQ0FBWTZFLENBQVosQ0FBUCxHQUFzQixLQUFLSixDQUFMLEdBQU8sQ0FBQ0ksQ0FBRCxDQUE3QixDQUFsQixLQUF1RDtFQUFDLGNBQUlJLENBQUMsR0FBQyxLQUFLb0IsS0FBWDtFQUFBLGNBQWlCdEcsQ0FBQyxHQUFDLEtBQUtpQixDQUF4QjtFQUEwQixlQUFLdUYsT0FBTCxHQUFhLENBQUMsQ0FBZCxFQUFnQi9HLENBQUMsQ0FBQyxZQUFVO0VBQUN5RixZQUFBQSxDQUFDLEtBQUdQLENBQUosR0FBTXNCLENBQUMsQ0FBQ25CLENBQUQsRUFBRzlFLENBQUgsQ0FBUCxHQUFhaUIsQ0FBQyxDQUFDNkQsQ0FBRCxFQUFHOUUsQ0FBSCxDQUFkO0VBQW9CLFdBQWhDLENBQWpCO0VBQW1EO0VBQUEsZUFBTzZFLENBQVA7RUFBUyxPQUF4NkI7RUFBeTZCK0IsTUFBQUEsS0FBSyxFQUFDLGdCQUFTaEcsQ0FBVCxFQUFXO0VBQUMsZUFBTyxLQUFLMkYsSUFBTCxDQUFVLElBQVYsRUFBZTNGLENBQWYsQ0FBUDtFQUF5QixPQUFwOUI7RUFBcTlCaUcsTUFBQUEsT0FBTyxFQUFDLGtCQUFTakcsQ0FBVCxFQUFXO0VBQUMsZUFBTyxLQUFLMkYsSUFBTCxDQUFVM0YsQ0FBVixFQUFZQSxDQUFaLENBQVA7RUFBc0IsT0FBLy9CO0VBQWdnQ2tHLE1BQUFBLE9BQU8sRUFBQyxpQkFBU2xHLENBQVQsRUFBV2tFLENBQVgsRUFBYTtFQUFDQSxRQUFBQSxDQUFDLEdBQUNBLENBQUMsSUFBRSxTQUFMO0VBQWUsWUFBSUksQ0FBQyxHQUFDLElBQU47RUFBVyxlQUFPLElBQUlXLENBQUosQ0FBTSxVQUFTbEYsQ0FBVCxFQUFXa0UsQ0FBWCxFQUFhO0VBQUNVLFVBQUFBLFVBQVUsQ0FBQyxZQUFVO0VBQUNWLFlBQUFBLENBQUMsQ0FBQ2tDLEtBQUssQ0FBQ2pDLENBQUQsQ0FBTixDQUFEO0VBQVksV0FBeEIsRUFBeUJsRSxDQUF6QixDQUFWLEVBQXNDc0UsQ0FBQyxDQUFDcUIsSUFBRixDQUFPLFVBQVMzRixDQUFULEVBQVc7RUFBQ0QsWUFBQUEsQ0FBQyxDQUFDQyxDQUFELENBQUQ7RUFBSyxXQUF4QixFQUF5QixVQUFTQSxDQUFULEVBQVc7RUFBQ2lFLFlBQUFBLENBQUMsQ0FBQ2pFLENBQUQsQ0FBRDtFQUFLLFdBQTFDLENBQXRDO0VBQWtGLFNBQXRHLENBQVA7RUFBK0c7RUFBL3BDLEtBQVosRUFBNnFDaUYsQ0FBQyxDQUFDRSxPQUFGLEdBQVUsVUFBU25GLENBQVQsRUFBVztFQUFDLFVBQUlELENBQUMsR0FBQyxJQUFJa0YsQ0FBSixFQUFOO0VBQVksYUFBT2xGLENBQUMsQ0FBQ29GLE9BQUYsQ0FBVW5GLENBQVYsR0FBYUQsQ0FBcEI7RUFBc0IsS0FBcnVDLEVBQXN1Q2tGLENBQUMsQ0FBQ0csTUFBRixHQUFTLFVBQVNwRixDQUFULEVBQVc7RUFBQyxVQUFJRCxDQUFDLEdBQUMsSUFBSWtGLENBQUosRUFBTjtFQUFZLGFBQU9sRixDQUFDLENBQUMrRCxDQUFGLEdBQUksRUFBSixFQUFPL0QsQ0FBQyxDQUFDcUYsTUFBRixDQUFTcEYsQ0FBVCxDQUFQLEVBQW1CRCxDQUExQjtFQUE0QixLQUFueUMsRUFBb3lDa0YsQ0FBQyxDQUFDbUIsR0FBRixHQUFNLFVBQVNuQyxDQUFULEVBQVc7RUFBQyxVQUFJQyxDQUFDLEdBQUMsRUFBTjtFQUFBLFVBQVNJLENBQUMsR0FBQyxDQUFYO0VBQUEsVUFBYWxGLENBQUMsR0FBQyxJQUFJNkYsQ0FBSixFQUFmOztFQUFxQixlQUFTakYsQ0FBVCxDQUFXQSxDQUFYLEVBQWFELENBQWIsRUFBZTtFQUFDQyxRQUFBQSxDQUFDLElBQUUsY0FBWSxPQUFPQSxDQUFDLENBQUMyRixJQUF4QixLQUErQjNGLENBQUMsR0FBQ2lGLENBQUMsQ0FBQ0UsT0FBRixDQUFVbkYsQ0FBVixDQUFqQyxHQUErQ0EsQ0FBQyxDQUFDMkYsSUFBRixDQUFPLFVBQVMzRixDQUFULEVBQVc7RUFBQ2tFLFVBQUFBLENBQUMsQ0FBQ25FLENBQUQsQ0FBRCxHQUFLQyxDQUFMLEVBQU8sRUFBRXNFLENBQUYsSUFBS0wsQ0FBQyxDQUFDN0csTUFBUCxJQUFlZ0MsQ0FBQyxDQUFDK0YsT0FBRixDQUFVakIsQ0FBVixDQUF0QjtFQUFtQyxTQUF0RCxFQUF1RCxVQUFTbEUsQ0FBVCxFQUFXO0VBQUNaLFVBQUFBLENBQUMsQ0FBQ2dHLE1BQUYsQ0FBU3BGLENBQVQ7RUFBWSxTQUEvRSxDQUEvQztFQUFnSTs7RUFBQSxXQUFJLElBQUlELENBQUMsR0FBQyxDQUFWLEVBQVlBLENBQUMsR0FBQ2tFLENBQUMsQ0FBQzdHLE1BQWhCLEVBQXVCMkMsQ0FBQyxFQUF4QjtFQUEyQkMsUUFBQUEsQ0FBQyxDQUFDaUUsQ0FBQyxDQUFDbEUsQ0FBRCxDQUFGLEVBQU1BLENBQU4sQ0FBRDtFQUEzQjs7RUFBcUMsYUFBT2tFLENBQUMsQ0FBQzdHLE1BQUYsSUFBVWdDLENBQUMsQ0FBQytGLE9BQUYsQ0FBVWpCLENBQVYsQ0FBVixFQUF1QjlFLENBQTlCO0VBQWdDLEtBQWhpRCxFQUFpaUQ2RixDQUFDLENBQUNhLElBQUYsR0FBTzNCLE9BQU8sQ0FBQzJCLElBQWhqRCxFQUFxakQsQUFBa0JPLE1BQU0sQ0FBQ0MsT0FBekIsS0FBbUNELGNBQUEsR0FBZXBCLENBQWxELENBQXJqRCxFQUEwbUQ3RixDQUFDLENBQUNtSCxNQUFGLElBQVVuSCxDQUFDLENBQUNtSCxNQUFGLENBQVNDLEdBQW5CLElBQXdCcEgsQ0FBQyxDQUFDbUgsTUFBRixDQUFTLEVBQVQsRUFBWSxZQUFVO0VBQUMsYUFBT3RCLENBQVA7RUFBUyxLQUFoQyxDQUFsb0QsRUFBb3FELENBQUM3RixDQUFDLENBQUNxSCxNQUFGLEdBQVN4QixDQUFWLEVBQWF5QixJQUFiLEdBQWtCN0gsQ0FBdHJEO0VBQXdyRCxHQUE5MEYsQ0FBKzBGLGVBQWEsT0FBTzhILGNBQXBCLEdBQTJCQSxjQUEzQixHQUFrQ0MsY0FBajNGLENBQUQ7OztFQ01PLElBQUlDLE9BQU8sR0FBRyxRQUFkO0FBQ1AsRUFBTyxJQUFJQyxVQUFVLEdBQUcsT0FBT3hFLFlBQVAsS0FBd0IsV0FBeEIsR0FBc0NBLFlBQXRDLEdBQXFEckQsS0FBdEU7QUFDUCxFQVdBLElBQUk4SCxNQUFNLEdBQUd4RixJQUFJLENBQUN5RixFQUFMLEdBQVUsR0FBdkI7O0VDUE8sU0FBU0MsUUFBVCxHQUFrQjtFQUN2QixNQUFJQyxHQUFHLEdBQUcsSUFBSUMsVUFBSixDQUF3QixDQUF4QixDQUFWOztFQUNBLE1BQUlBLFVBQUEsSUFBdUI3RSxZQUEzQixFQUF5QztFQUN2QzRFLElBQUFBLEdBQUcsQ0FBQyxDQUFELENBQUgsR0FBUyxDQUFUO0VBQ0FBLElBQUFBLEdBQUcsQ0FBQyxDQUFELENBQUgsR0FBUyxDQUFUO0VBQ0FBLElBQUFBLEdBQUcsQ0FBQyxDQUFELENBQUgsR0FBUyxDQUFUO0VBQ0FBLElBQUFBLEdBQUcsQ0FBQyxDQUFELENBQUgsR0FBUyxDQUFUO0VBQ0FBLElBQUFBLEdBQUcsQ0FBQyxDQUFELENBQUgsR0FBUyxDQUFUO0VBQ0FBLElBQUFBLEdBQUcsQ0FBQyxDQUFELENBQUgsR0FBUyxDQUFUO0VBQ0Q7O0VBQ0RBLEVBQUFBLEdBQUcsQ0FBQyxDQUFELENBQUgsR0FBUyxDQUFUO0VBQ0FBLEVBQUFBLEdBQUcsQ0FBQyxDQUFELENBQUgsR0FBUyxDQUFUO0VBQ0FBLEVBQUFBLEdBQUcsQ0FBQyxDQUFELENBQUgsR0FBUyxDQUFUO0VBQ0EsU0FBT0EsR0FBUDtFQUNEOztFQ3NuQ00sU0FBU0UsNEJBQVQsQ0FBc0NGLEdBQXRDLEVBQTJDRyxDQUEzQyxFQUE4Q2hILENBQTlDLEVBQWlEZ0MsQ0FBakQsRUFBb0Q7RUFFekQsTUFBSWlGLENBQUMsR0FBR0QsQ0FBQyxDQUFDLENBQUQsQ0FBVDtFQUFBLE1BQ0kvQixDQUFDLEdBQUcrQixDQUFDLENBQUMsQ0FBRCxDQURUO0VBQUEsTUFFSUUsQ0FBQyxHQUFHRixDQUFDLENBQUMsQ0FBRCxDQUZUO0VBQUEsTUFHSUcsQ0FBQyxHQUFHSCxDQUFDLENBQUMsQ0FBRCxDQUhUO0VBSUEsTUFBSUksRUFBRSxHQUFHSCxDQUFDLEdBQUdBLENBQWI7RUFDQSxNQUFJSSxFQUFFLEdBQUdwQyxDQUFDLEdBQUdBLENBQWI7RUFDQSxNQUFJcUMsRUFBRSxHQUFHSixDQUFDLEdBQUdBLENBQWI7RUFFQSxNQUFJSyxFQUFFLEdBQUdOLENBQUMsR0FBR0csRUFBYjtFQUNBLE1BQUlJLEVBQUUsR0FBR1AsQ0FBQyxHQUFHSSxFQUFiO0VBQ0EsTUFBSUksRUFBRSxHQUFHUixDQUFDLEdBQUdLLEVBQWI7RUFDQSxNQUFJSSxFQUFFLEdBQUd6QyxDQUFDLEdBQUdvQyxFQUFiO0VBQ0EsTUFBSU0sRUFBRSxHQUFHMUMsQ0FBQyxHQUFHcUMsRUFBYjtFQUNBLE1BQUlNLEVBQUUsR0FBR1YsQ0FBQyxHQUFHSSxFQUFiO0VBQ0EsTUFBSU8sRUFBRSxHQUFHVixDQUFDLEdBQUdDLEVBQWI7RUFDQSxNQUFJVSxFQUFFLEdBQUdYLENBQUMsR0FBR0UsRUFBYjtFQUNBLE1BQUlVLEVBQUUsR0FBR1osQ0FBQyxHQUFHRyxFQUFiO0VBQ0EsTUFBSS9HLEVBQUUsR0FBR3lCLENBQUMsQ0FBQyxDQUFELENBQVY7RUFDQSxNQUFJeEIsRUFBRSxHQUFHd0IsQ0FBQyxDQUFDLENBQUQsQ0FBVjtFQUNBLE1BQUl2QixFQUFFLEdBQUd1QixDQUFDLENBQUMsQ0FBRCxDQUFWO0VBRUE2RSxFQUFBQSxHQUFHLENBQUMsQ0FBRCxDQUFILEdBQVMsQ0FBQyxLQUFLYSxFQUFFLEdBQUdFLEVBQVYsQ0FBRCxJQUFrQnJILEVBQTNCO0VBQ0FzRyxFQUFBQSxHQUFHLENBQUMsQ0FBRCxDQUFILEdBQVMsQ0FBQ1csRUFBRSxHQUFHTyxFQUFOLElBQVl4SCxFQUFyQjtFQUNBc0csRUFBQUEsR0FBRyxDQUFDLENBQUQsQ0FBSCxHQUFTLENBQUNZLEVBQUUsR0FBR0ssRUFBTixJQUFZdkgsRUFBckI7RUFDQXNHLEVBQUFBLEdBQUcsQ0FBQyxDQUFELENBQUgsR0FBUyxDQUFUO0VBQ0FBLEVBQUFBLEdBQUcsQ0FBQyxDQUFELENBQUgsR0FBUyxDQUFDVyxFQUFFLEdBQUdPLEVBQU4sSUFBWXZILEVBQXJCO0VBQ0FxRyxFQUFBQSxHQUFHLENBQUMsQ0FBRCxDQUFILEdBQVMsQ0FBQyxLQUFLVSxFQUFFLEdBQUdLLEVBQVYsQ0FBRCxJQUFrQnBILEVBQTNCO0VBQ0FxRyxFQUFBQSxHQUFHLENBQUMsQ0FBRCxDQUFILEdBQVMsQ0FBQ2MsRUFBRSxHQUFHRSxFQUFOLElBQVlySCxFQUFyQjtFQUNBcUcsRUFBQUEsR0FBRyxDQUFDLENBQUQsQ0FBSCxHQUFTLENBQVQ7RUFDQUEsRUFBQUEsR0FBRyxDQUFDLENBQUQsQ0FBSCxHQUFTLENBQUNZLEVBQUUsR0FBR0ssRUFBTixJQUFZckgsRUFBckI7RUFDQW9HLEVBQUFBLEdBQUcsQ0FBQyxDQUFELENBQUgsR0FBUyxDQUFDYyxFQUFFLEdBQUdFLEVBQU4sSUFBWXBILEVBQXJCO0VBQ0FvRyxFQUFBQSxHQUFHLENBQUMsRUFBRCxDQUFILEdBQVUsQ0FBQyxLQUFLVSxFQUFFLEdBQUdHLEVBQVYsQ0FBRCxJQUFrQmpILEVBQTVCO0VBQ0FvRyxFQUFBQSxHQUFHLENBQUMsRUFBRCxDQUFILEdBQVUsQ0FBVjtFQUNBQSxFQUFBQSxHQUFHLENBQUMsRUFBRCxDQUFILEdBQVU3RyxDQUFDLENBQUMsQ0FBRCxDQUFYO0VBQ0E2RyxFQUFBQSxHQUFHLENBQUMsRUFBRCxDQUFILEdBQVU3RyxDQUFDLENBQUMsQ0FBRCxDQUFYO0VBQ0E2RyxFQUFBQSxHQUFHLENBQUMsRUFBRCxDQUFILEdBQVU3RyxDQUFDLENBQUMsQ0FBRCxDQUFYO0VBQ0E2RyxFQUFBQSxHQUFHLENBQUMsRUFBRCxDQUFILEdBQVUsQ0FBVjtFQUVBLFNBQU9BLEdBQVA7RUFDRDs7RUM3cUNNLFNBQVNELFFBQVQsR0FBa0I7RUFDdkIsTUFBSUMsR0FBRyxHQUFHLElBQUlDLFVBQUosQ0FBd0IsQ0FBeEIsQ0FBVjs7RUFDQSxNQUFJQSxVQUFBLElBQXVCN0UsWUFBM0IsRUFBeUM7RUFDdkM0RSxJQUFBQSxHQUFHLENBQUMsQ0FBRCxDQUFILEdBQVMsQ0FBVDtFQUNBQSxJQUFBQSxHQUFHLENBQUMsQ0FBRCxDQUFILEdBQVMsQ0FBVDtFQUNBQSxJQUFBQSxHQUFHLENBQUMsQ0FBRCxDQUFILEdBQVMsQ0FBVDtFQUNEOztFQUNELFNBQU9BLEdBQVA7RUFDRDtBQVFELEVBY08sU0FBUzlKLFFBQVQsQ0FBZ0J5QixDQUFoQixFQUFtQjtFQUN4QixNQUFJeUksQ0FBQyxHQUFHekksQ0FBQyxDQUFDLENBQUQsQ0FBVDtFQUNBLE1BQUl5RyxDQUFDLEdBQUd6RyxDQUFDLENBQUMsQ0FBRCxDQUFUO0VBQ0EsTUFBSTBJLENBQUMsR0FBRzFJLENBQUMsQ0FBQyxDQUFELENBQVQ7RUFDQSxTQUFPMEMsSUFBSSxDQUFDQyxJQUFMLENBQVU4RixDQUFDLEdBQUdBLENBQUosR0FBUWhDLENBQUMsR0FBR0EsQ0FBWixHQUFnQmlDLENBQUMsR0FBR0EsQ0FBOUIsQ0FBUDtFQUNEO0FBVUQsRUFBTyxTQUFTYyxZQUFULENBQW9CZixDQUFwQixFQUF1QmhDLENBQXZCLEVBQTBCaUMsQ0FBMUIsRUFBNkI7RUFDbEMsTUFBSUwsR0FBRyxHQUFHLElBQUlDLFVBQUosQ0FBd0IsQ0FBeEIsQ0FBVjtFQUNBRCxFQUFBQSxHQUFHLENBQUMsQ0FBRCxDQUFILEdBQVNJLENBQVQ7RUFDQUosRUFBQUEsR0FBRyxDQUFDLENBQUQsQ0FBSCxHQUFTNUIsQ0FBVDtFQUNBNEIsRUFBQUEsR0FBRyxDQUFDLENBQUQsQ0FBSCxHQUFTSyxDQUFUO0VBQ0EsU0FBT0wsR0FBUDtFQUNEO0FBU0QsRUFzUU8sU0FBU29CLFNBQVQsQ0FBbUJwQixHQUFuQixFQUF3QnJJLENBQXhCLEVBQTJCO0VBQ2hDLE1BQUl5SSxDQUFDLEdBQUd6SSxDQUFDLENBQUMsQ0FBRCxDQUFUO0VBQ0EsTUFBSXlHLENBQUMsR0FBR3pHLENBQUMsQ0FBQyxDQUFELENBQVQ7RUFDQSxNQUFJMEksQ0FBQyxHQUFHMUksQ0FBQyxDQUFDLENBQUQsQ0FBVDtFQUNBLE1BQUkwSixHQUFHLEdBQUdqQixDQUFDLEdBQUdBLENBQUosR0FBUWhDLENBQUMsR0FBR0EsQ0FBWixHQUFnQmlDLENBQUMsR0FBR0EsQ0FBOUI7O0VBQ0EsTUFBSWdCLEdBQUcsR0FBRyxDQUFWLEVBQWE7RUFFWEEsSUFBQUEsR0FBRyxHQUFHLElBQUloSCxJQUFJLENBQUNDLElBQUwsQ0FBVStHLEdBQVYsQ0FBVjtFQUNBckIsSUFBQUEsR0FBRyxDQUFDLENBQUQsQ0FBSCxHQUFTckksQ0FBQyxDQUFDLENBQUQsQ0FBRCxHQUFPMEosR0FBaEI7RUFDQXJCLElBQUFBLEdBQUcsQ0FBQyxDQUFELENBQUgsR0FBU3JJLENBQUMsQ0FBQyxDQUFELENBQUQsR0FBTzBKLEdBQWhCO0VBQ0FyQixJQUFBQSxHQUFHLENBQUMsQ0FBRCxDQUFILEdBQVNySSxDQUFDLENBQUMsQ0FBRCxDQUFELEdBQU8wSixHQUFoQjtFQUNEOztFQUNELFNBQU9yQixHQUFQO0VBQ0Q7QUFTRCxFQUFPLFNBQVNzQixHQUFULENBQWEzSixDQUFiLEVBQWdCQyxDQUFoQixFQUFtQjtFQUN4QixTQUFPRCxDQUFDLENBQUMsQ0FBRCxDQUFELEdBQU9DLENBQUMsQ0FBQyxDQUFELENBQVIsR0FBY0QsQ0FBQyxDQUFDLENBQUQsQ0FBRCxHQUFPQyxDQUFDLENBQUMsQ0FBRCxDQUF0QixHQUE0QkQsQ0FBQyxDQUFDLENBQUQsQ0FBRCxHQUFPQyxDQUFDLENBQUMsQ0FBRCxDQUEzQztFQUNEO0FBVUQsRUFBTyxTQUFTMkosS0FBVCxDQUFldkIsR0FBZixFQUFvQnJJLENBQXBCLEVBQXVCQyxDQUF2QixFQUEwQjtFQUMvQixNQUFJNEosRUFBRSxHQUFHN0osQ0FBQyxDQUFDLENBQUQsQ0FBVjtFQUFBLE1BQ0k4SixFQUFFLEdBQUc5SixDQUFDLENBQUMsQ0FBRCxDQURWO0VBQUEsTUFFSStKLEVBQUUsR0FBRy9KLENBQUMsQ0FBQyxDQUFELENBRlY7RUFHQSxNQUFJZ0ssRUFBRSxHQUFHL0osQ0FBQyxDQUFDLENBQUQsQ0FBVjtFQUFBLE1BQ0lnSyxFQUFFLEdBQUdoSyxDQUFDLENBQUMsQ0FBRCxDQURWO0VBQUEsTUFFSWlLLEVBQUUsR0FBR2pLLENBQUMsQ0FBQyxDQUFELENBRlY7RUFJQW9JLEVBQUFBLEdBQUcsQ0FBQyxDQUFELENBQUgsR0FBU3lCLEVBQUUsR0FBR0ksRUFBTCxHQUFVSCxFQUFFLEdBQUdFLEVBQXhCO0VBQ0E1QixFQUFBQSxHQUFHLENBQUMsQ0FBRCxDQUFILEdBQVMwQixFQUFFLEdBQUdDLEVBQUwsR0FBVUgsRUFBRSxHQUFHSyxFQUF4QjtFQUNBN0IsRUFBQUEsR0FBRyxDQUFDLENBQUQsQ0FBSCxHQUFTd0IsRUFBRSxHQUFHSSxFQUFMLEdBQVVILEVBQUUsR0FBR0UsRUFBeEI7RUFDQSxTQUFPM0IsR0FBUDtFQUNEO0FBV0QsRUEyVk8sSUFBSXFCLEdBQUcsR0FBR25MLFFBQVY7QUFNUCxFQWNPLElBQUk0TCxPQUFPLEdBQUcsWUFBWTtFQUMvQixNQUFJQyxHQUFHLEdBQUdoQyxRQUFNLEVBQWhCO0VBRUEsU0FBTyxVQUFVcEksQ0FBVixFQUFhcUssTUFBYixFQUFxQkMsTUFBckIsRUFBNkJDLEtBQTdCLEVBQW9DQyxFQUFwQyxFQUF3Q0MsR0FBeEMsRUFBNkM7RUFDbEQsUUFBSWxLLENBQUMsR0FBRyxLQUFLLENBQWI7RUFBQSxRQUNJNkYsQ0FBQyxHQUFHLEtBQUssQ0FEYjs7RUFFQSxRQUFJLENBQUNpRSxNQUFMLEVBQWE7RUFDWEEsTUFBQUEsTUFBTSxHQUFHLENBQVQ7RUFDRDs7RUFFRCxRQUFJLENBQUNDLE1BQUwsRUFBYTtFQUNYQSxNQUFBQSxNQUFNLEdBQUcsQ0FBVDtFQUNEOztFQUVELFFBQUlDLEtBQUosRUFBVztFQUNUbkUsTUFBQUEsQ0FBQyxHQUFHMUQsSUFBSSxDQUFDZ0ksR0FBTCxDQUFTSCxLQUFLLEdBQUdGLE1BQVIsR0FBaUJDLE1BQTFCLEVBQWtDdEssQ0FBQyxDQUFDekIsTUFBcEMsQ0FBSjtFQUNELEtBRkQsTUFFTztFQUNMNkgsTUFBQUEsQ0FBQyxHQUFHcEcsQ0FBQyxDQUFDekIsTUFBTjtFQUNEOztFQUVELFNBQUtnQyxDQUFDLEdBQUcrSixNQUFULEVBQWlCL0osQ0FBQyxHQUFHNkYsQ0FBckIsRUFBd0I3RixDQUFDLElBQUk4SixNQUE3QixFQUFxQztFQUNuQ0QsTUFBQUEsR0FBRyxDQUFDLENBQUQsQ0FBSCxHQUFTcEssQ0FBQyxDQUFDTyxDQUFELENBQVY7RUFBYzZKLE1BQUFBLEdBQUcsQ0FBQyxDQUFELENBQUgsR0FBU3BLLENBQUMsQ0FBQ08sQ0FBQyxHQUFHLENBQUwsQ0FBVjtFQUFrQjZKLE1BQUFBLEdBQUcsQ0FBQyxDQUFELENBQUgsR0FBU3BLLENBQUMsQ0FBQ08sQ0FBQyxHQUFHLENBQUwsQ0FBVjtFQUNoQ2lLLE1BQUFBLEVBQUUsQ0FBQ0osR0FBRCxFQUFNQSxHQUFOLEVBQVdLLEdBQVgsQ0FBRjtFQUNBekssTUFBQUEsQ0FBQyxDQUFDTyxDQUFELENBQUQsR0FBTzZKLEdBQUcsQ0FBQyxDQUFELENBQVY7RUFBY3BLLE1BQUFBLENBQUMsQ0FBQ08sQ0FBQyxHQUFHLENBQUwsQ0FBRCxHQUFXNkosR0FBRyxDQUFDLENBQUQsQ0FBZDtFQUFrQnBLLE1BQUFBLENBQUMsQ0FBQ08sQ0FBQyxHQUFHLENBQUwsQ0FBRCxHQUFXNkosR0FBRyxDQUFDLENBQUQsQ0FBZDtFQUNqQzs7RUFFRCxXQUFPcEssQ0FBUDtFQUNELEdBeEJEO0VBeUJELENBNUJvQixFQUFkOztFQzF1QkEsU0FBU29JLFFBQVQsR0FBa0I7RUFDdkIsTUFBSUMsR0FBRyxHQUFHLElBQUlDLFVBQUosQ0FBd0IsQ0FBeEIsQ0FBVjs7RUFDQSxNQUFJQSxVQUFBLElBQXVCN0UsWUFBM0IsRUFBeUM7RUFDdkM0RSxJQUFBQSxHQUFHLENBQUMsQ0FBRCxDQUFILEdBQVMsQ0FBVDtFQUNBQSxJQUFBQSxHQUFHLENBQUMsQ0FBRCxDQUFILEdBQVMsQ0FBVDtFQUNBQSxJQUFBQSxHQUFHLENBQUMsQ0FBRCxDQUFILEdBQVMsQ0FBVDtFQUNBQSxJQUFBQSxHQUFHLENBQUMsQ0FBRCxDQUFILEdBQVMsQ0FBVDtFQUNEOztFQUNELFNBQU9BLEdBQVA7RUFDRDtBQVFELEVBeVVPLFNBQVNvQixXQUFULENBQW1CcEIsR0FBbkIsRUFBd0JySSxDQUF4QixFQUEyQjtFQUNoQyxNQUFJeUksQ0FBQyxHQUFHekksQ0FBQyxDQUFDLENBQUQsQ0FBVDtFQUNBLE1BQUl5RyxDQUFDLEdBQUd6RyxDQUFDLENBQUMsQ0FBRCxDQUFUO0VBQ0EsTUFBSTBJLENBQUMsR0FBRzFJLENBQUMsQ0FBQyxDQUFELENBQVQ7RUFDQSxNQUFJMkksQ0FBQyxHQUFHM0ksQ0FBQyxDQUFDLENBQUQsQ0FBVDtFQUNBLE1BQUkwSixHQUFHLEdBQUdqQixDQUFDLEdBQUdBLENBQUosR0FBUWhDLENBQUMsR0FBR0EsQ0FBWixHQUFnQmlDLENBQUMsR0FBR0EsQ0FBcEIsR0FBd0JDLENBQUMsR0FBR0EsQ0FBdEM7O0VBQ0EsTUFBSWUsR0FBRyxHQUFHLENBQVYsRUFBYTtFQUNYQSxJQUFBQSxHQUFHLEdBQUcsSUFBSWhILElBQUksQ0FBQ0MsSUFBTCxDQUFVK0csR0FBVixDQUFWO0VBQ0FyQixJQUFBQSxHQUFHLENBQUMsQ0FBRCxDQUFILEdBQVNJLENBQUMsR0FBR2lCLEdBQWI7RUFDQXJCLElBQUFBLEdBQUcsQ0FBQyxDQUFELENBQUgsR0FBUzVCLENBQUMsR0FBR2lELEdBQWI7RUFDQXJCLElBQUFBLEdBQUcsQ0FBQyxDQUFELENBQUgsR0FBU0ssQ0FBQyxHQUFHZ0IsR0FBYjtFQUNBckIsSUFBQUEsR0FBRyxDQUFDLENBQUQsQ0FBSCxHQUFTTSxDQUFDLEdBQUdlLEdBQWI7RUFDRDs7RUFDRCxTQUFPckIsR0FBUDtFQUNEO0FBU0QsRUE0TU8sSUFBSThCLFNBQU8sR0FBRyxZQUFZO0VBQy9CLE1BQUlDLEdBQUcsR0FBR2hDLFFBQU0sRUFBaEI7RUFFQSxTQUFPLFVBQVVwSSxDQUFWLEVBQWFxSyxNQUFiLEVBQXFCQyxNQUFyQixFQUE2QkMsS0FBN0IsRUFBb0NDLEVBQXBDLEVBQXdDQyxHQUF4QyxFQUE2QztFQUNsRCxRQUFJbEssQ0FBQyxHQUFHLEtBQUssQ0FBYjtFQUFBLFFBQ0k2RixDQUFDLEdBQUcsS0FBSyxDQURiOztFQUVBLFFBQUksQ0FBQ2lFLE1BQUwsRUFBYTtFQUNYQSxNQUFBQSxNQUFNLEdBQUcsQ0FBVDtFQUNEOztFQUVELFFBQUksQ0FBQ0MsTUFBTCxFQUFhO0VBQ1hBLE1BQUFBLE1BQU0sR0FBRyxDQUFUO0VBQ0Q7O0VBRUQsUUFBSUMsS0FBSixFQUFXO0VBQ1RuRSxNQUFBQSxDQUFDLEdBQUcxRCxJQUFJLENBQUNnSSxHQUFMLENBQVNILEtBQUssR0FBR0YsTUFBUixHQUFpQkMsTUFBMUIsRUFBa0N0SyxDQUFDLENBQUN6QixNQUFwQyxDQUFKO0VBQ0QsS0FGRCxNQUVPO0VBQ0w2SCxNQUFBQSxDQUFDLEdBQUdwRyxDQUFDLENBQUN6QixNQUFOO0VBQ0Q7O0VBRUQsU0FBS2dDLENBQUMsR0FBRytKLE1BQVQsRUFBaUIvSixDQUFDLEdBQUc2RixDQUFyQixFQUF3QjdGLENBQUMsSUFBSThKLE1BQTdCLEVBQXFDO0VBQ25DRCxNQUFBQSxHQUFHLENBQUMsQ0FBRCxDQUFILEdBQVNwSyxDQUFDLENBQUNPLENBQUQsQ0FBVjtFQUFjNkosTUFBQUEsR0FBRyxDQUFDLENBQUQsQ0FBSCxHQUFTcEssQ0FBQyxDQUFDTyxDQUFDLEdBQUcsQ0FBTCxDQUFWO0VBQWtCNkosTUFBQUEsR0FBRyxDQUFDLENBQUQsQ0FBSCxHQUFTcEssQ0FBQyxDQUFDTyxDQUFDLEdBQUcsQ0FBTCxDQUFWO0VBQWtCNkosTUFBQUEsR0FBRyxDQUFDLENBQUQsQ0FBSCxHQUFTcEssQ0FBQyxDQUFDTyxDQUFDLEdBQUcsQ0FBTCxDQUFWO0VBQ2xEaUssTUFBQUEsRUFBRSxDQUFDSixHQUFELEVBQU1BLEdBQU4sRUFBV0ssR0FBWCxDQUFGO0VBQ0F6SyxNQUFBQSxDQUFDLENBQUNPLENBQUQsQ0FBRCxHQUFPNkosR0FBRyxDQUFDLENBQUQsQ0FBVjtFQUFjcEssTUFBQUEsQ0FBQyxDQUFDTyxDQUFDLEdBQUcsQ0FBTCxDQUFELEdBQVc2SixHQUFHLENBQUMsQ0FBRCxDQUFkO0VBQWtCcEssTUFBQUEsQ0FBQyxDQUFDTyxDQUFDLEdBQUcsQ0FBTCxDQUFELEdBQVc2SixHQUFHLENBQUMsQ0FBRCxDQUFkO0VBQWtCcEssTUFBQUEsQ0FBQyxDQUFDTyxDQUFDLEdBQUcsQ0FBTCxDQUFELEdBQVc2SixHQUFHLENBQUMsQ0FBRCxDQUFkO0VBQ25EOztFQUVELFdBQU9wSyxDQUFQO0VBQ0QsR0F4QkQ7RUF5QkQsQ0E1Qm9CLEVBQWQ7O0VDMWpCQSxTQUFTb0ksUUFBVCxHQUFrQjtFQUN2QixNQUFJQyxHQUFHLEdBQUcsSUFBSUMsVUFBSixDQUF3QixDQUF4QixDQUFWOztFQUNBLE1BQUlBLFVBQUEsSUFBdUI3RSxZQUEzQixFQUF5QztFQUN2QzRFLElBQUFBLEdBQUcsQ0FBQyxDQUFELENBQUgsR0FBUyxDQUFUO0VBQ0FBLElBQUFBLEdBQUcsQ0FBQyxDQUFELENBQUgsR0FBUyxDQUFUO0VBQ0FBLElBQUFBLEdBQUcsQ0FBQyxDQUFELENBQUgsR0FBUyxDQUFUO0VBQ0Q7O0VBQ0RBLEVBQUFBLEdBQUcsQ0FBQyxDQUFELENBQUgsR0FBUyxDQUFUO0VBQ0EsU0FBT0EsR0FBUDtFQUNEO0FBUUQsRUFpQk8sU0FBU3NDLFlBQVQsQ0FBc0J0QyxHQUF0QixFQUEyQnVDLElBQTNCLEVBQWlDQyxHQUFqQyxFQUFzQztFQUMzQ0EsRUFBQUEsR0FBRyxHQUFHQSxHQUFHLEdBQUcsR0FBWjtFQUNBLE1BQUlySCxDQUFDLEdBQUdkLElBQUksQ0FBQ29JLEdBQUwsQ0FBU0QsR0FBVCxDQUFSO0VBQ0F4QyxFQUFBQSxHQUFHLENBQUMsQ0FBRCxDQUFILEdBQVM3RSxDQUFDLEdBQUdvSCxJQUFJLENBQUMsQ0FBRCxDQUFqQjtFQUNBdkMsRUFBQUEsR0FBRyxDQUFDLENBQUQsQ0FBSCxHQUFTN0UsQ0FBQyxHQUFHb0gsSUFBSSxDQUFDLENBQUQsQ0FBakI7RUFDQXZDLEVBQUFBLEdBQUcsQ0FBQyxDQUFELENBQUgsR0FBUzdFLENBQUMsR0FBR29ILElBQUksQ0FBQyxDQUFELENBQWpCO0VBQ0F2QyxFQUFBQSxHQUFHLENBQUMsQ0FBRCxDQUFILEdBQVMzRixJQUFJLENBQUNxSSxHQUFMLENBQVNGLEdBQVQsQ0FBVDtFQUNBLFNBQU94QyxHQUFQO0VBQ0Q7QUFlRCxFQWtKTyxTQUFTMkMsS0FBVCxDQUFlM0MsR0FBZixFQUFvQnJJLENBQXBCLEVBQXVCQyxDQUF2QixFQUEwQmtCLENBQTFCLEVBQTZCO0VBR2xDLE1BQUkwSSxFQUFFLEdBQUc3SixDQUFDLENBQUMsQ0FBRCxDQUFWO0VBQUEsTUFDSThKLEVBQUUsR0FBRzlKLENBQUMsQ0FBQyxDQUFELENBRFY7RUFBQSxNQUVJK0osRUFBRSxHQUFHL0osQ0FBQyxDQUFDLENBQUQsQ0FGVjtFQUFBLE1BR0lpTCxFQUFFLEdBQUdqTCxDQUFDLENBQUMsQ0FBRCxDQUhWO0VBSUEsTUFBSWdLLEVBQUUsR0FBRy9KLENBQUMsQ0FBQyxDQUFELENBQVY7RUFBQSxNQUNJZ0ssRUFBRSxHQUFHaEssQ0FBQyxDQUFDLENBQUQsQ0FEVjtFQUFBLE1BRUlpSyxFQUFFLEdBQUdqSyxDQUFDLENBQUMsQ0FBRCxDQUZWO0VBQUEsTUFHSWlMLEVBQUUsR0FBR2pMLENBQUMsQ0FBQyxDQUFELENBSFY7RUFLQSxNQUFJa0wsS0FBSyxHQUFHLEtBQUssQ0FBakI7RUFBQSxNQUNJQyxLQUFLLEdBQUcsS0FBSyxDQURqQjtFQUFBLE1BRUlDLEtBQUssR0FBRyxLQUFLLENBRmpCO0VBQUEsTUFHSUMsTUFBTSxHQUFHLEtBQUssQ0FIbEI7RUFBQSxNQUlJQyxNQUFNLEdBQUcsS0FBSyxDQUpsQjtFQU9BSCxFQUFBQSxLQUFLLEdBQUd2QixFQUFFLEdBQUdHLEVBQUwsR0FBVUYsRUFBRSxHQUFHRyxFQUFmLEdBQW9CRixFQUFFLEdBQUdHLEVBQXpCLEdBQThCZSxFQUFFLEdBQUdDLEVBQTNDOztFQUVBLE1BQUlFLEtBQUssR0FBRyxHQUFaLEVBQWlCO0VBQ2ZBLElBQUFBLEtBQUssR0FBRyxDQUFDQSxLQUFUO0VBQ0FwQixJQUFBQSxFQUFFLEdBQUcsQ0FBQ0EsRUFBTjtFQUNBQyxJQUFBQSxFQUFFLEdBQUcsQ0FBQ0EsRUFBTjtFQUNBQyxJQUFBQSxFQUFFLEdBQUcsQ0FBQ0EsRUFBTjtFQUNBZ0IsSUFBQUEsRUFBRSxHQUFHLENBQUNBLEVBQU47RUFDRDs7RUFFRCxNQUFJLE1BQU1FLEtBQU4sR0FBYzlDLE9BQWxCLEVBQW9DO0VBRWxDNkMsSUFBQUEsS0FBSyxHQUFHekksSUFBSSxDQUFDOEksSUFBTCxDQUFVSixLQUFWLENBQVI7RUFDQUMsSUFBQUEsS0FBSyxHQUFHM0ksSUFBSSxDQUFDb0ksR0FBTCxDQUFTSyxLQUFULENBQVI7RUFDQUcsSUFBQUEsTUFBTSxHQUFHNUksSUFBSSxDQUFDb0ksR0FBTCxDQUFTLENBQUMsTUFBTTNKLENBQVAsSUFBWWdLLEtBQXJCLElBQThCRSxLQUF2QztFQUNBRSxJQUFBQSxNQUFNLEdBQUc3SSxJQUFJLENBQUNvSSxHQUFMLENBQVMzSixDQUFDLEdBQUdnSyxLQUFiLElBQXNCRSxLQUEvQjtFQUNELEdBTkQsTUFNTztFQUdMQyxJQUFBQSxNQUFNLEdBQUcsTUFBTW5LLENBQWY7RUFDQW9LLElBQUFBLE1BQU0sR0FBR3BLLENBQVQ7RUFDRDs7RUFFRGtILEVBQUFBLEdBQUcsQ0FBQyxDQUFELENBQUgsR0FBU2lELE1BQU0sR0FBR3pCLEVBQVQsR0FBYzBCLE1BQU0sR0FBR3ZCLEVBQWhDO0VBQ0EzQixFQUFBQSxHQUFHLENBQUMsQ0FBRCxDQUFILEdBQVNpRCxNQUFNLEdBQUd4QixFQUFULEdBQWN5QixNQUFNLEdBQUd0QixFQUFoQztFQUNBNUIsRUFBQUEsR0FBRyxDQUFDLENBQUQsQ0FBSCxHQUFTaUQsTUFBTSxHQUFHdkIsRUFBVCxHQUFjd0IsTUFBTSxHQUFHckIsRUFBaEM7RUFDQTdCLEVBQUFBLEdBQUcsQ0FBQyxDQUFELENBQUgsR0FBU2lELE1BQU0sR0FBR0wsRUFBVCxHQUFjTSxNQUFNLEdBQUdMLEVBQWhDO0VBRUEsU0FBTzdDLEdBQVA7RUFDRDtBQVFELEVBb0VPLFNBQVNvRCxRQUFULENBQWtCcEQsR0FBbEIsRUFBdUJ6RixDQUF2QixFQUEwQjtFQUcvQixNQUFJOEksTUFBTSxHQUFHOUksQ0FBQyxDQUFDLENBQUQsQ0FBRCxHQUFPQSxDQUFDLENBQUMsQ0FBRCxDQUFSLEdBQWNBLENBQUMsQ0FBQyxDQUFELENBQTVCO0VBQ0EsTUFBSStJLEtBQUssR0FBRyxLQUFLLENBQWpCOztFQUVBLE1BQUlELE1BQU0sR0FBRyxHQUFiLEVBQWtCO0VBRWhCQyxJQUFBQSxLQUFLLEdBQUdqSixJQUFJLENBQUNDLElBQUwsQ0FBVStJLE1BQU0sR0FBRyxHQUFuQixDQUFSO0VBQ0FyRCxJQUFBQSxHQUFHLENBQUMsQ0FBRCxDQUFILEdBQVMsTUFBTXNELEtBQWY7RUFDQUEsSUFBQUEsS0FBSyxHQUFHLE1BQU1BLEtBQWQ7RUFDQXRELElBQUFBLEdBQUcsQ0FBQyxDQUFELENBQUgsR0FBUyxDQUFDekYsQ0FBQyxDQUFDLENBQUQsQ0FBRCxHQUFPQSxDQUFDLENBQUMsQ0FBRCxDQUFULElBQWdCK0ksS0FBekI7RUFDQXRELElBQUFBLEdBQUcsQ0FBQyxDQUFELENBQUgsR0FBUyxDQUFDekYsQ0FBQyxDQUFDLENBQUQsQ0FBRCxHQUFPQSxDQUFDLENBQUMsQ0FBRCxDQUFULElBQWdCK0ksS0FBekI7RUFDQXRELElBQUFBLEdBQUcsQ0FBQyxDQUFELENBQUgsR0FBUyxDQUFDekYsQ0FBQyxDQUFDLENBQUQsQ0FBRCxHQUFPQSxDQUFDLENBQUMsQ0FBRCxDQUFULElBQWdCK0ksS0FBekI7RUFDRCxHQVJELE1BUU87RUFFTCxRQUFJcEwsQ0FBQyxHQUFHLENBQVI7RUFDQSxRQUFJcUMsQ0FBQyxDQUFDLENBQUQsQ0FBRCxHQUFPQSxDQUFDLENBQUMsQ0FBRCxDQUFaLEVBQWlCckMsQ0FBQyxHQUFHLENBQUo7RUFDakIsUUFBSXFDLENBQUMsQ0FBQyxDQUFELENBQUQsR0FBT0EsQ0FBQyxDQUFDckMsQ0FBQyxHQUFHLENBQUosR0FBUUEsQ0FBVCxDQUFaLEVBQXlCQSxDQUFDLEdBQUcsQ0FBSjtFQUN6QixRQUFJcUwsQ0FBQyxHQUFHLENBQUNyTCxDQUFDLEdBQUcsQ0FBTCxJQUFVLENBQWxCO0VBQ0EsUUFBSU0sQ0FBQyxHQUFHLENBQUNOLENBQUMsR0FBRyxDQUFMLElBQVUsQ0FBbEI7RUFFQW9MLElBQUFBLEtBQUssR0FBR2pKLElBQUksQ0FBQ0MsSUFBTCxDQUFVQyxDQUFDLENBQUNyQyxDQUFDLEdBQUcsQ0FBSixHQUFRQSxDQUFULENBQUQsR0FBZXFDLENBQUMsQ0FBQ2dKLENBQUMsR0FBRyxDQUFKLEdBQVFBLENBQVQsQ0FBaEIsR0FBOEJoSixDQUFDLENBQUMvQixDQUFDLEdBQUcsQ0FBSixHQUFRQSxDQUFULENBQS9CLEdBQTZDLEdBQXZELENBQVI7RUFDQXdILElBQUFBLEdBQUcsQ0FBQzlILENBQUQsQ0FBSCxHQUFTLE1BQU1vTCxLQUFmO0VBQ0FBLElBQUFBLEtBQUssR0FBRyxNQUFNQSxLQUFkO0VBQ0F0RCxJQUFBQSxHQUFHLENBQUMsQ0FBRCxDQUFILEdBQVMsQ0FBQ3pGLENBQUMsQ0FBQ2dKLENBQUMsR0FBRyxDQUFKLEdBQVEvSyxDQUFULENBQUQsR0FBZStCLENBQUMsQ0FBQy9CLENBQUMsR0FBRyxDQUFKLEdBQVErSyxDQUFULENBQWpCLElBQWdDRCxLQUF6QztFQUNBdEQsSUFBQUEsR0FBRyxDQUFDdUQsQ0FBRCxDQUFILEdBQVMsQ0FBQ2hKLENBQUMsQ0FBQ2dKLENBQUMsR0FBRyxDQUFKLEdBQVFyTCxDQUFULENBQUQsR0FBZXFDLENBQUMsQ0FBQ3JDLENBQUMsR0FBRyxDQUFKLEdBQVFxTCxDQUFULENBQWpCLElBQWdDRCxLQUF6QztFQUNBdEQsSUFBQUEsR0FBRyxDQUFDeEgsQ0FBRCxDQUFILEdBQVMsQ0FBQytCLENBQUMsQ0FBQy9CLENBQUMsR0FBRyxDQUFKLEdBQVFOLENBQVQsQ0FBRCxHQUFlcUMsQ0FBQyxDQUFDckMsQ0FBQyxHQUFHLENBQUosR0FBUU0sQ0FBVCxDQUFqQixJQUFnQzhLLEtBQXpDO0VBQ0Q7O0VBRUQsU0FBT3RELEdBQVA7RUFDRDtBQVlELEVBa0tPLElBQUlvQixXQUFTLEdBQUdvQyxXQUFoQjtBQVNQLEVBc0JPLElBQUlDLFVBQVUsR0FBRyxZQUFZO0VBQ2xDLE1BQUlDLE9BQU8sR0FBR0MsUUFBQSxFQUFkO0VBQ0EsTUFBSUMsU0FBUyxHQUFHRCxZQUFBLENBQWdCLENBQWhCLEVBQW1CLENBQW5CLEVBQXNCLENBQXRCLENBQWhCO0VBQ0EsTUFBSUUsU0FBUyxHQUFHRixZQUFBLENBQWdCLENBQWhCLEVBQW1CLENBQW5CLEVBQXNCLENBQXRCLENBQWhCO0VBRUEsU0FBTyxVQUFVM0QsR0FBVixFQUFlckksQ0FBZixFQUFrQkMsQ0FBbEIsRUFBcUI7RUFDMUIsUUFBSTBKLE1BQUcsR0FBR3FDLEdBQUEsQ0FBU2hNLENBQVQsRUFBWUMsQ0FBWixDQUFWOztFQUNBLFFBQUkwSixNQUFHLEdBQUcsQ0FBQyxRQUFYLEVBQXFCO0VBQ25CcUMsTUFBQUEsS0FBQSxDQUFXRCxPQUFYLEVBQW9CRSxTQUFwQixFQUErQmpNLENBQS9CO0VBQ0EsVUFBSWdNLEdBQUEsQ0FBU0QsT0FBVCxJQUFvQixRQUF4QixFQUFrQ0MsS0FBQSxDQUFXRCxPQUFYLEVBQW9CRyxTQUFwQixFQUErQmxNLENBQS9CO0VBQ2xDZ00sTUFBQUEsU0FBQSxDQUFlRCxPQUFmLEVBQXdCQSxPQUF4QjtFQUNBcEIsTUFBQUEsWUFBWSxDQUFDdEMsR0FBRCxFQUFNMEQsT0FBTixFQUFlckosSUFBSSxDQUFDeUYsRUFBcEIsQ0FBWjtFQUNBLGFBQU9FLEdBQVA7RUFDRCxLQU5ELE1BTU8sSUFBSXNCLE1BQUcsR0FBRyxRQUFWLEVBQW9CO0VBQ3pCdEIsTUFBQUEsR0FBRyxDQUFDLENBQUQsQ0FBSCxHQUFTLENBQVQ7RUFDQUEsTUFBQUEsR0FBRyxDQUFDLENBQUQsQ0FBSCxHQUFTLENBQVQ7RUFDQUEsTUFBQUEsR0FBRyxDQUFDLENBQUQsQ0FBSCxHQUFTLENBQVQ7RUFDQUEsTUFBQUEsR0FBRyxDQUFDLENBQUQsQ0FBSCxHQUFTLENBQVQ7RUFDQSxhQUFPQSxHQUFQO0VBQ0QsS0FOTSxNQU1BO0VBQ0wyRCxNQUFBQSxLQUFBLENBQVdELE9BQVgsRUFBb0IvTCxDQUFwQixFQUF1QkMsQ0FBdkI7RUFDQW9JLE1BQUFBLEdBQUcsQ0FBQyxDQUFELENBQUgsR0FBUzBELE9BQU8sQ0FBQyxDQUFELENBQWhCO0VBQ0ExRCxNQUFBQSxHQUFHLENBQUMsQ0FBRCxDQUFILEdBQVMwRCxPQUFPLENBQUMsQ0FBRCxDQUFoQjtFQUNBMUQsTUFBQUEsR0FBRyxDQUFDLENBQUQsQ0FBSCxHQUFTMEQsT0FBTyxDQUFDLENBQUQsQ0FBaEI7RUFDQTFELE1BQUFBLEdBQUcsQ0FBQyxDQUFELENBQUgsR0FBUyxJQUFJc0IsTUFBYjtFQUNBLGFBQU9GLFdBQVMsQ0FBQ3BCLEdBQUQsRUFBTUEsR0FBTixDQUFoQjtFQUNEO0VBQ0YsR0F0QkQ7RUF1QkQsQ0E1QnVCLEVBQWpCO0FBeUNQLEVBQU8sSUFBSThELE1BQU0sR0FBRyxZQUFZO0VBQzlCLE1BQUlDLEtBQUssR0FBR2hFLFFBQU0sRUFBbEI7RUFDQSxNQUFJaUUsS0FBSyxHQUFHakUsUUFBTSxFQUFsQjtFQUVBLFNBQU8sVUFBVUMsR0FBVixFQUFlckksQ0FBZixFQUFrQkMsQ0FBbEIsRUFBcUJnRixDQUFyQixFQUF3QnFILENBQXhCLEVBQTJCbkwsQ0FBM0IsRUFBOEI7RUFDbkM2SixJQUFBQSxLQUFLLENBQUNvQixLQUFELEVBQVFwTSxDQUFSLEVBQVdzTSxDQUFYLEVBQWNuTCxDQUFkLENBQUw7RUFDQTZKLElBQUFBLEtBQUssQ0FBQ3FCLEtBQUQsRUFBUXBNLENBQVIsRUFBV2dGLENBQVgsRUFBYzlELENBQWQsQ0FBTDtFQUNBNkosSUFBQUEsS0FBSyxDQUFDM0MsR0FBRCxFQUFNK0QsS0FBTixFQUFhQyxLQUFiLEVBQW9CLElBQUlsTCxDQUFKLElBQVMsSUFBSUEsQ0FBYixDQUFwQixDQUFMO0VBRUEsV0FBT2tILEdBQVA7RUFDRCxHQU5EO0VBT0QsQ0FYbUIsRUFBYjtBQXVCUCxFQUFPLElBQUlrRSxPQUFPLEdBQUcsWUFBWTtFQUMvQixNQUFJQyxJQUFJLEdBQUdDLFFBQUEsRUFBWDtFQUVBLFNBQU8sVUFBVXBFLEdBQVYsRUFBZXFFLElBQWYsRUFBcUJuTixLQUFyQixFQUE0Qm9OLEVBQTVCLEVBQWdDO0VBQ3JDSCxJQUFBQSxJQUFJLENBQUMsQ0FBRCxDQUFKLEdBQVVqTixLQUFLLENBQUMsQ0FBRCxDQUFmO0VBQ0FpTixJQUFBQSxJQUFJLENBQUMsQ0FBRCxDQUFKLEdBQVVqTixLQUFLLENBQUMsQ0FBRCxDQUFmO0VBQ0FpTixJQUFBQSxJQUFJLENBQUMsQ0FBRCxDQUFKLEdBQVVqTixLQUFLLENBQUMsQ0FBRCxDQUFmO0VBRUFpTixJQUFBQSxJQUFJLENBQUMsQ0FBRCxDQUFKLEdBQVVHLEVBQUUsQ0FBQyxDQUFELENBQVo7RUFDQUgsSUFBQUEsSUFBSSxDQUFDLENBQUQsQ0FBSixHQUFVRyxFQUFFLENBQUMsQ0FBRCxDQUFaO0VBQ0FILElBQUFBLElBQUksQ0FBQyxDQUFELENBQUosR0FBVUcsRUFBRSxDQUFDLENBQUQsQ0FBWjtFQUVBSCxJQUFBQSxJQUFJLENBQUMsQ0FBRCxDQUFKLEdBQVUsQ0FBQ0UsSUFBSSxDQUFDLENBQUQsQ0FBZjtFQUNBRixJQUFBQSxJQUFJLENBQUMsQ0FBRCxDQUFKLEdBQVUsQ0FBQ0UsSUFBSSxDQUFDLENBQUQsQ0FBZjtFQUNBRixJQUFBQSxJQUFJLENBQUMsQ0FBRCxDQUFKLEdBQVUsQ0FBQ0UsSUFBSSxDQUFDLENBQUQsQ0FBZjtFQUVBLFdBQU9qRCxXQUFTLENBQUNwQixHQUFELEVBQU1vRCxRQUFRLENBQUNwRCxHQUFELEVBQU1tRSxJQUFOLENBQWQsQ0FBaEI7RUFDRCxHQWREO0VBZUQsQ0FsQm9CLEVBQWQ7O0VDdG5CQSxTQUFTcEUsUUFBVCxHQUFrQjtFQUN2QixNQUFJQyxHQUFHLEdBQUcsSUFBSUMsVUFBSixDQUF3QixDQUF4QixDQUFWOztFQUNBLE1BQUlBLFVBQUEsSUFBdUI3RSxZQUEzQixFQUF5QztFQUN2QzRFLElBQUFBLEdBQUcsQ0FBQyxDQUFELENBQUgsR0FBUyxDQUFUO0VBQ0FBLElBQUFBLEdBQUcsQ0FBQyxDQUFELENBQUgsR0FBUyxDQUFUO0VBQ0Q7O0VBQ0QsU0FBT0EsR0FBUDtFQUNEO0FBUUQsRUF5akJPLElBQUk4QixTQUFPLEdBQUcsWUFBWTtFQUMvQixNQUFJQyxHQUFHLEdBQUdoQyxRQUFNLEVBQWhCO0VBRUEsU0FBTyxVQUFVcEksQ0FBVixFQUFhcUssTUFBYixFQUFxQkMsTUFBckIsRUFBNkJDLEtBQTdCLEVBQW9DQyxFQUFwQyxFQUF3Q0MsR0FBeEMsRUFBNkM7RUFDbEQsUUFBSWxLLENBQUMsR0FBRyxLQUFLLENBQWI7RUFBQSxRQUNJNkYsQ0FBQyxHQUFHLEtBQUssQ0FEYjs7RUFFQSxRQUFJLENBQUNpRSxNQUFMLEVBQWE7RUFDWEEsTUFBQUEsTUFBTSxHQUFHLENBQVQ7RUFDRDs7RUFFRCxRQUFJLENBQUNDLE1BQUwsRUFBYTtFQUNYQSxNQUFBQSxNQUFNLEdBQUcsQ0FBVDtFQUNEOztFQUVELFFBQUlDLEtBQUosRUFBVztFQUNUbkUsTUFBQUEsQ0FBQyxHQUFHMUQsSUFBSSxDQUFDZ0ksR0FBTCxDQUFTSCxLQUFLLEdBQUdGLE1BQVIsR0FBaUJDLE1BQTFCLEVBQWtDdEssQ0FBQyxDQUFDekIsTUFBcEMsQ0FBSjtFQUNELEtBRkQsTUFFTztFQUNMNkgsTUFBQUEsQ0FBQyxHQUFHcEcsQ0FBQyxDQUFDekIsTUFBTjtFQUNEOztFQUVELFNBQUtnQyxDQUFDLEdBQUcrSixNQUFULEVBQWlCL0osQ0FBQyxHQUFHNkYsQ0FBckIsRUFBd0I3RixDQUFDLElBQUk4SixNQUE3QixFQUFxQztFQUNuQ0QsTUFBQUEsR0FBRyxDQUFDLENBQUQsQ0FBSCxHQUFTcEssQ0FBQyxDQUFDTyxDQUFELENBQVY7RUFBYzZKLE1BQUFBLEdBQUcsQ0FBQyxDQUFELENBQUgsR0FBU3BLLENBQUMsQ0FBQ08sQ0FBQyxHQUFHLENBQUwsQ0FBVjtFQUNkaUssTUFBQUEsRUFBRSxDQUFDSixHQUFELEVBQU1BLEdBQU4sRUFBV0ssR0FBWCxDQUFGO0VBQ0F6SyxNQUFBQSxDQUFDLENBQUNPLENBQUQsQ0FBRCxHQUFPNkosR0FBRyxDQUFDLENBQUQsQ0FBVjtFQUFjcEssTUFBQUEsQ0FBQyxDQUFDTyxDQUFDLEdBQUcsQ0FBTCxDQUFELEdBQVc2SixHQUFHLENBQUMsQ0FBRCxDQUFkO0VBQ2Y7O0VBRUQsV0FBT3BLLENBQVA7RUFDRCxHQXhCRDtFQXlCRCxDQTVCb0IsRUFBZDs7RUMva0IwRCxJQUFJd0QsQ0FBSjtFQUFNLElBQUk0QixDQUFDLEdBQUM1QixDQUFDLEdBQUMsZUFBYSxPQUFPb0osT0FBcEIsR0FBNEJBLE9BQTVCLEdBQW9DMUwsU0FBNUM7RUFBOEMsSUFBTVgsQ0FBQyxHQUFDO0VBQUNzTSxFQUFBQSxHQUFHLEVBQUMsYUFBUzNMLENBQVQsRUFBV0MsQ0FBWCxFQUFhO0VBQUMsUUFBTXNFLENBQUMsR0FBQ2xGLENBQUMsQ0FBQ3VNLFVBQUYsRUFBUjtFQUFBLFFBQXVCdEosQ0FBQyxHQUFDLElBQUk0QixDQUFKLENBQU0sVUFBQzVCLENBQUQsRUFBRzRCLENBQUgsRUFBTztFQUFDLFVBQUdLLENBQUMsQ0FBQ3NILElBQUYsQ0FBTyxLQUFQLEVBQWE3TCxDQUFiLEVBQWUsQ0FBQyxDQUFoQixHQUFtQkMsQ0FBdEIsRUFBd0I7RUFBQyxhQUFJLElBQU1ELEVBQVYsSUFBZUMsQ0FBQyxDQUFDNkwsT0FBakI7RUFBeUJ2SCxVQUFBQSxDQUFDLENBQUN3SCxnQkFBRixDQUFtQi9MLEVBQW5CLEVBQXFCQyxDQUFDLENBQUM2TCxPQUFGLENBQVU5TCxFQUFWLENBQXJCO0VBQXpCOztFQUE0RHVFLFFBQUFBLENBQUMsQ0FBQ3lILGVBQUYsR0FBa0IsY0FBWS9MLENBQUMsQ0FBQ2dNLFdBQWhDLEVBQTRDaE0sQ0FBQyxDQUFDaU0sWUFBRixLQUFpQjNILENBQUMsQ0FBQzJILFlBQUYsR0FBZWpNLENBQUMsQ0FBQ2lNLFlBQWxDLENBQTVDO0VBQTRGOztFQUFBM0gsTUFBQUEsQ0FBQyxDQUFDNEgsa0JBQUYsR0FBcUI5TSxDQUFDLENBQUMrTSxhQUFGLENBQWdCN0gsQ0FBaEIsRUFBa0IsVUFBU3ZFLENBQVQsRUFBV0MsQ0FBWCxFQUFhO0VBQUNELFFBQUFBLENBQUMsR0FBQ2tFLENBQUMsQ0FBQ2xFLENBQUQsQ0FBRixHQUFNc0MsQ0FBQyxDQUFDckMsQ0FBRCxDQUFSO0VBQVksT0FBNUMsQ0FBckIsRUFBbUVzRSxDQUFDLENBQUM4SCxJQUFGLENBQU8sSUFBUCxDQUFuRTtFQUFnRixLQUEvUSxDQUF6Qjs7RUFBMFMsV0FBTy9KLENBQUMsQ0FBQ2dLLEdBQUYsR0FBTS9ILENBQU4sRUFBUWpDLENBQWY7RUFBaUIsR0FBOVU7RUFBK1U4SixFQUFBQSxhQUFhLEVBQUMsdUJBQVNwTSxDQUFULEVBQVdDLENBQVgsRUFBYTtFQUFDLFdBQU8sWUFBVTtFQUFDLFVBQUcsTUFBSUQsQ0FBQyxDQUFDdU0sVUFBVCxFQUFvQixJQUFHLFFBQU12TSxDQUFDLENBQUN3TSxNQUFYO0VBQWtCLFlBQUcsa0JBQWdCeE0sQ0FBQyxDQUFDa00sWUFBckIsRUFBa0M7RUFBQyxnQkFBSWxNLENBQUMsQ0FBQ3lNLFFBQUYsQ0FBV0MsVUFBZixHQUEwQnpNLENBQUMsQ0FBQyxJQUFJbUcsS0FBSixDQUFVLDJDQUFWLENBQUQsQ0FBM0IsR0FBb0ZuRyxDQUFDLENBQUMsSUFBRCxFQUFNO0VBQUMwTSxZQUFBQSxJQUFJLEVBQUMzTSxDQUFDLENBQUN5TSxRQUFSO0VBQWlCRyxZQUFBQSxZQUFZLEVBQUM1TSxDQUFDLENBQUM2TSxpQkFBRixDQUFvQixlQUFwQixDQUE5QjtFQUFtRUMsWUFBQUEsT0FBTyxFQUFDOU0sQ0FBQyxDQUFDNk0saUJBQUYsQ0FBb0IsU0FBcEIsQ0FBM0U7RUFBMEdFLFlBQUFBLFdBQVcsRUFBQy9NLENBQUMsQ0FBQzZNLGlCQUFGLENBQW9CLGNBQXBCO0VBQXRILFdBQU4sQ0FBckY7RUFBdVAsU0FBMVIsTUFBK1I1TSxDQUFDLENBQUMsSUFBRCxFQUFNRCxDQUFDLENBQUNnTixZQUFSLENBQUQ7RUFBalQsYUFBNFU7RUFBQyxZQUFHLE1BQUloTixDQUFDLENBQUN3TSxNQUFULEVBQWdCO0VBQU92TSxRQUFBQSxDQUFDLENBQUMsSUFBSW1HLEtBQUosQ0FBVXBHLENBQUMsQ0FBQ2lOLFVBQUYsR0FBYSxHQUFiLEdBQWlCak4sQ0FBQyxDQUFDd00sTUFBN0IsQ0FBRCxDQUFEO0VBQXdDO0VBQUMsS0FBbmI7RUFBb2IsR0FBL3hCO0VBQWd5QlosRUFBQUEsVUFBVSxFQUFDLHNCQUFVO0VBQUMsUUFBSTVMLENBQUo7O0VBQU0sUUFBRztFQUFDQSxNQUFBQSxDQUFDLEdBQUMsSUFBSWtOLGNBQUosRUFBRjtFQUFxQixLQUF6QixDQUF5QixPQUFNak4sQ0FBTixFQUFRO0VBQUMsVUFBRztFQUFDRCxRQUFBQSxDQUFDLEdBQUMsSUFBSW1OLGFBQUosQ0FBa0IsZ0JBQWxCLENBQUY7RUFBc0MsT0FBMUMsQ0FBMEMsT0FBTWxOLENBQU4sRUFBUTtFQUFDLFlBQUc7RUFBQ0QsVUFBQUEsQ0FBQyxHQUFDLElBQUltTixhQUFKLENBQWtCLG1CQUFsQixDQUFGO0VBQXlDLFNBQTdDLENBQTZDLE9BQU1uTixDQUFOLEVBQVE7RUFBRztFQUFDOztFQUFBLFdBQU9BLENBQVA7RUFBUyxHQUFuOUI7RUFBbzlCb04sRUFBQUEsY0FBYyxFQUFDLHdCQUFDcE4sQ0FBRCxFQUFHQyxDQUFIO0VBQUEsV0FBUUEsQ0FBQyxLQUFHQSxDQUFDLEdBQUMsRUFBTCxDQUFELEVBQVVBLENBQUMsQ0FBQ2lNLFlBQUYsR0FBZSxhQUF6QixFQUF1QzdNLENBQUMsQ0FBQ3NNLEdBQUYsQ0FBTTNMLENBQU4sRUFBUUMsQ0FBUixDQUEvQztFQUFBO0VBQW4rQixDQUFSOztFQUF1aUMsU0FBU25CLENBQVQsQ0FBV2tCLENBQVgsRUFBYTtFQUFDLFNBQU8sUUFBTUEsQ0FBYjtFQUFlOztFQUFBLFNBQVNtRSxDQUFULENBQVduRSxDQUFYLEVBQWE7RUFBQyxTQUFNLENBQUNsQixDQUFDLENBQUNrQixDQUFELENBQVI7RUFBWTs7RUFBQSxTQUFTZ0UsQ0FBVCxDQUFXaEUsQ0FBWCxFQUFhO0VBQUMsU0FBTSxZQUFVLE9BQU9BLENBQWpCLElBQW9CcU4sUUFBUSxDQUFDck4sQ0FBRCxDQUFsQztFQUFzQzs7RUFBQSxTQUFTc0YsQ0FBVCxDQUFXdEYsQ0FBWCxFQUFhO0VBQUMsT0FBSSxJQUFJQyxFQUFDLEdBQUMsQ0FBVixFQUFZQSxFQUFDLEdBQUNSLFNBQVMsQ0FBQ3BDLE1BQXhCLEVBQStCNEMsRUFBQyxFQUFoQyxFQUFtQztFQUFDLFFBQU1zRSxFQUFDLEdBQUM5RSxTQUFTLENBQUNRLEVBQUQsQ0FBakI7O0VBQXFCLFNBQUksSUFBTUEsR0FBVixJQUFlc0UsRUFBZjtFQUFpQnZFLE1BQUFBLENBQUMsQ0FBQ0MsR0FBRCxDQUFELEdBQUtzRSxFQUFDLENBQUN0RSxHQUFELENBQU47RUFBakI7RUFBMkI7O0VBQUEsU0FBT0QsQ0FBUDtFQUFTOztFQUFBWCxDQUFDLENBQUNpTyxPQUFGLEdBQVUsVUFBU3ROLENBQVQsRUFBV0MsQ0FBWCxFQUFhO0VBQUMsTUFBTXNFLENBQUMsR0FBQ2xGLENBQUMsQ0FBQ3NNLEdBQUYsQ0FBTTNMLENBQU4sRUFBUUMsQ0FBUixDQUFSO0VBQUEsTUFBbUJxQyxDQUFDLEdBQUNpQyxDQUFDLENBQUNxQixJQUFGLENBQU8sVUFBQTVGLENBQUM7RUFBQSxXQUFFQSxDQUFDLEdBQUNoQyxJQUFJLENBQUN1UCxLQUFMLENBQVd2TixDQUFYLENBQUQsR0FBZSxJQUFsQjtFQUFBLEdBQVIsQ0FBckI7RUFBcUQsU0FBT3NDLENBQUMsQ0FBQ2dLLEdBQUYsR0FBTS9ILENBQUMsQ0FBQytILEdBQVIsRUFBWWhLLENBQW5CO0VBQXFCLENBQWxHOztNQUF5RzRDO0VBQUUsYUFBWWxGLENBQVosRUFBY0MsQ0FBZCxFQUFnQjtFQUFDLFNBQUt1TixRQUFMLEdBQWN4TixDQUFkLEVBQWdCLEtBQUt5TixJQUFMLEdBQVV4TixDQUExQjtFQUE0Qjs7OztXQUFBeU4sVUFBQSxpQkFBUTFOLENBQVIsRUFBVUMsQ0FBVixFQUFZO0VBQUMsUUFBTXNFLENBQUMsR0FBQyxLQUFLa0osSUFBTCxDQUFVeE4sQ0FBVixDQUFSO0VBQXFCLFFBQUcsQ0FBQ3NFLENBQUosRUFBTTtFQUFPLFFBQUlqQyxDQUFDLEdBQUMsQ0FBTjs7RUFBUSxTQUFJLElBQU1yQyxHQUFWLElBQWVzRSxDQUFmO0VBQWlCdkUsTUFBQUEsQ0FBQyxDQUFDQyxHQUFELEVBQUdzRSxDQUFDLENBQUN0RSxHQUFELENBQUosRUFBUXFDLENBQUMsRUFBVCxDQUFEO0VBQWpCO0VBQStCOztXQUFBcUwsYUFBQSxvQkFBVzNOLENBQVgsRUFBYUMsQ0FBYixFQUFlO0VBQUMsUUFBTXNFLENBQUMsR0FBQyxFQUFSO0VBQVcsV0FBT0osQ0FBQyxDQUFDbkUsQ0FBQyxDQUFDNE4sSUFBSCxDQUFELEtBQVlySixDQUFDLENBQUNxSixJQUFGLEdBQU81TixDQUFDLENBQUM0TixJQUFyQixHQUEyQnpKLENBQUMsQ0FBQ25FLENBQUMsQ0FBQzZOLFFBQUgsQ0FBRCxLQUFnQnRKLENBQUMsQ0FBQ3NKLFFBQUYsR0FBVzdOLENBQUMsQ0FBQzZOLFFBQTdCLENBQTNCLEVBQWtFMUosQ0FBQyxDQUFDbkUsQ0FBQyxDQUFDOE4sU0FBSCxDQUFELEtBQWlCdkosQ0FBQyxDQUFDdUosU0FBRixHQUFZOU4sQ0FBQyxDQUFDOE4sU0FBL0IsQ0FBbEUsRUFBNEczSixDQUFDLENBQUNuRSxDQUFDLENBQUNrQixNQUFILENBQUQsS0FBY3FELENBQUMsQ0FBQ3JELE1BQUYsR0FBU2xCLENBQUMsQ0FBQ2tCLE1BQXpCLENBQTVHLEVBQTZJaUQsQ0FBQyxDQUFDbkUsQ0FBQyxDQUFDK04sUUFBSCxDQUFELEtBQWdCeEosQ0FBQyxDQUFDd0osUUFBRixHQUFXL04sQ0FBQyxDQUFDK04sUUFBN0IsQ0FBN0ksRUFBb0w1SixDQUFDLENBQUNuRSxDQUFDLENBQUNZLEtBQUgsQ0FBRCxLQUFhMkQsQ0FBQyxDQUFDM0QsS0FBRixHQUFRWixDQUFDLENBQUNZLEtBQXZCLENBQXBMLEVBQWtOdUQsQ0FBQyxDQUFDbkUsQ0FBQyxDQUFDVSxXQUFILENBQUQsS0FBbUI2RCxDQUFDLENBQUM3RCxXQUFGLEdBQWNWLENBQUMsQ0FBQ1UsV0FBbkMsQ0FBbE4sRUFBa1F5RCxDQUFDLENBQUNuRSxDQUFDLENBQUNnTyxNQUFILENBQUQsS0FBY3pKLENBQUMsQ0FBQ3lKLE1BQUYsR0FBU2hPLENBQUMsQ0FBQ2dPLE1BQXpCLENBQWxRLEVBQW1TN0osQ0FBQyxDQUFDbkUsQ0FBQyxDQUFDaU8sTUFBSCxDQUFELEtBQWMxSixDQUFDLENBQUMwSixNQUFGLEdBQVNqTyxDQUFDLENBQUNpTyxNQUFGLENBQVN6UCxHQUFULENBQWEsVUFBQXdCLENBQUM7RUFBQSxhQUFFQyxDQUFDLENBQUNELENBQUQsQ0FBSDtFQUFBLEtBQWQsQ0FBdkIsQ0FBblMsRUFBaVZ1RSxDQUF4VjtFQUEwVjs7V0FBQTJKLHNCQUFBLDZCQUFvQmxPLENBQXBCLEVBQXNCO0VBQUMsUUFBTUMsQ0FBQyxHQUFDLEtBQUt3TixJQUFMLENBQVVVLFNBQVYsQ0FBb0JuTyxDQUFwQixDQUFSO0VBQStCLFFBQUl1RSxDQUFKLEVBQU1qQyxDQUFOO0VBQVEsUUFBRyxLQUFLLENBQUwsTUFBVUEsQ0FBQyxHQUFDckMsQ0FBQyxDQUFDbU8saUJBQUYsSUFBcUJuTyxDQUFDLENBQUNtTyxpQkFBRixDQUFvQjFQLE1BQXpDLEdBQWdELENBQUM2RixDQUFDLEdBQUN0RSxDQUFDLENBQUNtTyxpQkFBTCxFQUF3QjFQLE1BQXhCLENBQStCMlAsT0FBL0UsR0FBdUYsQ0FBQzlKLENBQUMsR0FBQ3RFLENBQUgsRUFBTXZCLE1BQU4sQ0FBYTRQLEdBQWIsSUFBa0IvSixDQUFDLENBQUM3RixNQUFGLENBQVMyUCxPQUE5SCxLQUF3SSxLQUFLLENBQUwsS0FBUyxLQUFLWixJQUFMLENBQVVjLFFBQTlKLEVBQXVLLE9BQU8sSUFBUDtFQUFZLFFBQU1ySyxDQUFDLEdBQUMsS0FBS3VKLElBQUwsQ0FBVWMsUUFBVixDQUFtQmpNLENBQW5CLENBQVI7RUFBOEIsUUFBRyxDQUFDNEIsQ0FBSixFQUFNLE9BQU8sSUFBUDtFQUFZLFFBQU03RSxDQUFDLEdBQUMsS0FBS29PLElBQUwsQ0FBVWUsUUFBVixDQUFtQnRLLENBQUMsQ0FBQ3VLLE9BQXJCLENBQVI7RUFBc0MsV0FBTTtFQUFDQyxNQUFBQSxNQUFNLEVBQUN4SyxDQUFDLENBQUN3SyxNQUFGLElBQVUsSUFBbEI7RUFBdUJDLE1BQUFBLGNBQWMsRUFBQ3pLLENBQUMsQ0FBQ3lLLGNBQUYsSUFBa0IsSUFBeEQ7RUFBNkRDLE1BQUFBLElBQUksRUFBQzFLLENBQUMsQ0FBQzBLLElBQUYsSUFBUSxJQUExRTtFQUErRUgsTUFBQUEsT0FBTyxFQUFDcFAsQ0FBdkY7RUFBeUZ3UCxNQUFBQSxNQUFNLEVBQUMsS0FBS3BCLElBQUwsQ0FBVXFCLE1BQVYsQ0FBaUI1SyxDQUFDLENBQUMySyxNQUFuQjtFQUFoRyxLQUFOO0VBQWtJOztXQUFBRSxjQUFBLHVCQUFhO0VBQUMsV0FBTyxJQUFQO0VBQVk7O1dBQUFDLGdCQUFBLHlCQUFlO0VBQUMsV0FBTyxJQUFQO0VBQVk7Ozs7O0VBQUMsSUFBTS9LLENBQUMsR0FBQyxDQUFDLFFBQUQsRUFBVSxDQUFWLEVBQVksTUFBWixFQUFtQixDQUFuQixFQUFxQixNQUFyQixFQUE0QixDQUE1QixFQUE4QixNQUE5QixFQUFxQyxDQUFyQyxFQUF1QyxNQUF2QyxFQUE4QyxDQUE5QyxFQUFnRCxNQUFoRCxFQUF1RCxDQUF2RCxFQUF5RCxNQUF6RCxFQUFnRSxFQUFoRSxDQUFSOztNQUFrRkY7RUFBRSxhQUFZL0QsQ0FBWixFQUFjQyxDQUFkLEVBQWdCc0UsQ0FBaEIsRUFBa0I7RUFBQyxTQUFLaUosUUFBTCxHQUFjeE4sQ0FBZCxFQUFnQixLQUFLeU4sSUFBTCxHQUFVeE4sQ0FBMUIsRUFBNEIsS0FBS2dQLFNBQUwsR0FBZTFLLENBQTNDLEVBQTZDLEtBQUsySyxPQUFMLEdBQWEsRUFBMUQsRUFBNkQsS0FBS0MsUUFBTCxHQUFjLEVBQTNFO0VBQThFOzs7O1lBQUFDLGVBQUEsc0JBQWFwUCxDQUFiLEVBQWVDLENBQWYsRUFBaUI7RUFBQTs7RUFBQyxRQUFNc0UsQ0FBQyxHQUFDLEtBQUtrSixJQUFiO0VBQUEsUUFBa0JuTCxDQUFDLEdBQUNpQyxDQUFDLENBQUM4SyxTQUFGLENBQVlwUCxDQUFaLENBQXBCO0VBQUEsUUFBbUNuQixDQUFDLEdBQUN5RixDQUFDLENBQUMrSyxXQUFGLENBQWNoTixDQUFDLENBQUNpTixVQUFoQixDQUFyQztFQUFBLFFBQWlFcEwsQ0FBQyxHQUFDSSxDQUFDLENBQUMySyxPQUFGLENBQVVwUSxDQUFDLENBQUMwUSxNQUFaLENBQW5FOztFQUF1RixRQUFHLGtCQUFnQjFRLENBQUMsQ0FBQzBRLE1BQWxCLElBQTBCLHNCQUFvQjFRLENBQUMsQ0FBQzBRLE1BQWhELElBQXdEckwsQ0FBQyxDQUFDc0wsR0FBN0QsRUFBaUU7RUFBQyxVQUFNbEwsR0FBQyxHQUFDSixDQUFDLENBQUNzTCxHQUFWO0VBQUEsVUFBY25OLEVBQUMsR0FBQyxNQUFJNkIsQ0FBQyxDQUFDc0wsR0FBRixDQUFNblIsT0FBTixDQUFjLG1CQUFkLENBQUosR0FBdUM2RixDQUFDLENBQUNzTCxHQUF6QyxHQUE2QyxLQUFLakMsUUFBTCxHQUFjLEdBQWQsR0FBa0JqSixHQUEvRTs7RUFBaUYsYUFBTyxLQUFLNEssUUFBTCxDQUFjN00sRUFBZCxJQUFpQixLQUFLNk0sUUFBTCxDQUFjN00sRUFBZCxFQUFpQnNELElBQWpCLENBQXNCLFlBQUk7RUFBQSxrQ0FBMkIsS0FBSSxDQUFDOEosYUFBTCxDQUFtQnpQLENBQW5CLEVBQXFCLEtBQUksQ0FBQ2lQLE9BQUwsQ0FBYTVNLEVBQWIsQ0FBckIsQ0FBM0I7RUFBQSxZQUFhaUMsQ0FBYix1QkFBT29MLEtBQVA7RUFBQSxZQUF3QnpMLENBQXhCLHVCQUFlMEwsUUFBZjs7RUFBaUUsZUFBTTtFQUFDaEMsVUFBQUEsSUFBSSxFQUFDNU4sQ0FBTjtFQUFRNlAsVUFBQUEsWUFBWSxFQUFDNVAsQ0FBckI7RUFBdUIwUCxVQUFBQSxLQUFLLEVBQUNwTCxDQUE3QjtFQUErQnFMLFVBQUFBLFFBQVEsRUFBQzFMO0VBQXhDLFNBQU47RUFBaUQsT0FBNUksQ0FBakIsR0FBK0osS0FBS2lMLFFBQUwsQ0FBYzdNLEVBQWQsSUFBaUJqRCxDQUFDLENBQUMrTixjQUFGLENBQWlCOUssRUFBakIsRUFBbUIsSUFBbkIsRUFBeUJzRCxJQUF6QixDQUE4QixVQUFBckIsQ0FBQyxFQUFFO0VBQUMsWUFBTUwsQ0FBQyxHQUFDSyxDQUFDLENBQUNvSSxJQUFWO0VBQWUsUUFBQSxLQUFJLENBQUN1QyxPQUFMLENBQWE1TSxFQUFiLElBQWdCNEIsQ0FBaEI7O0VBQWhCLG1DQUE0RCxLQUFJLENBQUN3TCxhQUFMLENBQW1CelAsQ0FBbkIsRUFBcUJpRSxDQUFyQixDQUE1RDtFQUFBLFlBQThDN0UsQ0FBOUMsd0JBQXdDc1EsS0FBeEM7RUFBQSxZQUF5RDdRLENBQXpELHdCQUFnRDhRLFFBQWhEOztFQUFvRixlQUFNO0VBQUNoQyxVQUFBQSxJQUFJLEVBQUM1TixDQUFOO0VBQVE2UCxVQUFBQSxZQUFZLEVBQUM1UCxDQUFyQjtFQUF1QjBQLFVBQUFBLEtBQUssRUFBQ3RRLENBQTdCO0VBQStCdVEsVUFBQUEsUUFBUSxFQUFDOVE7RUFBeEMsU0FBTjtFQUFpRCxPQUF0SyxDQUF2TDtFQUErVjs7RUFBQTtFQUFBLGlDQUEyQixLQUFLNFEsYUFBTCxDQUFtQnpQLENBQW5CLEVBQXFCLEtBQUtnUCxTQUFMLENBQWVPLE1BQXBDLEVBQTJDLEtBQUtQLFNBQUwsQ0FBZWEsVUFBMUQsQ0FBM0I7RUFBQSxVQUFhdkwsR0FBYix3QkFBT29MLEtBQVA7RUFBQSxVQUF3QnJOLEdBQXhCLHdCQUFlc04sUUFBZjs7RUFBaUcsYUFBTzFMLENBQUMsQ0FBQ2tCLE9BQUYsQ0FBVTtFQUFDd0ksUUFBQUEsSUFBSSxFQUFDNU4sQ0FBTjtFQUFRNlAsUUFBQUEsWUFBWSxFQUFDNVAsQ0FBckI7RUFBdUIwUCxRQUFBQSxLQUFLLEVBQUNwTCxHQUE3QjtFQUErQnFMLFFBQUFBLFFBQVEsRUFBQ3ROO0VBQXhDLE9BQVYsQ0FBUDtFQUE2RDtFQUFDOztZQUFBb04sZ0JBQUEsdUJBQWMxUCxDQUFkLEVBQWdCQyxDQUFoQixFQUFrQnNFLENBQWxCLEVBQXNCO0VBQUEsUUFBSkEsQ0FBSTtFQUFKQSxNQUFBQSxDQUFJLEdBQUYsQ0FBRTtFQUFBOztFQUFDLFFBQU1qQyxDQUFDLEdBQUMsS0FBS21MLElBQWI7RUFBQSxRQUFrQnZKLENBQUMsR0FBQzVCLENBQUMsQ0FBQytNLFNBQUYsQ0FBWXJQLENBQVosQ0FBcEI7RUFBbUMsUUFBSVgsQ0FBQyxHQUFDLENBQUNpRCxDQUFDLENBQUNnTixXQUFGLENBQWNwTCxDQUFDLENBQUNxTCxVQUFoQixFQUE0Qk8sVUFBNUIsSUFBd0MsQ0FBekMsS0FBNkM1TCxDQUFDLENBQUM0TCxVQUFGLElBQWMsQ0FBM0QsSUFBOER2TCxDQUFwRTs7RUFBc0UsUUFBTXpGLENBQUMsR0FBQyxLQUFLaVIsZ0JBQUwsQ0FBc0I3TCxDQUFDLENBQUMwSyxJQUF4QixDQUFSO0VBQUEsUUFBc0N6SyxDQUFDLEdBQUMsS0FBSzZMLGFBQUwsQ0FBbUI5TCxDQUFDLENBQUMrTCxhQUFyQixDQUF4QztFQUFBLFFBQTRFak0sQ0FBQyxHQUFDRSxDQUFDLENBQUNnTSxVQUFoRjs7RUFBMkYsV0FBT2xNLENBQUMsSUFBRUEsQ0FBQyxLQUFHbEYsQ0FBQyxHQUFDcUYsQ0FBQyxDQUFDZ00saUJBQVgsSUFBOEIvTCxPQUFPLENBQUMyQixJQUFSLENBQWEsMENBQWIsR0FBeUQsSUFBSTVCLENBQUosQ0FBTSxFQUFOLENBQXZGLEtBQW1HOUUsQ0FBQyxHQUFDOEUsQ0FBQyxDQUFDZ00saUJBQUosSUFBdUIsQ0FBdkIsS0FBMkJsUSxDQUFDLEdBQUNBLENBQUMsQ0FBQ3hDLEtBQUYsQ0FBUTRCLENBQVIsRUFBVUEsQ0FBQyxHQUFDNkUsQ0FBQyxDQUFDbUYsS0FBRixHQUFRdkssQ0FBUixHQUFVcUYsQ0FBQyxDQUFDZ00saUJBQXhCLENBQUYsRUFBNkM5USxDQUFDLEdBQUMsQ0FBMUUsR0FBNkU7RUFBQ3NRLE1BQUFBLEtBQUssRUFBQyxJQUFJeEwsQ0FBSixDQUFNbEUsQ0FBTixFQUFRWixDQUFSLEVBQVU2RSxDQUFDLENBQUNtRixLQUFGLEdBQVF2SyxDQUFsQixDQUFQO0VBQTRCOFEsTUFBQUEsUUFBUSxFQUFDOVE7RUFBckMsS0FBaEwsQ0FBUDtFQUFnTzs7WUFBQWtSLGdCQUFBLHVCQUFjaFEsQ0FBZCxFQUFnQjtFQUFDLFlBQU9BLENBQVA7RUFBVSxXQUFLLElBQUw7RUFBVSxlQUFPb1EsU0FBUDs7RUFBaUIsV0FBSyxJQUFMO0VBQVUsZUFBT0MsVUFBUDs7RUFBa0IsV0FBSyxJQUFMO0VBQVUsZUFBT0MsVUFBUDs7RUFBa0IsV0FBSyxJQUFMO0VBQVUsZUFBT0MsV0FBUDs7RUFBbUIsV0FBSyxJQUFMO0VBQVUsZUFBT0MsVUFBUDs7RUFBa0IsV0FBSyxJQUFMO0VBQVUsZUFBT0MsV0FBUDs7RUFBbUIsV0FBSyxJQUFMO0VBQVUsZUFBT2xPLFlBQVA7RUFBN0w7O0VBQWlOLFVBQU0sSUFBSTZELEtBQUosQ0FBVSw4Q0FBNENwRyxDQUF0RCxDQUFOO0VBQStEOztZQUFBK1AsbUJBQUEsMEJBQWlCL1AsQ0FBakIsRUFBbUI7RUFBQyxRQUFNQyxDQUFDLEdBQUNnRSxDQUFDLENBQUMzRixPQUFGLENBQVUwQixDQUFWLENBQVI7RUFBcUIsV0FBT2lFLENBQUMsQ0FBQ2hFLENBQUMsR0FBQyxDQUFILENBQVI7RUFBYzs7Ozs7TUFBT3lRO0VBQUUsYUFBWTFRLENBQVosRUFBY0MsQ0FBZCxFQUFnQnNFLENBQWhCLEVBQWtCakMsQ0FBbEIsRUFBb0I7RUFBQyxTQUFLa0wsUUFBTCxHQUFjeE4sQ0FBZCxFQUFnQixLQUFLeU4sSUFBTCxHQUFVeE4sQ0FBMUIsRUFBNEIsS0FBS2dQLFNBQUwsR0FBZTFLLENBQTNDLEVBQTZDLEtBQUsySyxPQUFMLEdBQWEsRUFBMUQsRUFBNkQsS0FBS0MsUUFBTCxHQUFjLEVBQTNFLEVBQThFLEtBQUt3QixhQUFMLEdBQW1Cck8sQ0FBakcsRUFBbUcsS0FBS3NPLFFBQUwsR0FBYyxJQUFJN00sQ0FBSixDQUFNL0QsQ0FBTixFQUFRQyxDQUFSLEVBQVVzRSxDQUFWLENBQWpIO0VBQThIOzs7O1lBQUFtSixVQUFBLGlCQUFRMU4sQ0FBUixFQUFVQyxDQUFWLEVBQVk7RUFBQyxRQUFNc0UsQ0FBQyxHQUFDLEtBQUtrSixJQUFMLENBQVV4TixDQUFWLENBQVI7RUFBcUIsUUFBR3NFLENBQUgsRUFBSyxLQUFJLElBQUl0RSxHQUFDLEdBQUMsQ0FBVixFQUFZQSxHQUFDLEdBQUNzRSxDQUFDLENBQUNsSCxNQUFoQixFQUF1QjRDLEdBQUMsRUFBeEI7RUFBMkJELE1BQUFBLENBQUMsQ0FBQ0MsR0FBRCxFQUFHc0UsQ0FBQyxDQUFDdEUsR0FBRCxDQUFKLEVBQVFBLEdBQVIsQ0FBRDtFQUEzQjtFQUF1Qzs7WUFBQTBOLGFBQUEsb0JBQVczTixDQUFYLEVBQWFDLENBQWIsRUFBZXNFLENBQWYsRUFBaUI7RUFBQyxRQUFNakMsQ0FBQyxHQUFDLEVBQVI7RUFBVyxXQUFPZ0QsQ0FBQyxDQUFDaEQsQ0FBRCxFQUFHdEMsQ0FBSCxDQUFELEVBQU9tRSxDQUFDLENBQUNuRSxDQUFDLENBQUM2USxJQUFILENBQUQsS0FBWXZPLENBQUMsQ0FBQzJMLE1BQUYsR0FBUyxDQUFDaE8sQ0FBQyxDQUFDRCxDQUFDLENBQUM2USxJQUFILENBQUYsQ0FBckIsQ0FBUCxFQUF5QzFNLENBQUMsQ0FBQ25FLENBQUMsQ0FBQzhRLElBQUgsQ0FBRCxLQUFZeE8sQ0FBQyxDQUFDd08sSUFBRixHQUFPdk0sQ0FBQyxDQUFDdkUsQ0FBQyxDQUFDOFEsSUFBSCxDQUFSLEVBQWlCeE8sQ0FBQyxDQUFDeU8sU0FBRixHQUFZL1EsQ0FBQyxDQUFDOFEsSUFBM0MsQ0FBekMsRUFBMEZ4TyxDQUFqRztFQUFtRzs7WUFBQXlNLGNBQUEscUJBQVkvTyxDQUFaLEVBQWM7RUFBQyxRQUFNQyxDQUFDLEdBQUMsS0FBS3dOLElBQUwsQ0FBVVUsU0FBVixDQUFvQm5PLENBQXBCLENBQVI7RUFBQSxRQUErQnVFLENBQUMsR0FBQ3RFLENBQUMsQ0FBQytRLG9CQUFuQztFQUFBLFFBQXdEMU8sQ0FBQyxHQUFDckMsQ0FBQyxDQUFDZ1IsYUFBNUQ7RUFBQSxRQUEwRTVSLENBQUMsR0FBQ1ksQ0FBQyxDQUFDaVIsZ0JBQTlFO0VBQUEsUUFBK0ZwUyxDQUFDLEdBQUNtQixDQUFDLENBQUNrUixlQUFuRztFQUFBLFFBQW1IaE4sQ0FBQyxHQUFDLEVBQXJIO0VBQXdILFdBQU9JLENBQUMsSUFBRUosQ0FBQyxDQUFDN0UsSUFBRixDQUFPLEtBQUs4Uix3QkFBTCxDQUE4QjdNLENBQTlCLENBQVAsQ0FBSCxFQUE0Q2pDLENBQUMsSUFBRTZCLENBQUMsQ0FBQzdFLElBQUYsQ0FBTyxLQUFLK1IsZUFBTCxDQUFxQi9PLENBQXJCLEVBQXVCLGVBQXZCLENBQVAsQ0FBL0MsRUFBK0ZqRCxDQUFDLElBQUU4RSxDQUFDLENBQUM3RSxJQUFGLENBQU8sS0FBSytSLGVBQUwsQ0FBcUJoUyxDQUFyQixFQUF1QixrQkFBdkIsQ0FBUCxDQUFsRyxFQUFxSlAsQ0FBQyxJQUFFcUYsQ0FBQyxDQUFDN0UsSUFBRixDQUFPLEtBQUsrUixlQUFMLENBQXFCdlMsQ0FBckIsRUFBdUIsaUJBQXZCLENBQVAsQ0FBeEosRUFBME1vRixDQUFDLENBQUNtQyxHQUFGLENBQU1sQyxDQUFOLEVBQVN5QixJQUFULENBQWMsVUFBQTVGLENBQUMsRUFBRTtFQUFDLFVBQU11RSxDQUFDLEdBQUMsRUFBUjtFQUFXZSxNQUFBQSxDQUFDLENBQUNmLENBQUQsRUFBR3RFLENBQUgsQ0FBRDs7RUFBTyxXQUFJLElBQUlBLEdBQUMsR0FBQyxDQUFWLEVBQVlBLEdBQUMsR0FBQ0QsQ0FBQyxDQUFDM0MsTUFBaEIsRUFBdUI0QyxHQUFDLEVBQXhCO0VBQTJCc0UsUUFBQUEsQ0FBQyxDQUFDdkUsQ0FBQyxDQUFDQyxHQUFELENBQUQsQ0FBSzJOLElBQU4sQ0FBRCxHQUFhNU4sQ0FBQyxDQUFDQyxHQUFELENBQWQ7RUFBM0I7O0VBQTZDLGFBQU07RUFBQ3FSLFFBQUFBLFFBQVEsRUFBQy9NO0VBQVYsT0FBTjtFQUFtQixLQUFwRyxDQUFqTjtFQUF1VDs7WUFBQTZNLDJCQUFBLGtDQUF5QnBSLENBQXpCLEVBQTJCO0VBQUMsUUFBTUMsQ0FBQyxHQUFDRCxDQUFDLENBQUN1UixnQkFBVjtFQUFBLFFBQTJCaE4sQ0FBQyxHQUFDdkUsQ0FBQyxDQUFDd1Isd0JBQS9CO0VBQXdEeFIsSUFBQUEsQ0FBQyxDQUFDNE4sSUFBRixHQUFPLHNCQUFQO0VBQThCLFFBQU10TCxDQUFDLEdBQUMsRUFBUjtFQUFXLFdBQU9yQyxDQUFDLElBQUVxQyxDQUFDLENBQUNoRCxJQUFGLENBQU8sS0FBSytSLGVBQUwsQ0FBcUJwUixDQUFyQixFQUF1QixrQkFBdkIsQ0FBUCxDQUFILEVBQXNEc0UsQ0FBQyxJQUFFakMsQ0FBQyxDQUFDaEQsSUFBRixDQUFPLEtBQUsrUixlQUFMLENBQXFCOU0sQ0FBckIsRUFBdUIsMEJBQXZCLENBQVAsQ0FBekQsRUFBb0hMLENBQUMsQ0FBQ21DLEdBQUYsQ0FBTS9ELENBQU4sRUFBU3NELElBQVQsQ0FBYyxVQUFBM0YsQ0FBQyxFQUFFO0VBQUMsVUFBTXNFLENBQUMsR0FBQyxFQUFSO0VBQVdlLE1BQUFBLENBQUMsQ0FBQ2YsQ0FBRCxFQUFHdkUsQ0FBSCxDQUFEOztFQUFPLFdBQUksSUFBSUEsR0FBQyxHQUFDLENBQVYsRUFBWUEsR0FBQyxHQUFDQyxDQUFDLENBQUM1QyxNQUFoQixFQUF1QjJDLEdBQUMsRUFBeEI7RUFBMkIsZUFBT0MsQ0FBQyxDQUFDRCxHQUFELENBQUQsQ0FBS3lSLEtBQVosRUFBa0JsTixDQUFDLENBQUN0RSxDQUFDLENBQUNELEdBQUQsQ0FBRCxDQUFLNE4sSUFBTixDQUFELEdBQWEzTixDQUFDLENBQUNELEdBQUQsQ0FBaEM7RUFBM0I7O0VBQStELGFBQU91RSxDQUFQO0VBQVMsS0FBNUcsQ0FBM0g7RUFBeU87O1lBQUE4TSxrQkFBQSx5QkFBZ0JyUixDQUFoQixFQUFrQkMsQ0FBbEIsRUFBb0I7RUFBQyxRQUFNc0UsQ0FBQyxHQUFDdkUsQ0FBQyxDQUFDeVIsS0FBVjtFQUFnQixXQUFPdE4sQ0FBQyxDQUFDSSxDQUFELENBQUQsSUFBTXZFLENBQUMsQ0FBQzROLElBQUYsR0FBTzNOLENBQVAsRUFBUyxLQUFLeVIsV0FBTCxDQUFpQm5OLENBQWpCLEVBQW9CcUIsSUFBcEIsQ0FBeUIsVUFBQTNGLENBQUMsRUFBRTtFQUFDLFVBQU1zRSxDQUFDLEdBQUM7RUFBQ29OLFFBQUFBLE9BQU8sRUFBQzFSO0VBQVQsT0FBUjtFQUFvQixhQUFPcUYsQ0FBQyxDQUFDZixDQUFELEVBQUd2RSxDQUFILENBQUQsRUFBTyxPQUFPdUUsQ0FBQyxDQUFDa04sS0FBaEIsRUFBc0JsTixDQUE3QjtFQUErQixLQUFoRixDQUFmLElBQWtHLElBQXpHO0VBQThHOztZQUFBbU4sY0FBQSxxQkFBWTFSLENBQVosRUFBYztFQUFBOztFQUFDLFFBQU1DLENBQUMsR0FBQyxLQUFLd04sSUFBTCxDQUFVYyxRQUFWLENBQW1Cdk8sQ0FBbkIsQ0FBUjtFQUE4QixRQUFHLENBQUNDLENBQUosRUFBTSxPQUFPLElBQVA7RUFBWSxRQUFNc0UsQ0FBQyxHQUFDLEtBQUtrSixJQUFMLENBQVVxQixNQUFWLENBQWlCN08sQ0FBQyxDQUFDNE8sTUFBbkIsQ0FBUjtFQUFtQyxXQUFPLEtBQUsrQyxVQUFMLENBQWdCck4sQ0FBaEIsRUFBbUJxQixJQUFuQixDQUF3QixVQUFBNUYsQ0FBQyxFQUFFO0VBQUMsVUFBTXNDLENBQUMsR0FBQztFQUFDdVAsUUFBQUEsS0FBSyxFQUFDO0VBQUNsQyxVQUFBQSxLQUFLLEVBQUMzUCxDQUFDLENBQUMyTSxJQUFUO0VBQWNtRixVQUFBQSxLQUFLLEVBQUM5UixDQUFDLENBQUM4UixLQUF0QjtFQUE0QkMsVUFBQUEsTUFBTSxFQUFDL1IsQ0FBQyxDQUFDK1IsTUFBckM7RUFBNENOLFVBQUFBLEtBQUssRUFBQ3hSLENBQUMsQ0FBQzRPLE1BQXBEO0VBQTJEbUQsVUFBQUEsUUFBUSxFQUFDek4sQ0FBQyxDQUFDeU4sUUFBdEU7RUFBK0VwRSxVQUFBQSxJQUFJLEVBQUNySixDQUFDLENBQUNxSixJQUF0RjtFQUEyRnFFLFVBQUFBLFVBQVUsRUFBQzFOLENBQUMsQ0FBQzBOLFVBQXhHO0VBQW1IakUsVUFBQUEsTUFBTSxFQUFDekosQ0FBQyxDQUFDeUo7RUFBNUg7RUFBUCxPQUFSO0VBQW9KMUksTUFBQUEsQ0FBQyxDQUFDaEQsQ0FBRCxFQUFHckMsQ0FBSCxDQUFELEVBQU8sT0FBT3FDLENBQUMsQ0FBQ21NLE9BQWhCO0VBQXdCLFVBQU12SyxDQUFDLEdBQUNDLENBQUMsQ0FBQ2xFLENBQUMsQ0FBQ3dPLE9BQUgsQ0FBRCxHQUFhLE1BQUksQ0FBQ2hCLElBQUwsQ0FBVWUsUUFBVixDQUFtQnZPLENBQUMsQ0FBQ3dPLE9BQXJCLENBQWIsR0FBMkMsS0FBSyxDQUF4RDtFQUEwRCxhQUFPdkssQ0FBQyxLQUFHNUIsQ0FBQyxDQUFDbU0sT0FBRixHQUFVdkssQ0FBYixDQUFELEVBQWlCNUIsQ0FBeEI7RUFBMEIsS0FBNVIsQ0FBUDtFQUFxUzs7WUFBQXNQLGFBQUEsb0JBQVc1UixDQUFYLEVBQWE7RUFBQyxRQUFHLENBQUNtRSxDQUFDLENBQUNuRSxDQUFDLENBQUN1UCxVQUFILENBQUwsRUFBb0I7RUFBQyxVQUFNdFAsR0FBQyxHQUFDRCxDQUFDLENBQUN5UCxHQUFWO0VBQUEsVUFBY2xMLEdBQUMsR0FBQyxNQUFJdEUsR0FBQyxDQUFDM0IsT0FBRixDQUFVLGFBQVYsQ0FBSixHQUE2QjJCLEdBQTdCLEdBQStCLEtBQUt1TixRQUFMLEdBQWMsR0FBZCxHQUFrQnZOLEdBQWpFOztFQUFtRSxhQUFPLEtBQUtpUyxlQUFMLENBQXFCM04sR0FBckIsQ0FBUDtFQUErQjs7RUFBQTtFQUFDLFVBQU10RSxHQUFDLEdBQUMsS0FBS3dOLElBQUwsQ0FBVTZCLFdBQVYsQ0FBc0J0UCxDQUFDLENBQUN1UCxVQUF4QixDQUFSO0VBQTRDLFVBQUcsS0FBS0wsT0FBTCxDQUFhbFAsQ0FBQyxDQUFDdVAsVUFBZixDQUFILEVBQThCLE9BQU9yTCxDQUFDLENBQUNrQixPQUFGLENBQVUsS0FBSzhKLE9BQUwsQ0FBYWxQLENBQUMsQ0FBQ3VQLFVBQWYsQ0FBVixDQUFQO0VBQTZDLFVBQU1oTCxHQUFDLEdBQUMsS0FBS2tKLElBQUwsQ0FBVXlCLE9BQVYsQ0FBa0JqUCxHQUFDLENBQUN1UCxNQUFwQixDQUFSO0VBQW9DLFVBQUdqTCxHQUFDLENBQUNrTCxHQUFMLEVBQVMsT0FBTyxLQUFLMEMsdUJBQUwsQ0FBNkI1TixHQUFDLENBQUNrTCxHQUEvQixFQUFtQ3hQLEdBQW5DLEVBQXFDRCxDQUFyQyxDQUFQO0VBQStDLFVBQUcsS0FBS2lQLFNBQVIsRUFBa0IsT0FBTyxLQUFLbUQscUJBQUwsQ0FBMkJuUyxHQUEzQixFQUE2QkQsQ0FBN0IsQ0FBUDtFQUF1QztFQUFBLFdBQU8sSUFBUDtFQUFZOztZQUFBa1Msa0JBQUEseUJBQWdCbFMsQ0FBaEIsRUFBa0I7RUFBQTs7RUFBQyxRQUFHLEtBQUttUCxRQUFMLENBQWNuUCxDQUFkLENBQUgsRUFBb0IsT0FBTyxLQUFLbVAsUUFBTCxDQUFjblAsQ0FBZCxFQUFpQjRGLElBQWpCLENBQXNCO0VBQUEsYUFBSSxNQUFJLENBQUNzSixPQUFMLENBQWFsUCxDQUFiLENBQUo7RUFBQSxLQUF0QixDQUFQO0VBQWtELFdBQU8sS0FBS21QLFFBQUwsQ0FBY25QLENBQWQsSUFBaUIsS0FBS3FTLGFBQUwsQ0FBbUJyUyxDQUFuQixFQUFxQkEsQ0FBckIsQ0FBeEI7RUFBZ0Q7O1lBQUFtUywwQkFBQSxpQ0FBd0JuUyxDQUF4QixFQUEwQkMsQ0FBMUIsRUFBNEJzRSxDQUE1QixFQUE4QjtFQUFBOztFQUFDLFFBQU1qQyxDQUFDLEdBQUNpQyxDQUFDLENBQUNnTCxVQUFWO0VBQXFCLFdBQU8sS0FBS0osUUFBTCxDQUFjblAsQ0FBZCxJQUFpQixLQUFLbVAsUUFBTCxDQUFjblAsQ0FBZCxFQUFpQjRGLElBQWpCLENBQXNCO0VBQUEsYUFBSSxNQUFJLENBQUNzSixPQUFMLENBQWE1TSxDQUFiLENBQUo7RUFBQSxLQUF0QixDQUFqQixHQUE0RGpELENBQUMsQ0FBQytOLGNBQUYsQ0FBaUJwTixDQUFqQixFQUFtQixJQUFuQixFQUF5QjRGLElBQXpCLENBQThCLFVBQUE1RixDQUFDLEVBQUU7RUFBQyxVQUFNa0UsQ0FBQyxHQUFDbEUsQ0FBQyxDQUFDMk0sSUFBVjtFQUFBLFVBQWV0TixDQUFDLEdBQUMsTUFBSSxDQUFDaVQsZUFBTCxDQUFxQnJTLENBQXJCLEVBQXVCaUUsQ0FBdkIsQ0FBakI7RUFBQSxVQUEyQ3BGLENBQUMsR0FBQyxJQUFJeVQsSUFBSixDQUFTLENBQUNsVCxDQUFELENBQVQsRUFBYTtFQUFDdVAsUUFBQUEsSUFBSSxFQUFDckssQ0FBQyxDQUFDeU47RUFBUixPQUFiLENBQTdDO0VBQUEsVUFBNkU3TixDQUFDLEdBQUNxTyxHQUFHLENBQUNDLGVBQUosQ0FBb0IzVCxDQUFwQixDQUEvRTs7RUFBc0csYUFBTyxNQUFJLENBQUN1VCxhQUFMLENBQW1CL1AsQ0FBbkIsRUFBcUI2QixDQUFyQixDQUFQO0VBQStCLEtBQXZLLENBQW5FO0VBQTRPOztZQUFBaU8sd0JBQUEsK0JBQXNCcFMsQ0FBdEIsRUFBd0JDLENBQXhCLEVBQTBCO0VBQUMsUUFBTXNFLENBQUMsR0FBQyxLQUFLK04sZUFBTCxDQUFxQnRTLENBQXJCLEVBQXVCLEtBQUtpUCxTQUFMLENBQWVPLE1BQXRDLEVBQTZDLEtBQUtQLFNBQUwsQ0FBZWEsVUFBNUQsQ0FBUjtFQUFBLFFBQWdGeE4sQ0FBQyxHQUFDLElBQUlpUSxJQUFKLENBQVMsQ0FBQ2hPLENBQUQsQ0FBVCxFQUFhO0VBQUNxSyxNQUFBQSxJQUFJLEVBQUMzTyxDQUFDLENBQUMrUjtFQUFSLEtBQWIsQ0FBbEY7RUFBQSxRQUFrSDlOLENBQUMsR0FBQ3NPLEdBQUcsQ0FBQ0MsZUFBSixDQUFvQm5RLENBQXBCLENBQXBIOztFQUEySSxXQUFPLEtBQUsrUCxhQUFMLENBQW1CcFMsQ0FBQyxDQUFDc1AsVUFBckIsRUFBZ0NyTCxDQUFoQyxDQUFQO0VBQTBDOztZQUFBbU8sZ0JBQUEsdUJBQWNyUyxDQUFkLEVBQWdCQyxDQUFoQixFQUFrQjtFQUFBOztFQUFDLFdBQU8sSUFBSWlFLENBQUosQ0FBTSxVQUFDSyxDQUFELEVBQUdqQyxDQUFILEVBQU87RUFBQyxNQUFBLE1BQUksQ0FBQ3FPLGFBQUwsQ0FBbUIxUSxDQUFuQixFQUFxQixVQUFDQSxDQUFELEVBQUdpRSxDQUFILEVBQU87RUFBQ2pFLFFBQUFBLENBQUMsR0FBQ3FDLENBQUMsQ0FBQ3JDLENBQUQsQ0FBRixJQUFPLE1BQUksQ0FBQ2lQLE9BQUwsQ0FBYWxQLENBQWIsSUFBZ0JrRSxDQUFoQixFQUFrQkssQ0FBQyxDQUFDLE1BQUksQ0FBQzJLLE9BQUwsQ0FBYWxQLENBQWIsQ0FBRCxDQUExQixDQUFEO0VBQThDLE9BQTNFO0VBQTZFLEtBQTNGLENBQVA7RUFBb0c7O1lBQUFzUyxrQkFBQSx5QkFBZ0J0UyxDQUFoQixFQUFrQkMsQ0FBbEIsRUFBb0JzRSxDQUFwQixFQUFzQjtFQUFDQSxJQUFBQSxDQUFDLEdBQUNBLENBQUMsSUFBRSxDQUFMO0VBQU8sUUFBTWpDLENBQUMsR0FBQ3RDLENBQUMsQ0FBQzhQLFVBQUYsR0FBYXZMLENBQXJCO0VBQUEsUUFBdUJMLENBQUMsR0FBQ2xFLENBQUMsQ0FBQzBNLFVBQTNCO0VBQXNDLFdBQU96TSxDQUFDLENBQUN4QyxLQUFGLENBQVE2RSxDQUFSLEVBQVVBLENBQUMsR0FBQzRCLENBQVosQ0FBUDtFQUFzQjs7WUFBQXdPLGdDQUFBLHVDQUE4QjFTLENBQTlCLEVBQWdDQyxDQUFoQyxFQUFrQztFQUFDLFFBQU1zRSxDQUFDLEdBQUMsSUFBSXJGLEtBQUosQ0FBVWMsQ0FBQyxDQUFDME0sVUFBWixDQUFSOztFQUFnQyxTQUFJLElBQUl6TSxHQUFDLEdBQUMsQ0FBVixFQUFZQSxHQUFDLEdBQUNELENBQUMsQ0FBQzBNLFVBQWhCLEVBQTJCek0sR0FBQyxFQUE1QjtFQUErQnNFLE1BQUFBLENBQUMsQ0FBQ3RFLEdBQUQsQ0FBRCxHQUFLMFMsTUFBTSxDQUFDQyxZQUFQLENBQW9CNVMsQ0FBQyxDQUFDQyxHQUFELENBQXJCLENBQUw7RUFBL0I7O0VBQThELFdBQU9zRSxDQUFDLENBQUM5RixJQUFGLENBQU8sRUFBUCxHQUFXLFdBQVN3QixDQUFDLEdBQUNBLENBQUMsSUFBRSxXQUFkLElBQTJCLFVBQTNCLEdBQXNDNFMsTUFBTSxDQUFDQyxJQUFQLENBQVlDLFFBQVEsQ0FBQ0Msa0JBQWtCLENBQUN6TyxDQUFELENBQW5CLENBQXBCLENBQXhEO0VBQXFHOztZQUFBeUssZ0JBQUEsdUJBQWNoUCxDQUFkLEVBQWdCO0VBQUE7O0VBQUMsUUFBTUMsQ0FBQyxHQUFDLEVBQVI7RUFBVyxXQUFPRCxDQUFDLENBQUNpSixPQUFGLENBQVUsVUFBQWpKLENBQUMsRUFBRTtFQUFDQyxNQUFBQSxDQUFDLENBQUNYLElBQUYsQ0FBTyxNQUFJLENBQUMyVCxXQUFMLENBQWlCalQsQ0FBQyxDQUFDd08sUUFBbkIsQ0FBUDtFQUFxQyxLQUFuRCxHQUFxRHRLLENBQUMsQ0FBQ21DLEdBQUYsQ0FBTXBHLENBQU4sRUFBUzJGLElBQVQsQ0FBYyxVQUFBM0YsQ0FBQyxFQUFFO0VBQUMsV0FBSSxJQUFJc0UsR0FBQyxHQUFDLENBQVYsRUFBWUEsR0FBQyxHQUFDdEUsQ0FBQyxDQUFDNUMsTUFBaEIsRUFBdUJrSCxHQUFDLEVBQXhCO0VBQTJCdkUsUUFBQUEsQ0FBQyxDQUFDdUUsR0FBRCxDQUFELENBQUtpSyxRQUFMLEdBQWN2TyxDQUFDLENBQUNzRSxHQUFELENBQWY7RUFBM0I7O0VBQThDLGFBQU92RSxDQUFQO0VBQVMsS0FBekUsQ0FBNUQ7RUFBdUk7O1lBQUFpVCxjQUFBLHFCQUFZalQsQ0FBWixFQUFjO0VBQUMsUUFBTUMsQ0FBQyxHQUFDLEVBQVI7O0VBQVcsU0FBSSxJQUFJc0UsR0FBQyxHQUFDLENBQVYsRUFBWUEsR0FBQyxHQUFDdkUsQ0FBQyxDQUFDM0MsTUFBaEIsRUFBdUJrSCxHQUFDLEVBQXhCO0VBQTJCLE9BQUNKLENBQUMsQ0FBQ25FLENBQUMsQ0FBQ3VFLEdBQUQsQ0FBRCxDQUFLMk8sS0FBTixDQUFELElBQWUvTyxDQUFDLENBQUNuRSxDQUFDLENBQUN1RSxHQUFELENBQUQsQ0FBSzRPLE1BQU4sQ0FBakIsTUFBa0NsVCxDQUFDLENBQUNYLElBQUYsQ0FBTyxLQUFLc1IsUUFBTCxDQUFjeEIsWUFBZCxDQUEyQixPQUEzQixFQUFtQ3BQLENBQUMsQ0FBQ3VFLEdBQUQsQ0FBRCxDQUFLMk8sS0FBeEMsQ0FBUCxHQUF1RGpULENBQUMsQ0FBQ1gsSUFBRixDQUFPLEtBQUtzUixRQUFMLENBQWN4QixZQUFkLENBQTJCLFFBQTNCLEVBQW9DcFAsQ0FBQyxDQUFDdUUsR0FBRCxDQUFELENBQUs0TyxNQUF6QyxDQUFQLENBQXpGO0VBQTNCOztFQUE4SyxXQUFPalAsQ0FBQyxDQUFDbUMsR0FBRixDQUFNcEcsQ0FBTixFQUFTMkYsSUFBVCxDQUFjLFVBQUEzRixDQUFDLEVBQUU7RUFBQyxXQUFJLElBQUlzRSxHQUFDLEdBQUMsQ0FBVixFQUFZQSxHQUFDLEdBQUN0RSxDQUFDLENBQUM1QyxNQUFGLEdBQVMsQ0FBdkIsRUFBeUJrSCxHQUFDLEVBQTFCO0VBQTZCdkUsUUFBQUEsQ0FBQyxDQUFDdUUsR0FBRCxDQUFELENBQUsyTyxLQUFMLEdBQVdqVCxDQUFDLENBQUMsSUFBRXNFLEdBQUgsQ0FBWixFQUFrQnZFLENBQUMsQ0FBQ3VFLEdBQUQsQ0FBRCxDQUFLNE8sTUFBTCxHQUFZbFQsQ0FBQyxDQUFDLElBQUVzRSxHQUFGLEdBQUksQ0FBTCxDQUEvQixFQUF1Q3ZFLENBQUMsQ0FBQ3VFLEdBQUQsQ0FBRCxDQUFLNk8sYUFBTCxLQUFxQnBULENBQUMsQ0FBQ3VFLEdBQUQsQ0FBRCxDQUFLNk8sYUFBTCxHQUFtQixRQUF4QyxDQUF2QztFQUE3Qjs7RUFBc0gsYUFBT3BULENBQVA7RUFBUyxLQUFqSixDQUFQO0VBQTBKOzs7OztFQUFDLElBQU0wQixDQUFDLEdBQUMsZUFBYSxPQUFPMlIsV0FBcEIsR0FBZ0MsSUFBSUEsV0FBSixDQUFnQixPQUFoQixDQUFoQyxHQUF5RCxJQUFqRTtFQUFBLElBQXNFNU4sQ0FBQyxHQUFDLEVBQXhFO0VBQUEsSUFBMkUyRixDQUFDLEdBQUM7RUFBQ3BOLEVBQUFBLElBQUksRUFBQyxVQUFOO0VBQWlCc1YsRUFBQUEsR0FBRyxFQUFDO0VBQXJCLENBQTdFOztNQUFpSHZVOzs7TUFBU3dVLE9BQVAsY0FBWXZULENBQVosRUFBY0MsQ0FBZCxFQUFrQjtFQUFBLFFBQUpBLENBQUk7RUFBSkEsTUFBQUEsQ0FBSSxHQUFGLENBQUU7RUFBQTs7RUFBQyxRQUFNc0UsQ0FBQyxHQUFDLElBQUlpUCxRQUFKLENBQWF4VCxDQUFiLEVBQWVDLENBQWYsQ0FBUjtFQUFBLFFBQTBCcUMsQ0FBQyxHQUFDaUMsQ0FBQyxDQUFDa1AsU0FBRixDQUFZLENBQVosRUFBYyxDQUFDLENBQWYsQ0FBNUI7RUFBOEMsUUFBRyxNQUFJblIsQ0FBUCxFQUFTLE9BQU92RCxDQUFDLENBQUMyVSxNQUFGLENBQVNuUCxDQUFULEVBQVd0RSxDQUFYLENBQVA7RUFBcUIsUUFBRyxNQUFJcUMsQ0FBUCxFQUFTLE9BQU92RCxDQUFDLENBQUM0VSxNQUFGLENBQVMzVCxDQUFULEVBQVdDLENBQVgsQ0FBUDtFQUFxQixVQUFNLElBQUltRyxLQUFKLENBQVUsK0JBQTZCOUQsQ0FBdkMsQ0FBTjtFQUFnRDs7TUFBT29SLFNBQVAsZ0JBQWMxVCxDQUFkLEVBQWdCQyxDQUFoQixFQUFrQjtFQUFDLFFBQU1zRSxDQUFDLEdBQUN2RSxDQUFDLENBQUN5VCxTQUFGLENBQVksQ0FBWixFQUFjLENBQUMsQ0FBZixDQUFSO0VBQUEsUUFBMEJuUixDQUFDLEdBQUN0QyxDQUFDLENBQUN5VCxTQUFGLENBQVksRUFBWixFQUFlLENBQUMsQ0FBaEIsQ0FBNUI7RUFBK0MsUUFBR2xQLENBQUMsS0FBR3ZFLENBQUMsQ0FBQ3dQLE1BQUYsQ0FBUzlDLFVBQVQsR0FBb0J6TSxDQUEzQixFQUE2QixNQUFNLElBQUltRyxLQUFKLENBQVUsOERBQVYsQ0FBTjtFQUFnRixRQUFNbEMsQ0FBQyxHQUFDcUQsQ0FBQyxDQUFDdkgsQ0FBQyxDQUFDd1AsTUFBSCxFQUFVLEtBQUd2UCxDQUFiLEVBQWVxQyxDQUFmLENBQVQ7RUFBMkIsV0FBTTtFQUFDc1IsTUFBQUEsSUFBSSxFQUFDNVYsSUFBSSxDQUFDdVAsS0FBTCxDQUFXckosQ0FBWCxDQUFOO0VBQW9CK0ssTUFBQUEsU0FBUyxFQUFDO0VBQUNhLFFBQUFBLFVBQVUsRUFBQyxLQUFHN1AsQ0FBSCxHQUFLcUMsQ0FBakI7RUFBbUJrTixRQUFBQSxNQUFNLEVBQUN4UCxDQUFDLENBQUN3UDtFQUE1QjtFQUE5QixLQUFOO0VBQXlFOztNQUFPbUUsU0FBUCxnQkFBYzNULENBQWQsRUFBZ0JDLENBQWhCLEVBQWtCO0VBQUMsUUFBSXNFLENBQUosRUFBTWpDLENBQU47RUFBUSxRQUFNNEIsQ0FBQyxHQUFDLElBQUlzUCxRQUFKLENBQWF4VCxDQUFiLEVBQWV5RixDQUFmLENBQVI7RUFBMEIsUUFBSXBHLENBQUMsR0FBQyxDQUFOOztFQUFRLFdBQUtBLENBQUMsR0FBQzZFLENBQUMsQ0FBQ3dJLFVBQVQsR0FBcUI7RUFBQyxVQUFNek0sR0FBQyxHQUFDaUUsQ0FBQyxDQUFDdVAsU0FBRixDQUFZcFUsQ0FBWixFQUFjLENBQUMsQ0FBZixDQUFSOztFQUEwQkEsTUFBQUEsQ0FBQyxJQUFFLENBQUg7O0VBQUssVUFBTVAsRUFBQyxHQUFDb0YsQ0FBQyxDQUFDdVAsU0FBRixDQUFZcFUsQ0FBWixFQUFjLENBQUMsQ0FBZixDQUFSOztFQUEwQixVQUFHQSxDQUFDLElBQUUsQ0FBSCxFQUFLUCxFQUFDLEtBQUdzTSxDQUFDLENBQUNwTixJQUFkLEVBQW1CdUcsQ0FBQyxHQUFDZ0QsQ0FBQyxDQUFDdkgsQ0FBRCxFQUFHeUYsQ0FBQyxHQUFDcEcsQ0FBTCxFQUFPWSxHQUFQLENBQUgsQ0FBbkIsS0FBcUMsSUFBR25CLEVBQUMsS0FBR3NNLENBQUMsQ0FBQ2tJLEdBQVQsRUFBYTtFQUFDLFlBQU0vTyxHQUFDLEdBQUNrQixDQUFDLEdBQUNwRyxDQUFWOztFQUFZaUQsUUFBQUEsQ0FBQyxHQUFDdEMsQ0FBQyxDQUFDdkMsS0FBRixDQUFROEcsR0FBUixFQUFVQSxHQUFDLEdBQUN0RSxHQUFaLENBQUY7RUFBaUI7RUFBQVosTUFBQUEsQ0FBQyxJQUFFWSxHQUFIO0VBQUs7O0VBQUEsV0FBTTtFQUFDMlQsTUFBQUEsSUFBSSxFQUFDNVYsSUFBSSxDQUFDdVAsS0FBTCxDQUFXaEosQ0FBWCxDQUFOO0VBQW9CMEssTUFBQUEsU0FBUyxFQUFDO0VBQUNhLFFBQUFBLFVBQVUsRUFBQzdQLENBQVo7RUFBY3VQLFFBQUFBLE1BQU0sRUFBQ2xOO0VBQXJCO0VBQTlCLEtBQU47RUFBNkQ7Ozs7O0VBQUMsU0FBU2lGLENBQVQsQ0FBV3ZILENBQVgsRUFBYUMsQ0FBYixFQUFlc0UsQ0FBZixFQUFpQjtFQUFDLE1BQUc3QyxDQUFILEVBQUs7RUFBQyxRQUFNWSxHQUFDLEdBQUMsSUFBSStOLFVBQUosQ0FBZXJRLENBQWYsRUFBaUJDLENBQWpCLEVBQW1Cc0UsQ0FBbkIsQ0FBUjs7RUFBOEIsV0FBTzdDLENBQUMsQ0FBQ21TLE1BQUYsQ0FBU3ZSLEdBQVQsQ0FBUDtFQUFtQjs7RUFBQSxTQUFPLFVBQVN0QyxDQUFULEVBQVc7RUFBQyxRQUFNQyxDQUFDLEdBQUNELENBQUMsQ0FBQzNDLE1BQVY7RUFBaUIsUUFBSWtILENBQUMsR0FBQyxFQUFOOztFQUFTLFNBQUksSUFBSWpDLEdBQUMsR0FBQyxDQUFWLEVBQVlBLEdBQUMsR0FBQ3JDLENBQWQsR0FBaUI7RUFBQyxVQUFJaUUsRUFBQyxHQUFDbEUsQ0FBQyxDQUFDc0MsR0FBQyxFQUFGLENBQVA7O0VBQWEsVUFBRyxNQUFJNEIsRUFBUCxFQUFTO0VBQUMsWUFBSUssSUFBQyxHQUFDdVAsQ0FBQyxDQUFDNVAsRUFBQyxJQUFFLENBQUgsR0FBSyxDQUFOLENBQVA7RUFBZ0IsWUFBRyxFQUFFLEtBQUdBLEVBQUwsS0FBUyxDQUFDSyxJQUFWLElBQWFqQyxHQUFDLEdBQUNpQyxJQUFGLEdBQUl0RSxDQUFwQixFQUFzQixPQUFPLElBQVA7O0VBQVksYUFBSWlFLEVBQUMsSUFBRSxNQUFJSyxJQUFYLEVBQWFBLElBQUMsR0FBQyxDQUFmLEVBQWlCQSxJQUFDLElBQUUsQ0FBcEIsRUFBc0I7RUFBQyxjQUFNdEUsSUFBQyxHQUFDRCxDQUFDLENBQUNzQyxHQUFDLEVBQUYsQ0FBVDtFQUFlLGNBQUcsUUFBTSxNQUFJckMsSUFBVixDQUFILEVBQWdCLE9BQU8sSUFBUDtFQUFZaUUsVUFBQUEsRUFBQyxHQUFDQSxFQUFDLElBQUUsQ0FBSCxHQUFLLEtBQUdqRSxJQUFWO0VBQVk7RUFBQzs7RUFBQXNFLE1BQUFBLENBQUMsSUFBRW9PLE1BQU0sQ0FBQ0MsWUFBUCxDQUFvQjFPLEVBQXBCLENBQUg7RUFBMEI7O0VBQUEsV0FBT0ssQ0FBUDtFQUFTLEdBQW5QLENBQW9QLElBQUk4TCxVQUFKLENBQWVyUSxDQUFmLEVBQWlCQyxDQUFqQixFQUFtQnNFLENBQW5CLENBQXBQLENBQVA7RUFBa1I7O0VBQUEsSUFBTXVQLENBQUMsR0FBQyxDQUFDLENBQUQsRUFBRyxDQUFILEVBQUssQ0FBTCxFQUFPLENBQVAsRUFBUyxDQUFULEVBQVcsQ0FBWCxFQUFhLENBQWIsRUFBZSxDQUFmLENBQVI7RUFBMEIsSUFBTXZPLENBQUMsR0FBQztFQUFDd08sRUFBQUEsUUFBRCxvQkFBVS9ULENBQVYsRUFBWUMsQ0FBWixFQUFjc0UsQ0FBZCxFQUFnQmpDLENBQWhCLEVBQWtCO0VBQUE7O0VBQUMsV0FBT3RDLENBQUMsQ0FBQ2dVLFVBQUYsQ0FBYS9LLE9BQWIsQ0FBcUIsVUFBQWpKLENBQUMsRUFBRTtFQUFDLFVBQU1rRSxDQUFDLEdBQUNsRSxDQUFDLENBQUNpVSxRQUFWOztFQUFtQixXQUFJLElBQUk1VSxFQUFDLEdBQUMsQ0FBVixFQUFZQSxFQUFDLEdBQUM2RSxDQUFDLENBQUM3RyxNQUFoQixFQUF1QmdDLEVBQUMsRUFBeEIsRUFBMkI7RUFBQyxZQUFNUCxHQUFDLEdBQUNvRixDQUFDLENBQUM3RSxFQUFELENBQVQ7RUFBYVAsUUFBQUEsR0FBQyxDQUFDb1YsTUFBRixDQUFTQyxJQUFULEtBQWdCNVAsQ0FBaEIsS0FBb0Isa0JBQWdCekYsR0FBQyxDQUFDb1YsTUFBRixDQUFTRSxJQUF6QixHQUE4Qm5VLENBQUMsQ0FBQ29VLENBQUYsR0FBSSxNQUFJLENBQUNDLGVBQUwsQ0FBcUJyVSxDQUFDLENBQUNvVSxDQUF2QixFQUF5QnJVLENBQUMsQ0FBQ3dPLFFBQUYsQ0FBVzFQLEdBQUMsQ0FBQzJQLE9BQWIsQ0FBekIsRUFBK0NuTSxDQUEvQyxFQUFpRCxDQUFqRCxDQUFsQyxHQUFzRixlQUFheEQsR0FBQyxDQUFDb1YsTUFBRixDQUFTRSxJQUF0QixHQUEyQm5VLENBQUMsQ0FBQ3NVLENBQUYsR0FBSSxNQUFJLENBQUNDLGNBQUwsQ0FBb0J2VSxDQUFDLENBQUNzVSxDQUF0QixFQUF3QnZVLENBQUMsQ0FBQ3dPLFFBQUYsQ0FBVzFQLEdBQUMsQ0FBQzJQLE9BQWIsQ0FBeEIsRUFBOENuTSxDQUE5QyxFQUFnRCxDQUFoRCxDQUEvQixHQUFrRixZQUFVeEQsR0FBQyxDQUFDb1YsTUFBRixDQUFTRSxJQUFuQixHQUF3Qm5VLENBQUMsQ0FBQ3dVLENBQUYsR0FBSSxNQUFJLENBQUNILGVBQUwsQ0FBcUJyVSxDQUFDLENBQUN3VSxDQUF2QixFQUF5QnpVLENBQUMsQ0FBQ3dPLFFBQUYsQ0FBVzFQLEdBQUMsQ0FBQzJQLE9BQWIsQ0FBekIsRUFBK0NuTSxDQUEvQyxFQUFpRCxDQUFqRCxDQUE1QixHQUFnRixjQUFZeEQsR0FBQyxDQUFDb1YsTUFBRixDQUFTRSxJQUFyQixLQUE0Qm5VLENBQUMsQ0FBQ3lVLENBQUYsR0FBSSxNQUFJLENBQUNKLGVBQUwsQ0FBcUJyVSxDQUFDLENBQUN5VSxDQUF2QixFQUF5QjFVLENBQUMsQ0FBQ3dPLFFBQUYsQ0FBVzFQLEdBQUMsQ0FBQzJQLE9BQWIsQ0FBekIsRUFBK0NuTSxDQUEvQyxFQUFpRHJDLENBQUMsQ0FBQ3lVLENBQUYsQ0FBSXJYLE1BQXJELENBQWhDLENBQTVRO0VBQTJXO0VBQUMsS0FBamMsR0FBbWM0QyxDQUExYztFQUE0YyxHQUEvZDtFQUFnZXFVLEVBQUFBLGVBQWhlLDJCQUFnZnRVLENBQWhmLEVBQWtmQyxDQUFsZixFQUFvZnNFLENBQXBmLEVBQXNmakMsQ0FBdGYsRUFBd2Y7RUFBQyxZQUFPckMsQ0FBQyxDQUFDbVQsYUFBVDtFQUF3QixXQUFJLFFBQUo7RUFBYTtFQUFDLGNBQU1sUCxHQUFDLEdBQUMsS0FBS3lRLFdBQUwsQ0FBaUIxVSxDQUFqQixFQUFtQnNFLENBQW5CLEVBQXFCLElBQUVqQyxDQUF2QixDQUFSOztFQUFrQzRCLFVBQUFBLEdBQUMsS0FBR2xFLENBQUMsR0FBQyxVQUFTQSxDQUFULEVBQVdDLENBQVgsRUFBYXNFLENBQWIsRUFBZWpDLENBQWYsRUFBaUI7RUFBQyxtQkFBT3RDLENBQUMsR0FBQ0EsQ0FBQyxDQUFDeEIsR0FBRixDQUFNLFVBQUN3QixDQUFELEVBQUdrRSxDQUFIO0VBQUEscUJBQU9qRSxDQUFDLENBQUNpRSxDQUFELENBQUQsR0FBSzVCLENBQUMsSUFBRWlDLENBQUMsQ0FBQ0wsQ0FBRCxDQUFELEdBQUtqRSxDQUFDLENBQUNpRSxDQUFELENBQVIsQ0FBYjtFQUFBLGFBQU4sQ0FBVDtFQUEwQyxXQUE1RCxDQUE2RGxFLENBQTdELEVBQStEa0UsR0FBQyxDQUFDMFEsUUFBakUsRUFBMEUxUSxHQUFDLENBQUMyUSxJQUE1RSxFQUFpRjNRLEdBQUMsQ0FBQ2tQLGFBQUYsQ0FBZ0JsVixLQUFqRyxDQUFMLENBQUQ7RUFBK0c7RUFBTTs7RUFBQSxXQUFJLE1BQUo7RUFBVztFQUFDLGNBQU1nRyxHQUFDLEdBQUMsS0FBS3lRLFdBQUwsQ0FBaUIxVSxDQUFqQixFQUFtQnNFLENBQW5CLEVBQXFCLElBQUVqQyxDQUF2QixDQUFSOztFQUFrQzRCLFVBQUFBLEdBQUMsS0FBR2xFLENBQUMsR0FBQ2tFLEdBQUMsQ0FBQzBRLFFBQVAsQ0FBRDtFQUFrQjtFQUFNOztFQUFBLFdBQUksYUFBSjtFQUFrQjtFQUFDLGNBQU0xUSxHQUFDLEdBQUMsS0FBS3lRLFdBQUwsQ0FBaUIxVSxDQUFqQixFQUFtQnNFLENBQW5CLEVBQXFCLElBQUVqQyxDQUF2QixDQUFSOztFQUFrQzRCLFVBQUFBLEdBQUMsS0FBR2xFLENBQUMsR0FBQyxLQUFLOFUsZUFBTCxDQUFxQjVRLEdBQUMsQ0FBQ2tQLGFBQXZCLEVBQXFDbFAsR0FBQyxDQUFDMFEsUUFBdkMsRUFBZ0QxUSxHQUFDLENBQUMyUSxJQUFsRCxFQUF1RDVVLENBQUMsQ0FBQ2lULEtBQUYsQ0FBUXZELEtBQS9ELEVBQXFFLElBQUVyTixDQUF2RSxDQUFMLENBQUQ7RUFBaUY7RUFBTTtFQUEvWTs7RUFBZ1osV0FBT3RDLENBQVA7RUFBUyxHQUFsNUI7RUFBbTVCd1UsRUFBQUEsY0FBbjVCLDBCQUFrNkJ4VSxDQUFsNkIsRUFBbzZCdUUsQ0FBcDZCLEVBQXM2QmpDLENBQXQ2QixFQUF3NkI7RUFBQyxZQUFPaUMsQ0FBQyxDQUFDNk8sYUFBVDtFQUF3QixXQUFJLFFBQUo7RUFBYTtFQUFDLGNBQU1sUCxHQUFDLEdBQUMsS0FBS3lRLFdBQUwsQ0FBaUJwUSxDQUFqQixFQUFtQmpDLENBQW5CLEVBQXFCLENBQXJCLENBQVI7O0VBQWdDNEIsVUFBQUEsR0FBQyxJQUFFakUsS0FBQSxDQUFRRCxDQUFSLEVBQVVrRSxHQUFDLENBQUMwUSxRQUFaLEVBQXFCMVEsR0FBQyxDQUFDMlEsSUFBdkIsRUFBNEIzUSxHQUFDLENBQUNrUCxhQUFGLENBQWdCbFYsS0FBNUMsQ0FBSDtFQUFzRDtFQUFNOztFQUFBLFdBQUksTUFBSjtFQUFXO0VBQUMsY0FBTStCLElBQUMsR0FBQyxLQUFLMFUsV0FBTCxDQUFpQnBRLENBQWpCLEVBQW1CakMsQ0FBbkIsRUFBcUIsQ0FBckIsQ0FBUjs7RUFBZ0NyQyxVQUFBQSxJQUFDLEtBQUdELENBQUMsR0FBQ0MsSUFBQyxDQUFDMlUsUUFBUCxDQUFEO0VBQWtCO0VBQU07O0VBQUEsV0FBSSxhQUFKO0VBQWtCO0VBQUMsY0FBTTNVLElBQUMsR0FBQyxLQUFLMFUsV0FBTCxDQUFpQnBRLENBQWpCLEVBQW1CakMsQ0FBbkIsRUFBcUIsQ0FBckIsQ0FBUjs7RUFBZ0NyQyxVQUFBQSxJQUFDLEtBQUdBLElBQUMsQ0FBQzJVLFFBQUYsR0FBVzNVLElBQUMsQ0FBQzJVLFFBQUYsQ0FBV3BXLEdBQVgsQ0FBZSxVQUFBd0IsQ0FBQztFQUFBLG1CQUFFd0IsSUFBSSxDQUFDOEksSUFBTCxDQUFVdEssQ0FBVixDQUFGO0VBQUEsV0FBaEIsQ0FBWCxFQUEyQ0MsSUFBQyxDQUFDNFUsSUFBRixHQUFPNVUsSUFBQyxDQUFDNFUsSUFBRixDQUFPclcsR0FBUCxDQUFXLFVBQUF3QixDQUFDO0VBQUEsbUJBQUV3QixJQUFJLENBQUM4SSxJQUFMLENBQVV0SyxDQUFWLENBQUY7RUFBQSxXQUFaLENBQWxELEVBQThFQSxDQUFDLEdBQUMsQ0FBQ0EsQ0FBQyxHQUFDLEtBQUs4VSxlQUFMLENBQXFCN1UsSUFBQyxDQUFDbVQsYUFBdkIsRUFBcUNuVCxJQUFDLENBQUMyVSxRQUF2QyxFQUFnRDNVLElBQUMsQ0FBQzRVLElBQWxELEVBQXVEdFEsQ0FBQyxDQUFDMk8sS0FBRixDQUFRdkQsS0FBL0QsRUFBcUUsQ0FBckUsQ0FBSCxFQUE0RW5SLEdBQTVFLENBQWdGLFVBQUF3QixDQUFDO0VBQUEsbUJBQUV3QixJQUFJLENBQUNxSSxHQUFMLENBQVM3SixDQUFULENBQUY7RUFBQSxXQUFqRixDQUFuRixDQUFEO0VBQXFMO0VBQU07RUFBcGI7O0VBQXFiLFdBQU9BLENBQVA7RUFBUyxHQUF2MkM7RUFBdzJDMlUsRUFBQUEsV0FBeDJDLHVCQUFvM0MzVSxDQUFwM0MsRUFBczNDQyxDQUF0M0MsRUFBdzNDc0UsQ0FBeDNDLEVBQTAzQztFQUFDLFFBQU1qQyxDQUFDLEdBQUN0QyxDQUFDLENBQUNrVCxLQUFGLENBQVF2RCxLQUFoQjtFQUFBLFFBQXNCekwsQ0FBQyxHQUFDbEUsQ0FBQyxDQUFDbVQsTUFBRixDQUFTeEQsS0FBakM7RUFBQSxRQUF1Q3RRLENBQUMsR0FBQ1csQ0FBQyxDQUFDbVQsTUFBRixDQUFTdkQsUUFBbEQ7RUFBQSxRQUEyRDlRLENBQUMsR0FBQyxLQUFLaVcsaUJBQUwsQ0FBdUJ6UyxDQUF2QixFQUF5QnJDLENBQXpCLENBQTdEOztFQUF5RixXQUFPbkIsQ0FBQyxHQUFDO0VBQUM4VixNQUFBQSxRQUFRLEVBQUMxUSxDQUFDLENBQUN6RyxLQUFGLENBQVFxQixDQUFDLENBQUNrVyxRQUFGLEdBQVczVixDQUFYLEdBQWFrRixDQUFyQixFQUF1QixDQUFDekYsQ0FBQyxDQUFDa1csUUFBRixHQUFXLENBQVosSUFBZTNWLENBQWYsR0FBaUJrRixDQUF4QyxDQUFWO0VBQXFEc1EsTUFBQUEsSUFBSSxFQUFDM1EsQ0FBQyxDQUFDekcsS0FBRixDQUFRcUIsQ0FBQyxDQUFDbVcsU0FBRixHQUFZNVYsQ0FBWixHQUFja0YsQ0FBdEIsRUFBd0IsQ0FBQ3pGLENBQUMsQ0FBQ21XLFNBQUYsR0FBWSxDQUFiLElBQWdCNVYsQ0FBaEIsR0FBa0JrRixDQUExQyxDQUExRDtFQUF1RzZPLE1BQUFBLGFBQWEsRUFBQ3RVO0VBQXJILEtBQUQsR0FBeUgsSUFBakk7RUFBc0ksR0FBMWxEO0VBQTJsRGlXLEVBQUFBLGlCQUEzbEQsNkJBQTZtRC9VLENBQTdtRCxFQUErbURDLENBQS9tRCxFQUFpbkQ7RUFBQyxLQUFDQSxDQUFDLEdBQUNELENBQUMsQ0FBQyxDQUFELENBQUgsSUFBUUMsQ0FBQyxHQUFDRCxDQUFDLENBQUNBLENBQUMsQ0FBQzNDLE1BQUYsR0FBUyxDQUFWLENBQVosTUFBNEI0QyxDQUFDLEdBQUN1QixJQUFJLENBQUMwVCxHQUFMLENBQVNsVixDQUFDLENBQUMsQ0FBRCxDQUFWLEVBQWN3QixJQUFJLENBQUNnSSxHQUFMLENBQVN4SixDQUFDLENBQUNBLENBQUMsQ0FBQzNDLE1BQUYsR0FBUyxDQUFWLENBQVYsRUFBdUI0QyxDQUF2QixDQUFkLENBQTlCLEdBQXdFQSxDQUFDLEtBQUdELENBQUMsQ0FBQ0EsQ0FBQyxDQUFDM0MsTUFBRixHQUFTLENBQVYsQ0FBTCxLQUFvQjRDLENBQUMsR0FBQ0QsQ0FBQyxDQUFDLENBQUQsQ0FBdkIsQ0FBeEU7O0VBQW9HLFNBQUksSUFBSXVFLElBQUMsR0FBQyxDQUFWLEVBQVlBLElBQUMsR0FBQ3ZFLENBQUMsQ0FBQzNDLE1BQUYsR0FBUyxDQUF2QixFQUF5QmtILElBQUMsRUFBMUI7RUFBNkIsVUFBR3RFLENBQUMsSUFBRUQsQ0FBQyxDQUFDdUUsSUFBRCxDQUFKLElBQVN0RSxDQUFDLEdBQUNELENBQUMsQ0FBQ3VFLElBQUMsR0FBQyxDQUFILENBQWYsRUFBcUI7RUFBQyxZQUFNakMsR0FBQyxHQUFDdEMsQ0FBQyxDQUFDdUUsSUFBRCxDQUFUO0VBQWEsZUFBTTtFQUFDeVEsVUFBQUEsUUFBUSxFQUFDelEsSUFBVjtFQUFZMFEsVUFBQUEsU0FBUyxFQUFDMVEsSUFBQyxHQUFDLENBQXhCO0VBQTBCckcsVUFBQUEsS0FBSyxFQUFDLENBQUMrQixDQUFDLEdBQUNxQyxHQUFILEtBQU90QyxDQUFDLENBQUN1RSxJQUFDLEdBQUMsQ0FBSCxDQUFELEdBQU9qQyxHQUFkO0VBQWhDLFNBQU47RUFBd0Q7RUFBeEg7O0VBQXdILFdBQU8sSUFBUDtFQUFZLEdBQTExRDtFQUEyMUR3UyxFQUFBQSxlQUEzMUQsMkJBQTIyRDlVLENBQTMyRCxFQUE2MkRDLENBQTcyRCxFQUErMkRzRSxDQUEvMkQsRUFBaTNEakMsQ0FBajNELEVBQW0zRDRCLENBQW4zRCxFQUFxM0Q7RUFBQyxRQUFNN0UsQ0FBQyxHQUFDVyxDQUFDLENBQUM5QixLQUFWO0VBQUEsUUFBZ0JZLENBQUMsR0FBQ21CLENBQUMsQ0FBQ3hDLEtBQUYsQ0FBUXlHLENBQVIsRUFBVSxJQUFFQSxDQUFaLENBQWxCO0VBQUEsUUFBaUNDLENBQUMsR0FBQ2xFLENBQUMsQ0FBQ3hDLEtBQUYsQ0FBUSxJQUFFeUcsQ0FBVixFQUFZLElBQUVBLENBQWQsQ0FBbkM7RUFBQSxRQUFvREYsQ0FBQyxHQUFDMUIsQ0FBQyxDQUFDdEMsQ0FBQyxDQUFDZ1YsUUFBSCxDQUF2RDtFQUFBLFFBQW9FMVAsQ0FBQyxHQUFDaEQsQ0FBQyxDQUFDdEMsQ0FBQyxDQUFDaVYsU0FBSCxDQUF2RTtFQUFBLFFBQXFGL1AsQ0FBQyxHQUFDWCxDQUFDLENBQUM5RyxLQUFGLENBQVEsQ0FBUixFQUFVeUcsQ0FBVixDQUF2RjtFQUFBLFFBQW9HRCxDQUFDLEdBQUNNLENBQUMsQ0FBQzlHLEtBQUYsQ0FBUSxDQUFSLEVBQVUsSUFBRXlHLENBQVosQ0FBdEc7RUFBQSxRQUFxSEgsQ0FBQyxHQUFDLEVBQXZIOztFQUEwSCxTQUFJLElBQUkvRCxHQUFDLEdBQUMsQ0FBVixFQUFZQSxHQUFDLEdBQUMsQ0FBZCxFQUFnQkEsR0FBQyxFQUFqQixFQUFvQjtFQUFDLFVBQU1DLElBQUMsR0FBQ25CLENBQUMsQ0FBQ2tCLEdBQUQsQ0FBVDtFQUFBLFVBQWF1RSxJQUFDLEdBQUMsQ0FBQ2UsQ0FBQyxHQUFDdEIsQ0FBSCxJQUFNRyxDQUFDLENBQUNuRSxHQUFELENBQXRCO0VBQUEsVUFBMEJzQyxHQUFDLEdBQUMyQixDQUFDLENBQUNqRSxHQUFELENBQTdCO0VBQUEsVUFBaUNrRSxHQUFDLEdBQUMsQ0FBQ29CLENBQUMsR0FBQ3RCLENBQUgsSUFBTWtCLENBQUMsQ0FBQ2xGLEdBQUQsQ0FBMUM7RUFBQSxVQUE4QzBRLEVBQUMsR0FBQyxDQUFDLElBQUVsUCxJQUFJLENBQUMyVCxHQUFMLENBQVM5VixDQUFULEVBQVcsQ0FBWCxDQUFGLEdBQWdCLElBQUVtQyxJQUFJLENBQUMyVCxHQUFMLENBQVM5VixDQUFULEVBQVcsQ0FBWCxDQUFsQixHQUFnQyxDQUFqQyxJQUFvQ1ksSUFBcEMsR0FBc0MsQ0FBQ3VCLElBQUksQ0FBQzJULEdBQUwsQ0FBUzlWLENBQVQsRUFBVyxDQUFYLElBQWMsSUFBRW1DLElBQUksQ0FBQzJULEdBQUwsQ0FBUzlWLENBQVQsRUFBVyxDQUFYLENBQWhCLEdBQThCQSxDQUEvQixJQUFrQ2tGLElBQXhFLEdBQTBFLENBQUMsSUFBRSxDQUFDL0MsSUFBSSxDQUFDMlQsR0FBTCxDQUFTOVYsQ0FBVCxFQUFXLENBQVgsQ0FBSCxHQUFpQixJQUFFbUMsSUFBSSxDQUFDMlQsR0FBTCxDQUFTOVYsQ0FBVCxFQUFXLENBQVgsQ0FBcEIsSUFBbUNpRCxHQUE3RyxHQUErRyxDQUFDZCxJQUFJLENBQUMyVCxHQUFMLENBQVM5VixDQUFULEVBQVcsQ0FBWCxJQUFjbUMsSUFBSSxDQUFDMlQsR0FBTCxDQUFTOVYsQ0FBVCxFQUFXLENBQVgsQ0FBZixJQUE4QjZFLEdBQTdMOztFQUErTEgsTUFBQUEsQ0FBQyxDQUFDekUsSUFBRixDQUFPb1IsRUFBUDtFQUFVOztFQUFBLFdBQU8zTSxDQUFQO0VBQVMsR0FBdnRFO0VBQXd0RXFSLEVBQUFBLGdCQUF4dEUsNEJBQXl1RXBWLENBQXp1RSxFQUEydUVDLENBQTN1RSxFQUE2dUVxQyxDQUE3dUUsRUFBK3VFO0VBQUMsUUFBTTRCLENBQUMsR0FBQ2xFLENBQUMsQ0FBQ3FWLEtBQUYsQ0FBUXBWLENBQVIsRUFBV3FWLE9BQVgsS0FBcUJ0VixDQUFDLENBQUNxVixLQUFGLENBQVFwVixDQUFSLEVBQVdnTyxNQUFYLEdBQWtCak8sQ0FBQyxDQUFDcVYsS0FBRixDQUFRcFYsQ0FBUixFQUFXZ08sTUFBWCxDQUFrQixDQUFsQixFQUFxQnFILE9BQXZDLEdBQStDLEtBQUssQ0FBekUsQ0FBUjtFQUFBLFFBQW9GalcsQ0FBQyxHQUFDLEtBQUswVSxRQUFMLENBQWMvVCxDQUFkLEVBQWdCO0VBQUNxVSxNQUFBQSxDQUFDLEVBQUMsQ0FBQyxDQUFELEVBQUcsQ0FBSCxFQUFLLENBQUwsQ0FBSDtFQUFXRSxNQUFBQSxDQUFDLEVBQUMsQ0FBQyxDQUFELEVBQUcsQ0FBSCxFQUFLLENBQUwsRUFBTyxDQUFQLENBQWI7RUFBdUJFLE1BQUFBLENBQUMsRUFBQyxDQUFDLENBQUQsRUFBRyxDQUFILEVBQUssQ0FBTCxDQUF6QjtFQUFpQ0MsTUFBQUEsQ0FBQyxFQUFDeFE7RUFBbkMsS0FBaEIsRUFBc0RqRSxDQUF0RCxFQUF3RHFDLENBQXhELENBQXRGOztFQUFpSixXQUFNO0VBQUNpVCxNQUFBQSxHQUFHLEVBQUNoUiw0QkFBQSxDQUErQixFQUEvQixFQUFrQ2xGLENBQUMsQ0FBQ2tWLENBQXBDLEVBQXNDbFYsQ0FBQyxDQUFDZ1YsQ0FBeEMsRUFBMENoVixDQUFDLENBQUNvVixDQUE1QyxDQUFMO0VBQW9EYSxNQUFBQSxPQUFPLEVBQUNqVyxDQUFDLENBQUNxVjtFQUE5RCxLQUFOO0VBQXVFLEdBQXg4RTtFQUF5OEVjLEVBQUFBLFdBQXo4RSx1QkFBcTlFeFYsQ0FBcjlFLEVBQXU5RTtFQUFDLFFBQUcsQ0FBQ0EsQ0FBQyxDQUFDZ1UsVUFBTixFQUFpQixPQUFPLElBQVA7RUFBWSxRQUFJL1QsQ0FBQyxHQUFDLENBQUMsQ0FBRCxHQUFHLENBQVQ7RUFBQSxRQUFXc0UsQ0FBQyxHQUFDLElBQUUsQ0FBZjtFQUFpQixXQUFPdkUsQ0FBQyxDQUFDZ1UsVUFBRixDQUFhL0ssT0FBYixDQUFxQixVQUFBakosQ0FBQyxFQUFFO0VBQUMsVUFBTXNDLENBQUMsR0FBQ3RDLENBQUMsQ0FBQ2lVLFFBQVY7O0VBQW1CLFdBQUksSUFBSS9QLEdBQUMsR0FBQyxDQUFWLEVBQVlBLEdBQUMsR0FBQzVCLENBQUMsQ0FBQ2pGLE1BQWhCLEVBQXVCNkcsR0FBQyxFQUF4QixFQUEyQjtFQUFDLFlBQU03RSxHQUFDLEdBQUNpRCxDQUFDLENBQUM0QixHQUFELENBQVQ7RUFBQSxZQUFhcEYsR0FBQyxHQUFDa0IsQ0FBQyxDQUFDd08sUUFBRixDQUFXblAsR0FBQyxDQUFDb1AsT0FBYixFQUFzQnlFLEtBQXRCLENBQTRCdkQsS0FBM0M7RUFBaUQ3USxRQUFBQSxHQUFDLENBQUNBLEdBQUMsQ0FBQ3pCLE1BQUYsR0FBUyxDQUFWLENBQUQsR0FBYzRDLENBQWQsS0FBa0JBLENBQUMsR0FBQ25CLEdBQUMsQ0FBQ0EsR0FBQyxDQUFDekIsTUFBRixHQUFTLENBQVYsQ0FBckIsR0FBbUN5QixHQUFDLENBQUMsQ0FBRCxDQUFELEdBQUt5RixDQUFMLEtBQVNBLENBQUMsR0FBQ3pGLEdBQUMsQ0FBQyxDQUFELENBQVosQ0FBbkM7RUFBb0Q7RUFBQyxLQUE5SyxHQUFnTDtFQUFDb1csTUFBQUEsR0FBRyxFQUFDalYsQ0FBTDtFQUFPdUosTUFBQUEsR0FBRyxFQUFDakY7RUFBWCxLQUF2TDtFQUFxTTtFQUEzc0YsQ0FBUjtFQUFBLElBQXF0RmtELENBQUMsR0FBQyxlQUFhLE9BQU81QyxRQUFwQixHQUE2QixJQUE3QixHQUFrQ0EsUUFBUSxDQUFDQyxhQUFULENBQXVCLFFBQXZCLENBQXp2Rjs7TUFBZ3lGdVA7RUFBRSxhQUFZclUsQ0FBWixFQUFjQyxDQUFkLEVBQWdCc0UsQ0FBaEIsRUFBa0I7RUFBQyxRQUFHLEtBQUtrUixPQUFMLEdBQWFsUixDQUFDLElBQUUsRUFBaEIsRUFBbUJ0RSxDQUFDLENBQUN1UCxNQUFGLFlBQW9Ca0csV0FBMUMsRUFBc0Q7RUFBQSxvQkFBMkIzVyxDQUFDLENBQUN3VSxJQUFGLENBQU90VCxDQUFDLENBQUN1UCxNQUFULEVBQWdCdlAsQ0FBQyxDQUFDNlAsVUFBbEIsQ0FBM0I7RUFBQSxVQUFZdkwsSUFBWixXQUFPcVAsSUFBUDtFQUFBLFVBQXdCdFIsR0FBeEIsV0FBYzJNLFNBQWQ7O0VBQXlELFdBQUswRyxLQUFMLENBQVczVixDQUFYLEVBQWF1RSxJQUFiLEVBQWVqQyxHQUFmO0VBQWtCLEtBQWpJLE1BQXNJLEtBQUtxVCxLQUFMLENBQVczVixDQUFYLEVBQWFDLENBQWI7RUFBZ0I7Ozs7WUFBQTJWLE9BQUEsZ0JBQU07RUFBQyxRQUFNNVYsQ0FBQyxHQUFDLEtBQUs2VixVQUFMLEVBQVI7RUFBQSxRQUEwQjVWLENBQUMsR0FBQyxLQUFLNlYsZUFBTCxFQUE1Qjs7RUFBbUQsV0FBTzVSLENBQUMsQ0FBQ21DLEdBQUYsQ0FBTSxDQUFDckcsQ0FBRCxFQUFHQyxDQUFILENBQU4sRUFBYTJGLElBQWIsQ0FBa0IsVUFBQTVGLENBQUM7RUFBQSxhQUFHQSxDQUFDLENBQUMsQ0FBRCxDQUFELENBQUtnVSxVQUFMLEdBQWdCaFUsQ0FBQyxDQUFDLENBQUQsQ0FBakIsRUFBcUJBLENBQUMsQ0FBQyxDQUFELENBQXpCO0VBQUEsS0FBbkIsQ0FBUDtFQUF5RDs7TUFBT29WLG1CQUFQLDBCQUF3QnBWLENBQXhCLEVBQTBCQyxDQUExQixFQUE0QnNFLENBQTVCLEVBQThCO0VBQUMsV0FBT2dCLENBQUMsQ0FBQzZQLGdCQUFGLENBQW1CcFYsQ0FBbkIsRUFBcUJDLENBQXJCLEVBQXVCc0UsQ0FBdkIsQ0FBUDtFQUFpQzs7TUFBT3dSLHVCQUFQLDhCQUE0Qi9WLENBQTVCLEVBQThCO0VBQUMsV0FBT3VGLENBQUMsQ0FBQ2lRLFdBQUYsQ0FBY3hWLENBQWQsQ0FBUDtFQUF3Qjs7WUFBQTJWLFFBQUEsZUFBTTNWLENBQU4sRUFBUUMsQ0FBUixFQUFVc0UsQ0FBVixFQUFZO0VBQUMsU0FBS2tKLElBQUwsR0FBVXhOLENBQVYsRUFBWSxLQUFLK1YsT0FBTCxHQUFhL1YsQ0FBQyxDQUFDZ1csS0FBRixHQUFRLENBQUNoVyxDQUFDLENBQUNnVyxLQUFGLENBQVFELE9BQWpCLEdBQXlCLENBQWxELEVBQW9ELEtBQUt4SSxRQUFMLEdBQWN4TixDQUFsRSxFQUFvRSxLQUFLaVAsU0FBTCxHQUFlMUssQ0FBbkYsRUFBcUYsS0FBSzJLLE9BQUwsR0FBYSxFQUFsRyxFQUFxRyxLQUFLQyxRQUFMLEdBQWMsRUFBbkgsRUFBc0gsS0FBS3lCLFFBQUwsR0FBYyxJQUFJN00sQ0FBSixDQUFNL0QsQ0FBTixFQUFRQyxDQUFSLEVBQVVzRSxDQUFWLENBQXBJLEVBQWlKLEtBQUtrUixPQUFMLENBQWFTLFlBQWIsR0FBMEIsS0FBS1QsT0FBTCxDQUFhUyxZQUFiLElBQTJCQyxDQUF0TSxFQUF3TSxNQUFJLEtBQUtILE9BQVQsR0FBaUIsS0FBS0ksT0FBTCxHQUFhLElBQUkxRixDQUFKLENBQU0xUSxDQUFOLEVBQVFDLENBQVIsRUFBVXNFLENBQVYsRUFBWSxLQUFLa1IsT0FBTCxDQUFhUyxZQUF6QixDQUE5QixHQUFxRSxLQUFLRSxPQUFMLEdBQWEsSUFBSWxSLENBQUosQ0FBTWxGLENBQU4sRUFBUUMsQ0FBUixDQUExUjtFQUFxUzs7WUFBQW9XLGNBQUEscUJBQVlyVyxDQUFaLEVBQWNDLENBQWQsRUFBZ0I7RUFBQTs7RUFBQyxRQUFHRCxDQUFDLENBQUM2TixRQUFGLElBQVk3TixDQUFDLENBQUM2TixRQUFGLENBQVd4USxNQUFYLEdBQWtCLENBQWpDLEVBQW1DO0VBQUMsVUFBRyxDQUFDMkcsQ0FBQyxDQUFDaEUsQ0FBQyxDQUFDNk4sUUFBRixDQUFXLENBQVgsQ0FBRCxDQUFGLEtBQW9CL08sQ0FBQyxDQUFDeUYsQ0FBQyxHQUFDdkUsQ0FBQyxDQUFDNk4sUUFBRixDQUFXLENBQVgsQ0FBSCxDQUFELElBQW9CLFlBQVUsT0FBT3RKLENBQWpCLEtBQXFCLFNBQU9BLENBQUMsQ0FBQytSLFdBQVQsSUFBc0IvUixDQUFDLENBQUMrUixXQUFGLEtBQWdCM0QsTUFBM0QsQ0FBeEMsQ0FBSCxFQUErRyxPQUFPM1MsQ0FBUDs7RUFBUyxVQUFNc0MsR0FBQyxHQUFDdEMsQ0FBQyxDQUFDNk4sUUFBRixDQUFXclAsR0FBWCxDQUFlLFVBQUF3QixDQUFDLEVBQUU7RUFBQyxZQUFNdUUsQ0FBQyxHQUFDdEUsQ0FBQyxDQUFDRCxDQUFELENBQVQ7RUFBYSxlQUFPdUUsQ0FBQyxDQUFDZ1MsU0FBRixHQUFZdlcsQ0FBWixFQUFjLE1BQUksQ0FBQ3FXLFdBQUwsQ0FBaUI5UixDQUFqQixFQUFtQnRFLENBQW5CLENBQXJCO0VBQTJDLE9BQTNFLENBQVI7O0VBQXFGRCxNQUFBQSxDQUFDLENBQUM2TixRQUFGLEdBQVd2TCxHQUFYO0VBQWE7O0VBQUEsUUFBSWlDLENBQUo7O0VBQU0sUUFBR0osQ0FBQyxDQUFDbkUsQ0FBQyxDQUFDOFEsSUFBSCxDQUFKLEVBQWE7RUFBQyxVQUFNdk0sSUFBQyxHQUFDdkUsQ0FBQyxDQUFDOFEsSUFBRixDQUFPMEYsTUFBZjs7RUFBc0IsVUFBR2pTLElBQUMsSUFBRUEsSUFBQyxDQUFDbEgsTUFBTCxJQUFhMkcsQ0FBQyxDQUFDTyxJQUFDLENBQUMsQ0FBRCxDQUFGLENBQWpCLEVBQXdCO0VBQUMsWUFBTUEsSUFBQyxHQUFDdkUsQ0FBQyxDQUFDOFEsSUFBRixDQUFPMEYsTUFBUCxDQUFjaFksR0FBZCxDQUFrQixVQUFBd0IsQ0FBQztFQUFBLGlCQUFFQyxDQUFDLENBQUNELENBQUQsQ0FBSDtFQUFBLFNBQW5CLENBQVI7O0VBQW1DQSxRQUFBQSxDQUFDLENBQUM4USxJQUFGLENBQU8wRixNQUFQLEdBQWNqUyxJQUFkO0VBQWdCO0VBQUM7O0VBQUEsV0FBT3ZFLENBQVA7RUFBUzs7WUFBQTZWLGFBQUEsc0JBQVk7RUFBQTs7RUFBQyxXQUFPLEtBQUtZLFVBQUwsR0FBa0I3USxJQUFsQixDQUF1QixVQUFBNUYsQ0FBQyxFQUFFO0VBQUMsVUFBTUMsQ0FBQyxHQUFDLE1BQUksQ0FBQ3lXLE1BQUwsR0FBWSxFQUFwQjtFQUF1QixVQUFJblMsQ0FBSjs7RUFBTSxXQUFJLElBQU10RSxJQUFWLElBQWVELENBQWY7RUFBaUJBLFFBQUFBLENBQUMsQ0FBQ0MsSUFBRCxDQUFELEdBQUssTUFBSSxDQUFDb1csV0FBTCxDQUFpQnJXLENBQUMsQ0FBQ0MsSUFBRCxDQUFsQixFQUFzQkQsQ0FBdEIsQ0FBTCxFQUE4QkEsQ0FBQyxDQUFDQyxJQUFELENBQUQsQ0FBS3NXLFNBQUwsR0FBZUksTUFBTSxDQUFDMVcsSUFBRCxDQUFOLEdBQVUwVyxNQUFNLENBQUMxVyxJQUFELENBQWhCLEdBQW9CQSxJQUFqRTtFQUFqQjs7RUFBb0YsTUFBQSxNQUFJLENBQUNtVyxPQUFMLENBQWExSSxPQUFiLENBQXFCLFVBQUNwTCxDQUFELEVBQUc0QixDQUFILEVBQUs3RSxDQUFMLEVBQVM7RUFBQyxZQUFNUCxDQUFDLEdBQUMsRUFBUjtFQUFXb0YsUUFBQUEsQ0FBQyxDQUFDMEosSUFBRixLQUFTOU8sQ0FBQyxDQUFDOE8sSUFBRixHQUFPMUosQ0FBQyxDQUFDMEosSUFBbEIsR0FBd0IxSixDQUFDLENBQUNtUixLQUFGLEtBQVV2VyxDQUFDLENBQUN1VyxLQUFGLEdBQVFuUixDQUFDLENBQUNtUixLQUFGLENBQVE3VyxHQUFSLENBQVksVUFBQXlCLENBQUM7RUFBQSxpQkFBRUQsQ0FBQyxDQUFDQyxDQUFELENBQUg7RUFBQSxTQUFiLENBQWxCLENBQXhCLEVBQWdFLE1BQUksQ0FBQ3dOLElBQUwsQ0FBVW1KLEtBQVYsS0FBa0J0VSxDQUFsQixLQUFzQmlDLENBQUMsR0FBQ2xGLENBQXhCLENBQWhFLEVBQTJGWSxDQUFDLENBQUNYLElBQUYsQ0FBT1IsQ0FBUCxDQUEzRjtFQUFxRyxPQUEvSSxFQUFnSixRQUFoSjs7RUFBMEosVUFBTXdELENBQUMsR0FBQztFQUFDc1UsUUFBQUEsS0FBSyxFQUFDclMsQ0FBUDtFQUFTbVMsUUFBQUEsTUFBTSxFQUFDelcsQ0FBaEI7RUFBa0JvVixRQUFBQSxLQUFLLEVBQUNyVixDQUF4QjtFQUEwQmlPLFFBQUFBLE1BQU0sRUFBQyxNQUFJLENBQUNBLE1BQXRDO0VBQTZDNEksUUFBQUEsS0FBSyxFQUFDLE1BQUksQ0FBQ0E7RUFBeEQsT0FBUjtFQUF1RSxhQUFPLE1BQUksQ0FBQ3BKLElBQUwsQ0FBVXdFLFVBQVYsS0FBdUIzUCxDQUFDLENBQUMyUCxVQUFGLEdBQWEsTUFBSSxDQUFDeEUsSUFBTCxDQUFVd0UsVUFBOUMsR0FBMEQzUCxDQUFqRTtFQUFtRSxLQUFoYixDQUFQO0VBQXliOztZQUFBbVUsYUFBQSxzQkFBWTtFQUFBOztFQUFDLFdBQU8sS0FBS0ssV0FBTCxHQUFtQmxSLElBQW5CLENBQXdCLFlBQUk7RUFBQyxVQUFNNUYsQ0FBQyxHQUFDLE9BQUksQ0FBQ3FWLEtBQUwsR0FBVyxFQUFuQjtFQUFzQixhQUFPLE9BQUksQ0FBQ2UsT0FBTCxDQUFhMUksT0FBYixDQUFxQixVQUFDek4sQ0FBRCxFQUFHc0UsQ0FBSCxFQUFPO0VBQUMsWUFBTWpDLENBQUMsR0FBQyxPQUFJLENBQUM4VCxPQUFMLENBQWF6SSxVQUFiLENBQXdCcEosQ0FBeEIsRUFBMEIsT0FBSSxDQUFDMEosTUFBL0IsRUFBc0MsT0FBSSxDQUFDNEksS0FBM0MsQ0FBUjs7RUFBMEQ3VyxRQUFBQSxDQUFDLENBQUNDLENBQUQsQ0FBRCxHQUFLcUMsQ0FBTDtFQUFPLE9BQTlGLEVBQStGLE9BQS9GLEdBQXdHdEMsQ0FBL0c7RUFBaUgsS0FBcEssQ0FBUDtFQUE2Szs7WUFBQStXLGFBQUEsc0JBQVk7RUFBQTs7RUFBQyxTQUFLRixLQUFMLEdBQVcsRUFBWDtFQUFjLFFBQU03VyxDQUFDLEdBQUMsRUFBUjtFQUFXLFdBQU8sS0FBS29XLE9BQUwsQ0FBYTFJLE9BQWIsQ0FBcUIsVUFBQ3pOLENBQUQsRUFBR3NFLENBQUgsRUFBS2pDLENBQUwsRUFBUztFQUFDdEMsTUFBQUEsQ0FBQyxDQUFDVixJQUFGLENBQU8sT0FBSSxDQUFDMFgsU0FBTCxDQUFlelMsQ0FBZixFQUFrQnFCLElBQWxCLENBQXVCLFVBQUE1RixDQUFDLEVBQUU7RUFBQ0EsUUFBQUEsQ0FBQyxDQUFDeVIsS0FBRixHQUFRblAsQ0FBUixFQUFVLE9BQUksQ0FBQ3VVLEtBQUwsQ0FBVzVXLENBQVgsSUFBY0QsQ0FBeEI7RUFBMEIsT0FBckQsQ0FBUDtFQUErRCxLQUE5RixFQUErRixPQUEvRixHQUF3R0EsQ0FBL0c7RUFBaUg7O1lBQUFnWCxZQUFBLG1CQUFVaFgsQ0FBVixFQUFZO0VBQUMsUUFBTUMsQ0FBQyxHQUFDRCxDQUFDLENBQUNpWCxtQkFBVjtFQUE4QixXQUFPLEtBQUtyRyxRQUFMLENBQWN4QixZQUFkLENBQTJCLHFCQUEzQixFQUFpRG5QLENBQWpELEVBQW9EMkYsSUFBcEQsQ0FBeUQsVUFBQTNGLENBQUM7RUFBQSxhQUFHRCxDQUFDLENBQUNpWCxtQkFBRixHQUFzQmhYLENBQXRCLEVBQXdCRCxDQUEzQjtFQUFBLEtBQTFELENBQVA7RUFBZ0c7O1lBQUE4VixrQkFBQSwyQkFBaUI7RUFBQyxRQUFNOVYsQ0FBQyxHQUFDLEtBQUt5TixJQUFMLENBQVV1RyxVQUFsQjtFQUE2QixXQUFPN1AsQ0FBQyxDQUFDbkUsQ0FBRCxDQUFELEdBQUssS0FBS29XLE9BQUwsQ0FBYXBILGFBQWIsQ0FBMkJoUCxDQUEzQixDQUFMLEdBQW1DLElBQTFDO0VBQStDOztZQUFBOFcsY0FBQSx1QkFBYTtFQUFBOztFQUFDLFNBQUs3SSxNQUFMLEdBQVksRUFBWjtFQUFlLFFBQUlqTyxDQUFDLEdBQUMsRUFBTjtFQUFTLFdBQU8sS0FBS29XLE9BQUwsQ0FBYTFJLE9BQWIsQ0FBcUIsVUFBQ3pOLENBQUQsRUFBR3NFLENBQUgsRUFBS2pDLENBQUwsRUFBUztFQUFDdEMsTUFBQUEsQ0FBQyxDQUFDVixJQUFGLENBQU8sT0FBSSxDQUFDNFgsU0FBTCxDQUFlM1MsQ0FBZixFQUFrQnFCLElBQWxCLENBQXVCLFVBQUE1RixDQUFDLEVBQUU7RUFBQ0EsUUFBQUEsQ0FBQyxDQUFDeVIsS0FBRixHQUFRblAsQ0FBUixFQUFVLE9BQUksQ0FBQzJMLE1BQUwsQ0FBWWhPLENBQVosSUFBZUQsQ0FBekI7RUFBMkIsT0FBdEQsQ0FBUDtFQUFnRSxLQUEvRixFQUFnRyxRQUFoRyxHQUEwR0EsQ0FBQyxHQUFDQSxDQUFDLENBQUNtWCxNQUFGLENBQVMsS0FBS0osVUFBTCxFQUFULENBQTVHLEVBQXdJN1MsQ0FBQyxDQUFDbUMsR0FBRixDQUFNckcsQ0FBTixDQUEvSTtFQUF3Sjs7WUFBQWtYLFlBQUEsbUJBQVVsWCxDQUFWLEVBQVk7RUFBQTs7RUFBQyxRQUFNQyxDQUFDLEdBQUNELENBQUMsQ0FBQ29YLFVBQUYsQ0FBYTVZLEdBQWIsQ0FBaUIsVUFBQXdCLENBQUM7RUFBQSxhQUFFLE9BQUksQ0FBQ3FYLGNBQUwsQ0FBb0JyWCxDQUFwQixDQUFGO0VBQUEsS0FBbEIsQ0FBUjtFQUFvRCxXQUFPa0UsQ0FBQyxDQUFDbUMsR0FBRixDQUFNcEcsQ0FBTixFQUFTMkYsSUFBVCxDQUFjLFVBQUEzRixDQUFDLEVBQUU7RUFBQyxVQUFNc0UsQ0FBQyxHQUFDLEVBQVI7RUFBVyxhQUFPZSxDQUFDLENBQUNmLENBQUQsRUFBR3ZFLENBQUgsQ0FBRCxFQUFPdUUsQ0FBQyxDQUFDNlMsVUFBRixHQUFhblgsQ0FBcEIsRUFBc0JzRSxDQUE3QjtFQUErQixLQUE1RCxDQUFQO0VBQXFFOztZQUFBOFMsaUJBQUEsd0JBQWVyWCxDQUFmLEVBQWlCO0VBQUE7O0VBQUMsUUFBTUMsQ0FBQyxHQUFDLEVBQVI7RUFBQSxRQUFXc0UsQ0FBQyxHQUFDdkUsQ0FBQyxDQUFDZ0YsVUFBZjtFQUFBLFFBQTBCMUMsQ0FBQyxHQUFDLEtBQUtnVixhQUFMLENBQW1CdFgsQ0FBbkIsQ0FBNUI7O0VBQWtEc0MsSUFBQUEsQ0FBQyxJQUFFckMsQ0FBQyxDQUFDWCxJQUFGLENBQU9nRCxDQUFQLENBQUg7RUFBYSxRQUFJakQsQ0FBQyxHQUFDLElBQU47O0VBQVcsU0FBSSxJQUFNVyxHQUFWLElBQWV1RSxDQUFmLEVBQWlCO0VBQUMsVUFBTWpDLEdBQUMsR0FBQyxLQUFLc08sUUFBTCxDQUFjeEIsWUFBZCxDQUEyQnBQLEdBQTNCLEVBQTZCdUUsQ0FBQyxDQUFDdkUsR0FBRCxDQUE5QixDQUFSOztFQUEyQ3NDLE1BQUFBLEdBQUMsSUFBRXJDLENBQUMsQ0FBQ1gsSUFBRixDQUFPZ0QsR0FBUCxDQUFIO0VBQWE7O0VBQUEsUUFBRzZCLENBQUMsQ0FBQ25FLENBQUMsQ0FBQ3VYLE9BQUgsQ0FBSixFQUFnQjtFQUFDLFVBQU1oVCxJQUFDLEdBQUMsS0FBS3FNLFFBQUwsQ0FBY3hCLFlBQWQsQ0FBMkIsU0FBM0IsRUFBcUNwUCxDQUFDLENBQUN1WCxPQUF2QyxDQUFSOztFQUF3RGhULE1BQUFBLElBQUMsSUFBRXRFLENBQUMsQ0FBQ1gsSUFBRixDQUFPaUYsSUFBUCxDQUFIO0VBQWE7O0VBQUEsUUFBR0osQ0FBQyxDQUFDbkUsQ0FBQyxDQUFDd1gsT0FBSCxDQUFKLEVBQWdCLEtBQUksSUFBSWpULElBQUMsR0FBQyxDQUFWLEVBQVlBLElBQUMsR0FBQ3ZFLENBQUMsQ0FBQ3dYLE9BQUYsQ0FBVW5hLE1BQXhCLEVBQStCa0gsSUFBQyxFQUFoQyxFQUFtQztFQUFDLFVBQU1qQyxJQUFDLEdBQUN0QyxDQUFDLENBQUN3WCxPQUFGLENBQVVqVCxJQUFWLENBQVI7O0VBQXFCLFdBQUksSUFBTXZFLEdBQVYsSUFBZXNDLElBQWYsRUFBaUI7RUFBQyxZQUFNNEIsR0FBQyxHQUFDLEtBQUswTSxRQUFMLENBQWN4QixZQUFkLENBQThCcFAsR0FBOUIsU0FBbUN1RSxJQUFuQyxFQUF1Q2pDLElBQUMsQ0FBQ3RDLEdBQUQsQ0FBeEMsQ0FBUjs7RUFBcURrRSxRQUFBQSxHQUFDLElBQUVqRSxDQUFDLENBQUNYLElBQUYsQ0FBTzRFLEdBQVAsQ0FBSDtFQUFhO0VBQUM7RUFBQSxXQUFPQSxDQUFDLENBQUNtQyxHQUFGLENBQU1wRyxDQUFOLEVBQVMyRixJQUFULENBQWMsVUFBQTNGLENBQUMsRUFBRTtFQUFDLFVBQUlzRSxDQUFKO0VBQU0sTUFBQSxPQUFJLENBQUNrVCxhQUFMLEdBQW1CLEVBQW5CO0VBQXNCLFVBQU1uVixDQUFDLEdBQUM7RUFBQzBDLFFBQUFBLFVBQVUsRUFBQy9FLENBQUMsQ0FBQ3lYLE1BQUYsQ0FBUyxVQUFDMVgsQ0FBRCxFQUFHQyxDQUFIO0VBQUEsaUJBQVFBLENBQUMsQ0FBQ3FSLFFBQUYsSUFBWWpTLENBQUMsR0FBQ1ksQ0FBQyxDQUFDcVIsUUFBSixFQUFhclIsQ0FBQyxDQUFDd1gsYUFBRixJQUFpQnhYLENBQUMsQ0FBQ3dYLGFBQUYsQ0FBZ0J4TyxPQUFoQixDQUF3QixVQUFBakosQ0FBQyxFQUFFO0VBQUMsWUFBQSxPQUFJLENBQUN5WCxhQUFMLENBQW1CblosT0FBbkIsQ0FBMkIwQixDQUEzQixJQUE4QixDQUE5QixJQUFpQyxPQUFJLENBQUN5WCxhQUFMLENBQW1CblksSUFBbkIsQ0FBd0JVLENBQXhCLENBQWpDO0VBQTRELFdBQXhGLENBQTFDLEtBQXNJLGNBQVlDLENBQUMsQ0FBQzJOLElBQWQsR0FBbUJySixDQUFDLEdBQUN0RSxDQUFDLENBQUMwUCxLQUF2QixHQUE2QjNQLENBQUMsQ0FBQ0MsQ0FBQyxDQUFDMk4sSUFBSCxDQUFELEdBQVU7RUFBQytCLFlBQUFBLEtBQUssRUFBQzFQLENBQUMsQ0FBQzBQLEtBQVQ7RUFBZUMsWUFBQUEsUUFBUSxFQUFDM1AsQ0FBQyxDQUFDMlAsUUFBMUI7RUFBbUNDLFlBQUFBLFlBQVksRUFBQzVQLENBQUMsQ0FBQzRQO0VBQWxELFdBQXZDLEVBQXVHLE9BQUksQ0FBQzRILGFBQUwsQ0FBbUJuWixPQUFuQixDQUEyQjJCLENBQUMsQ0FBQzBQLEtBQUYsQ0FBUUgsTUFBbkMsSUFBMkMsQ0FBM0MsSUFBOEMsT0FBSSxDQUFDaUksYUFBTCxDQUFtQm5ZLElBQW5CLENBQXdCVyxDQUFDLENBQUMwUCxLQUFGLENBQVFILE1BQWhDLENBQTNSLEdBQW9VeFAsQ0FBNVU7RUFBQSxTQUFULEVBQXdWLEVBQXhWLENBQVo7RUFBd1dzUixRQUFBQSxRQUFRLEVBQUNqUztFQUFqWCxPQUFSO0VBQTRYLGFBQU9rRixDQUFDLEtBQUdqQyxDQUFDLENBQUNpVixPQUFGLEdBQVVoVCxDQUFiLENBQUQsRUFBaUJqQyxDQUFDLENBQUNxVixJQUFGLEdBQU94VCxDQUFDLENBQUNuRSxDQUFDLENBQUMyWCxJQUFILENBQUQsR0FBVTNYLENBQUMsQ0FBQzJYLElBQVosR0FBaUIsQ0FBekMsRUFBMkN4VCxDQUFDLENBQUNuRSxDQUFDLENBQUNnTyxNQUFILENBQUQsS0FBYzFMLENBQUMsQ0FBQzBMLE1BQUYsR0FBU2hPLENBQUMsQ0FBQ2dPLE1BQXpCLENBQTNDLEVBQTRFMUwsQ0FBbkY7RUFBcUYsS0FBL2YsQ0FBUDtFQUF3Z0I7O1lBQUFnVixnQkFBQSx1QkFBY3RYLENBQWQsRUFBZ0I7RUFBQyxRQUFNQyxDQUFDLEdBQUNELENBQUMsQ0FBQ3NSLFFBQVY7O0VBQW1CLFFBQUcsTUFBSSxLQUFLMEUsT0FBWixFQUFvQjtFQUFDLFVBQUcsQ0FBQzdSLENBQUMsQ0FBQ2xFLENBQUQsQ0FBTCxFQUFTLE9BQU8sSUFBUDtFQUFZLGFBQU8sS0FBS21XLE9BQUwsQ0FBYXJILFdBQWIsQ0FBeUI5TyxDQUF6QixDQUFQO0VBQW1DOztFQUFBLFFBQU1zRSxDQUFDLEdBQUMsS0FBSzZSLE9BQUwsQ0FBYWxJLG1CQUFiLENBQWlDak8sQ0FBakMsQ0FBUjtFQUE0QyxXQUFPc0UsQ0FBQyxHQUFDLEtBQUtxTixVQUFMLENBQWdCck4sQ0FBQyxDQUFDc0ssTUFBbEIsRUFBMEJqSixJQUExQixDQUErQixVQUFBNUYsQ0FBQyxFQUFFO0VBQUMsVUFBTXNDLENBQUMsR0FBQyxDQUFDdEMsQ0FBQyxDQUFDd1AsTUFBSCxDQUFSO0VBQUEsVUFBbUJ0TCxDQUFDLEdBQUNLLENBQUMsQ0FBQ3NLLE1BQXZCO0VBQThCN08sTUFBQUEsQ0FBQyxDQUFDeVIsS0FBRixHQUFRdk4sQ0FBUixFQUFVb0IsQ0FBQyxDQUFDZixDQUFDLENBQUNzSyxNQUFILEVBQVUzSyxDQUFWLENBQVgsRUFBd0JLLENBQUMsQ0FBQ3NLLE1BQUYsQ0FBU2dELEtBQVQsR0FBZTdSLENBQXZDO0VBQXlDLFVBQU1YLENBQUMsR0FBQztFQUFDa1MsUUFBQUEsZ0JBQWdCLEVBQUNoTjtFQUFsQixPQUFSO0VBQTZCLGFBQU90RSxDQUFDLENBQUMyTixJQUFGLEtBQVN2TyxDQUFDLENBQUN1TyxJQUFGLEdBQU8zTixDQUFDLENBQUMyTixJQUFsQixHQUF3QjNOLENBQUMsQ0FBQ2dTLFVBQUYsS0FBZTVTLENBQUMsQ0FBQzRTLFVBQUYsR0FBYWhTLENBQUMsQ0FBQ2dTLFVBQTlCLENBQXhCLEVBQWtFNVMsQ0FBQyxDQUFDNFMsVUFBRixLQUFlLE9BQU81UyxDQUFDLENBQUM0UyxVQUFGLENBQWEyRixlQUFwQixFQUFvQyxPQUFPdlksQ0FBQyxDQUFDNFMsVUFBRixDQUFhNEYsV0FBeEQsRUFBb0UsTUFBSUMsTUFBTSxDQUFDQyxJQUFQLENBQVkxWSxDQUFDLENBQUM0UyxVQUFkLEVBQTBCNVUsTUFBOUIsSUFBc0MsT0FBT2dDLENBQUMsQ0FBQzRTLFVBQWxJLENBQWxFLEVBQWdOaFMsQ0FBQyxDQUFDK04sTUFBRixLQUFXM08sQ0FBQyxDQUFDMk8sTUFBRixHQUFTL04sQ0FBQyxDQUFDK04sTUFBdEIsQ0FBaE4sRUFBOE87RUFBQ3NELFFBQUFBLFFBQVEsRUFBQ2pTLENBQVY7RUFBWW9ZLFFBQUFBLGFBQWEsRUFBQ25WO0VBQTFCLE9BQXJQO0VBQWtSLEtBQXpaLENBQUQsR0FBNFosSUFBcGE7RUFBeWE7O1lBQUFzUCxhQUFBLG9CQUFXNVIsQ0FBWCxFQUFhO0VBQUE7O0VBQUMsUUFBR0EsQ0FBQyxDQUFDdVAsVUFBRixJQUFjdlAsQ0FBQyxDQUFDaVMsVUFBRixLQUFlalMsQ0FBQyxDQUFDaVMsVUFBRixDQUFhMkYsZUFBYixJQUE4QjVYLENBQUMsQ0FBQ2lTLFVBQUYsQ0FBYTRGLFdBQTFELENBQWpCLEVBQXdGO0VBQUMsVUFBTTVYLElBQUMsR0FBQ0QsQ0FBQyxDQUFDdVAsVUFBRixHQUFhdlAsQ0FBYixHQUFlQSxDQUFDLENBQUNpUyxVQUFGLENBQWEyRixlQUFiLElBQThCNVgsQ0FBQyxDQUFDaVMsVUFBRixDQUFhNEYsV0FBbEU7O0VBQThFLFVBQUc3WCxDQUFDLENBQUNpUyxVQUFGLEtBQWVqUyxDQUFDLENBQUNnUyxRQUFGLEdBQVcvUixJQUFDLENBQUMrUixRQUFiLEVBQXNCaFMsQ0FBQyxDQUFDOFIsS0FBRixHQUFRN1IsSUFBQyxDQUFDNlIsS0FBaEMsRUFBc0M5UixDQUFDLENBQUMrUixNQUFGLEdBQVM5UixJQUFDLENBQUM4UixNQUFoRSxHQUF3RSxLQUFLN0MsT0FBTCxDQUFhalAsSUFBQyxDQUFDc1AsVUFBZixDQUEzRSxFQUFzRyxPQUFPckwsQ0FBQyxDQUFDa0IsT0FBRixDQUFVLEtBQUs4SixPQUFMLENBQWFqUCxJQUFDLENBQUNzUCxVQUFmLENBQVYsQ0FBUDs7RUFBNkMsVUFBTWhMLElBQUMsR0FBQyxLQUFLa0osSUFBTCxDQUFVNkIsV0FBVixDQUFzQnJQLElBQUMsQ0FBQ3NQLFVBQXhCLENBQVI7RUFBQSxVQUE0Q2pOLElBQUMsR0FBQyxDQUFDaUMsSUFBQyxDQUFDdUwsVUFBRixJQUFjLENBQWYsSUFBa0IsS0FBS2IsU0FBTCxDQUFlYSxVQUEvRTtFQUFBLFVBQTBGelEsR0FBQyxHQUFDa0YsSUFBQyxDQUFDbUksVUFBOUY7RUFBQSxVQUF5RzVOLEdBQUMsR0FBQyxLQUFLb1EsT0FBTCxDQUFhalAsSUFBQyxDQUFDc1AsVUFBZixJQUEyQixJQUFJYyxVQUFKLENBQWUsS0FBS3BCLFNBQUwsQ0FBZU8sTUFBOUIsRUFBcUNsTixJQUFyQyxFQUF1Q2pELEdBQXZDLENBQXRJOztFQUFnTCxhQUFPNkUsQ0FBQyxDQUFDa0IsT0FBRixDQUFVdEcsR0FBVixDQUFQO0VBQW9COztFQUFBO0VBQUMsVUFBTW1CLElBQUMsR0FBQ0QsQ0FBQyxDQUFDeVAsR0FBVjtFQUFBLFVBQWNsTCxJQUFDLEdBQUMsS0FBS2lKLFFBQUwsR0FBYyxHQUFkLEdBQWtCdk4sSUFBbEM7O0VBQW9DLGFBQU8sS0FBS2tQLFFBQUwsQ0FBYzVLLElBQWQsSUFBaUIsS0FBSzRLLFFBQUwsQ0FBYzVLLElBQWQsRUFBaUJxQixJQUFqQixDQUFzQjtFQUFBLGVBQUksT0FBSSxDQUFDc0osT0FBTCxDQUFhM0ssSUFBYixDQUFKO0VBQUEsT0FBdEIsQ0FBakIsR0FBNEQsS0FBSzRLLFFBQUwsQ0FBYzVLLElBQWQsSUFBaUJsRixDQUFDLENBQUMrTixjQUFGLENBQWlCN0ksSUFBakIsRUFBbUIsSUFBbkIsRUFBeUJxQixJQUF6QixDQUE4QixVQUFBNUYsQ0FBQyxFQUFFO0VBQUMsWUFBTUMsQ0FBQyxHQUFDRCxDQUFDLENBQUMyTSxJQUFWO0VBQWUsZUFBTyxPQUFJLENBQUN1QyxPQUFMLENBQWEzSyxJQUFiLElBQWdCdEUsQ0FBaEIsRUFBa0IsSUFBSW9RLFVBQUosQ0FBZXBRLENBQWYsQ0FBekI7RUFBMkMsT0FBNUYsQ0FBcEY7RUFBa0w7RUFBQzs7Ozs7RUFBQyxTQUFTa1csQ0FBVCxDQUFXblcsQ0FBWCxFQUFhQyxDQUFiLEVBQWU7RUFBQyxNQUFNc0UsQ0FBQyxHQUFDLElBQUl5VCxLQUFKLEVBQVI7RUFBa0J6VCxFQUFBQSxDQUFDLENBQUMwVCxNQUFGLEdBQVUsWUFBSTtFQUFDLFFBQUcsQ0FBQ3hRLENBQUosRUFBTSxPQUFPLEtBQUt4SCxDQUFDLENBQUMsSUFBSW1HLEtBQUosQ0FBVSxtQ0FBVixDQUFELENBQWI7RUFBOERxQixJQUFBQSxDQUFDLENBQUNxSyxLQUFGLEdBQVF2TixDQUFDLENBQUN1TixLQUFWLEVBQWdCckssQ0FBQyxDQUFDc0ssTUFBRixHQUFTeE4sQ0FBQyxDQUFDd04sTUFBM0I7RUFBa0MsUUFBTS9SLENBQUMsR0FBQ3lILENBQUMsQ0FBQ3lRLFVBQUYsQ0FBYSxJQUFiLENBQVI7RUFBMkJsWSxJQUFBQSxDQUFDLENBQUNtWSxTQUFGLENBQVk1VCxDQUFaLEVBQWMsQ0FBZCxFQUFnQixDQUFoQixFQUFrQkEsQ0FBQyxDQUFDdU4sS0FBcEIsRUFBMEJ2TixDQUFDLENBQUN3TixNQUE1QjtFQUFvQyxRQUFNelAsQ0FBQyxHQUFDdEMsQ0FBQyxDQUFDb1ksWUFBRixDQUFlLENBQWYsRUFBaUIsQ0FBakIsRUFBbUI3VCxDQUFDLENBQUN1TixLQUFyQixFQUEyQnZOLENBQUMsQ0FBQ3dOLE1BQTdCLENBQVI7RUFBQSxRQUE2QzdOLENBQUMsR0FBQztFQUFDNE4sTUFBQUEsS0FBSyxFQUFDdk4sQ0FBQyxDQUFDdU4sS0FBVDtFQUFlQyxNQUFBQSxNQUFNLEVBQUN4TixDQUFDLENBQUN3TixNQUF4QjtFQUErQnBGLE1BQUFBLElBQUksRUFBQyxJQUFJMEQsVUFBSixDQUFlL04sQ0FBQyxDQUFDcUssSUFBakI7RUFBcEMsS0FBL0M7RUFBMkcxTSxJQUFBQSxDQUFDLENBQUMsSUFBRCxFQUFNaUUsQ0FBTixDQUFEO0VBQVUsR0FBelMsRUFBMlNLLENBQUMsQ0FBQzhULE9BQUYsR0FBVSxVQUFTclksQ0FBVCxFQUFXO0VBQUNDLElBQUFBLENBQUMsQ0FBQ0QsQ0FBRCxDQUFEO0VBQUssR0FBdFUsRUFBdVV1RSxDQUFDLENBQUM3RSxHQUFGLEdBQU1NLENBQTdVO0VBQStVOztFQ0NsdGhCLElBQUlzWSxNQUFNLEdBQUcsRUFBYjs7RUFDQSxLQUFLLElBQUlqWixHQUFDLEdBQUcsQ0FBYixFQUFnQkEsR0FBQyxHQUFHLENBQXBCLEVBQXVCQSxHQUFDLEVBQXhCLEVBQTRCO0VBQ3hCaVosRUFBQUEsTUFBTSxDQUFDalosR0FBRCxDQUFOLEdBQVksRUFBWjtFQUNIO0VBa0JELElBQUlvRyxHQUFDLEdBQUcsRUFBUjtBQUVBLEVBQU8sU0FBUzhTLGFBQVQsQ0FBdUJyWCxNQUF2QixFQUErQnNYLEdBQS9CLEVBQW9DQyxJQUFwQyxFQUEwQztFQUM3Q0MsRUFBQUEsU0FBUyxDQUFDeFgsTUFBRCxDQUFUOztFQUNBLE9BQUssSUFBSTdCLENBQUMsR0FBRyxDQUFiLEVBQWdCQSxDQUFDLEdBQUcsQ0FBcEIsRUFBdUJBLENBQUMsRUFBeEIsRUFBNEI7RUFDeEIsUUFBSW9aLElBQUksSUFBSUEsSUFBSSxDQUFDRSxNQUFMLENBQVl0WixDQUFaLE1BQW1CLEdBQS9CLEVBQW9DO0VBQ2hDO0VBQ0g7O0VBQ0QsUUFBSXVaLEtBQUssR0FBR04sTUFBTSxDQUFDalosQ0FBRCxDQUFsQjtFQUVBb0csSUFBQUEsR0FBQyxDQUFDLENBQUQsQ0FBRCxHQUFPbVQsS0FBSyxDQUFDLENBQUQsQ0FBTCxHQUFXLENBQVgsR0FBZUosR0FBRyxDQUFDLENBQUQsQ0FBSCxDQUFPLENBQVAsQ0FBZixHQUEyQkEsR0FBRyxDQUFDLENBQUQsQ0FBSCxDQUFPLENBQVAsQ0FBbEM7RUFDQS9TLElBQUFBLEdBQUMsQ0FBQyxDQUFELENBQUQsR0FBT21ULEtBQUssQ0FBQyxDQUFELENBQUwsR0FBVyxDQUFYLEdBQWVKLEdBQUcsQ0FBQyxDQUFELENBQUgsQ0FBTyxDQUFQLENBQWYsR0FBMkJBLEdBQUcsQ0FBQyxDQUFELENBQUgsQ0FBTyxDQUFQLENBQWxDO0VBQ0EvUyxJQUFBQSxHQUFDLENBQUMsQ0FBRCxDQUFELEdBQU9tVCxLQUFLLENBQUMsQ0FBRCxDQUFMLEdBQVcsQ0FBWCxHQUFlSixHQUFHLENBQUMsQ0FBRCxDQUFILENBQU8sQ0FBUCxDQUFmLEdBQTJCQSxHQUFHLENBQUMsQ0FBRCxDQUFILENBQU8sQ0FBUCxDQUFsQzs7RUFFQSxRQUFJSyxlQUFlLENBQUNELEtBQUQsRUFBUW5ULEdBQVIsQ0FBZixHQUE0QixDQUFoQyxFQUFtQztFQUMvQixhQUFPLEtBQVA7RUFDSDtFQUNKOztFQUVELFNBQU8sSUFBUDtFQUNIOztFQUVELFNBQVNpVCxTQUFULENBQW1CaFgsQ0FBbkIsRUFBc0I7RUFDbEIsTUFBSW9YLEVBQUUsR0FBR3BYLENBQVQ7RUFDQSxNQUFJcVgsR0FBRyxHQUFHRCxFQUFFLENBQUMsQ0FBRCxDQUFaO0VBQUEsTUFBaUJFLEdBQUcsR0FBR0YsRUFBRSxDQUFDLENBQUQsQ0FBekI7RUFBQSxNQUE4QkcsR0FBRyxHQUFHSCxFQUFFLENBQUMsQ0FBRCxDQUF0QztFQUFBLE1BQTJDSSxHQUFHLEdBQUdKLEVBQUUsQ0FBQyxDQUFELENBQW5EO0VBQ0EsTUFBSUssR0FBRyxHQUFHTCxFQUFFLENBQUMsQ0FBRCxDQUFaO0VBQUEsTUFBaUJNLEdBQUcsR0FBR04sRUFBRSxDQUFDLENBQUQsQ0FBekI7RUFBQSxNQUE4Qk8sR0FBRyxHQUFHUCxFQUFFLENBQUMsQ0FBRCxDQUF0QztFQUFBLE1BQTJDUSxHQUFHLEdBQUdSLEVBQUUsQ0FBQyxDQUFELENBQW5EO0VBQ0EsTUFBSVMsR0FBRyxHQUFHVCxFQUFFLENBQUMsQ0FBRCxDQUFaO0VBQUEsTUFBaUJVLEdBQUcsR0FBR1YsRUFBRSxDQUFDLENBQUQsQ0FBekI7RUFBQSxNQUE4QlcsSUFBSSxHQUFHWCxFQUFFLENBQUMsRUFBRCxDQUF2QztFQUFBLE1BQTZDWSxJQUFJLEdBQUdaLEVBQUUsQ0FBQyxFQUFELENBQXREO0VBQ0EsTUFBSWEsSUFBSSxHQUFHYixFQUFFLENBQUMsRUFBRCxDQUFiO0VBQUEsTUFBbUJjLElBQUksR0FBR2QsRUFBRSxDQUFDLEVBQUQsQ0FBNUI7RUFBQSxNQUFrQ2UsSUFBSSxHQUFHZixFQUFFLENBQUMsRUFBRCxDQUEzQztFQUFBLE1BQWlEZ0IsSUFBSSxHQUFHaEIsRUFBRSxDQUFDLEVBQUQsQ0FBMUQ7RUFHQWlCLEVBQUFBLGFBQWEsQ0FBQ3pCLE1BQU0sQ0FBQyxDQUFELENBQVAsRUFBWVksR0FBRyxHQUFHSCxHQUFsQixFQUF1Qk8sR0FBRyxHQUFHSCxHQUE3QixFQUFrQ08sSUFBSSxHQUFHSCxHQUF6QyxFQUE4Q08sSUFBSSxHQUFHSCxJQUFyRCxDQUFiO0VBRUFJLEVBQUFBLGFBQWEsQ0FBQ3pCLE1BQU0sQ0FBQyxDQUFELENBQVAsRUFBWVksR0FBRyxHQUFHSCxHQUFsQixFQUF1Qk8sR0FBRyxHQUFHSCxHQUE3QixFQUFrQ08sSUFBSSxHQUFHSCxHQUF6QyxFQUE4Q08sSUFBSSxHQUFHSCxJQUFyRCxDQUFiO0VBRUFJLEVBQUFBLGFBQWEsQ0FBQ3pCLE1BQU0sQ0FBQyxDQUFELENBQVAsRUFBWVksR0FBRyxHQUFHRixHQUFsQixFQUF1Qk0sR0FBRyxHQUFHRixHQUE3QixFQUFrQ00sSUFBSSxHQUFHRixHQUF6QyxFQUE4Q00sSUFBSSxHQUFHRixJQUFyRCxDQUFiO0VBRUFHLEVBQUFBLGFBQWEsQ0FBQ3pCLE1BQU0sQ0FBQyxDQUFELENBQVAsRUFBWVksR0FBRyxHQUFHRixHQUFsQixFQUF1Qk0sR0FBRyxHQUFHRixHQUE3QixFQUFrQ00sSUFBSSxHQUFHRixHQUF6QyxFQUE4Q00sSUFBSSxHQUFHRixJQUFyRCxDQUFiO0VBRUFHLEVBQUFBLGFBQWEsQ0FBQ3pCLE1BQU0sQ0FBQyxDQUFELENBQVAsRUFBWVksR0FBRyxHQUFHRCxHQUFsQixFQUF1QkssR0FBRyxHQUFHRCxHQUE3QixFQUFrQ0ssSUFBSSxHQUFHRCxJQUF6QyxFQUErQ0ssSUFBSSxHQUFHRCxJQUF0RCxDQUFiO0VBRUFFLEVBQUFBLGFBQWEsQ0FBQ3pCLE1BQU0sQ0FBQyxDQUFELENBQVAsRUFBWVksR0FBRyxHQUFHRCxHQUFsQixFQUF1QkssR0FBRyxHQUFHRCxHQUE3QixFQUFrQ0ssSUFBSSxHQUFHRCxJQUF6QyxFQUErQ0ssSUFBSSxHQUFHRCxJQUF0RCxDQUFiO0VBQ0g7O0VBRUQsSUFBSUcsWUFBWSxHQUFHLE1BQU0sQ0FBekI7O0VBQ0EsU0FBU0QsYUFBVCxDQUF1QjVTLEdBQXZCLEVBQTRCSSxDQUE1QixFQUErQmhDLENBQS9CLEVBQWtDaUMsQ0FBbEMsRUFBcUNDLENBQXJDLEVBQXdDO0VBQ3BDTixFQUFBQSxHQUFHLENBQUMsQ0FBRCxDQUFILEdBQVNJLENBQUMsR0FBR3lTLFlBQWI7RUFDQTdTLEVBQUFBLEdBQUcsQ0FBQyxDQUFELENBQUgsR0FBUzVCLENBQUMsR0FBR3lVLFlBQWI7RUFDQTdTLEVBQUFBLEdBQUcsQ0FBQyxDQUFELENBQUgsR0FBU0ssQ0FBQyxHQUFHd1MsWUFBYjtFQUNBN1MsRUFBQUEsR0FBRyxDQUFDLENBQUQsQ0FBSCxHQUFTTSxDQUFDLEdBQUd1UyxZQUFiO0VBQ0EsU0FBTzdTLEdBQVA7RUFDSDs7RUFFRCxTQUFTMFIsZUFBVCxDQUF5QkQsS0FBekIsRUFBZ0NuVCxDQUFoQyxFQUFtQztFQUMvQixTQUFPbVQsS0FBSyxDQUFDLENBQUQsQ0FBTCxHQUFXblQsQ0FBQyxDQUFDLENBQUQsQ0FBWixHQUFrQm1ULEtBQUssQ0FBQyxDQUFELENBQUwsR0FBV25ULENBQUMsQ0FBQyxDQUFELENBQTlCLEdBQW9DbVQsS0FBSyxDQUFDLENBQUQsQ0FBTCxHQUFXblQsQ0FBQyxDQUFDLENBQUQsQ0FBaEQsR0FBc0RtVCxLQUFLLENBQUMsQ0FBRCxDQUFsRTtFQUNIOztFQ2pGRCxJQUFNcUIsVUFBVSxHQUFHLEVBQW5COztNQ0VxQkM7RUFDakIsZ0JBQVkxRCxNQUFaLEVBQW9CMkQscUJBQXBCLEVBQTJDQyxZQUEzQyxFQUF5RDtFQUNyRCxTQUFLNUQsTUFBTCxHQUFjQSxNQUFkO0VBQ0EsU0FBS1MsbUJBQUwsR0FBMkIsRUFBM0I7RUFDQSxTQUFLb0QsYUFBTCxHQUFxQixFQUFyQjtFQUNBLFNBQUtDLFNBQUwsR0FBaUIsSUFBSS9YLFlBQUosQ0FBaUJpVSxNQUFNLENBQUNuWixNQUFQLEdBQWdCLEVBQWpDLENBQWpCOztFQUNBLFNBQUssSUFBSWdDLENBQUMsR0FBRyxDQUFiLEVBQWdCQSxDQUFDLEdBQUdtWCxNQUFNLENBQUNuWixNQUEzQixFQUFtQyxFQUFFZ0MsQ0FBckMsRUFBd0M7RUFDcEMsV0FBSzRYLG1CQUFMLENBQXlCM1gsSUFBekIsQ0FBOEIsSUFBSWlELFlBQUosQ0FDMUI0WCxxQkFBcUIsQ0FBQzNLLE1BREksRUFFMUIySyxxQkFBcUIsQ0FBQ3JLLFVBQXRCLEdBQW1Ddk4sWUFBWSxDQUFDNE4saUJBQWIsR0FBaUMsRUFBakMsR0FBc0M5USxDQUYvQyxFQUcxQixFQUgwQixDQUE5QjtFQUlBLFdBQUtnYixhQUFMLENBQW1CL2EsSUFBbkIsQ0FBd0IsSUFBSWlELFlBQUosQ0FDcEIsS0FBSytYLFNBQUwsQ0FBZTlLLE1BREssRUFFcEJqTixZQUFZLENBQUM0TixpQkFBYixHQUFpQyxFQUFqQyxHQUFzQzlRLENBRmxCLEVBR3BCLEVBSG9CLENBQXhCO0VBSUg7O0VBQ0QsU0FBSythLFlBQUwsR0FBb0JBLFlBQXBCO0VBQ0EsU0FBS0csZ0JBQUwsR0FBd0IsQ0FBQyxDQUFELEVBQUksQ0FBSixDQUF4QjtFQUNIOzs7O1dBRURDLFNBQUEsZ0JBQU9DLFVBQVAsRUFBbUI7RUFDZixRQUFNQyxrQkFBa0IsR0FBRyxFQUEzQjtFQUNBQyxJQUFBQSxPQUFJLENBQUNDLE1BQUwsQ0FBWUYsa0JBQVosRUFBZ0NELFVBQWhDOztFQUNBLFNBQUssSUFBSS9QLENBQUMsR0FBRyxDQUFiLEVBQWdCQSxDQUFDLEdBQUcsS0FBSzhMLE1BQUwsQ0FBWW5aLE1BQWhDLEVBQXdDLEVBQUVxTixDQUExQyxFQUE2QztFQUN6QyxVQUFNbVEsS0FBSyxHQUFHLEtBQUtyRSxNQUFMLENBQVk5TCxDQUFaLENBQWQ7RUFDQSxVQUFNL0ksR0FBRyxHQUFHLEtBQUswWSxhQUFMLENBQW1CM1AsQ0FBbkIsQ0FBWjtFQUNBaVEsTUFBQUEsT0FBSSxDQUFDRyxRQUFMLENBQWNuWixHQUFkLEVBQW1CK1ksa0JBQW5CLEVBQXVDRyxLQUFLLENBQUNKLFVBQTdDO0VBQ0FFLE1BQUFBLE9BQUksQ0FBQ0csUUFBTCxDQUFjblosR0FBZCxFQUFtQkEsR0FBbkIsRUFBd0IsS0FBS3NWLG1CQUFMLENBQXlCdk0sQ0FBekIsQ0FBeEI7RUFDSDs7RUFDRCxTQUFLMFAsWUFBTCxDQUFrQjtFQUNkdEksTUFBQUEsS0FBSyxFQUFHLENBRE07RUFFZGxELE1BQUFBLElBQUksRUFBRyxPQUZPO0VBR2RtRCxNQUFBQSxNQUFNLEVBQUcsS0FBS3lFLE1BQUwsQ0FBWW5aLE1BSFA7RUFJZHNQLE1BQUFBLElBQUksRUFBRyxLQUFLMk47RUFKRSxLQUFsQjtFQU1IOzs7OztNQ3BDZ0JTO0VBQ2pCLGVBQVlyYSxXQUFaLEVBQXFDcU4sUUFBckMsRUFBOERuTixLQUE5RCxFQUFpRjtFQUFBLFFBQXJFRixXQUFxRTtFQUFyRUEsTUFBQUEsV0FBcUUsR0FBdkQsQ0FBQyxDQUFELEVBQUksQ0FBSixFQUFPLENBQVAsQ0FBdUQ7RUFBQTs7RUFBQSxRQUE1Q3FOLFFBQTRDO0VBQTVDQSxNQUFBQSxRQUE0QyxHQUFqQyxDQUFDLENBQUQsRUFBSSxDQUFKLEVBQU8sQ0FBUCxFQUFVLENBQVYsQ0FBaUM7RUFBQTs7RUFBQSxRQUFuQm5OLEtBQW1CO0VBQW5CQSxNQUFBQSxLQUFtQixHQUFYLENBQUMsQ0FBRCxFQUFJLENBQUosRUFBTyxDQUFQLENBQVc7RUFBQTs7RUFDN0UsU0FBS0YsV0FBTCxHQUFtQkEsV0FBbkI7RUFDQSxTQUFLcU4sUUFBTCxHQUFnQkEsUUFBaEI7RUFDQSxTQUFLbk4sS0FBTCxHQUFhQSxLQUFiO0VBQ0g7Ozs7V0FDRG9hLFlBQUEsbUJBQVVyWixHQUFWLEVBQWU7RUFDWEEsSUFBQUEsR0FBRyxHQUFHQSxHQUFHLElBQUksSUFBSVksWUFBSixDQUFpQixFQUFqQixDQUFiO0VBQ0FvWSxJQUFBQSxPQUFJLENBQUN0VCw0QkFBTCxDQUFrQzFGLEdBQWxDLEVBQXVDLEtBQUtvTSxRQUE1QyxFQUFzRCxLQUFLck4sV0FBM0QsRUFBd0UsS0FBS0UsS0FBN0U7RUFDQSxXQUFPZSxHQUFQO0VBQ0g7Ozs7O0VDRkwsSUFBSXNaLGNBQWMsR0FBRyxHQUFyQjtFQUNBLElBQU1DLFdBQVcsbXZCQUFqQjtFQXNCQSxJQUFNQyxPQUFPLG8zQkFBYjtFQXlCQSxJQUFNQyxPQUFPLHVFQUFiO0VBTUEsSUFBTUMsRUFBRSxHQUFHLEVBQVg7RUFBQSxJQUFlQyxFQUFFLEdBQUcsRUFBcEI7RUFDQSxJQUFNQyxLQUFLLEdBQUcsQ0FBQyxRQUFELEVBQVcsT0FBWCxFQUFvQixZQUFwQixFQUFrQyxXQUFsQyxFQUErQyxXQUEvQyxFQUE0RCxnQkFBNUQsRUFBOEUsY0FBOUUsQ0FBZDtFQUVBLElBQU1DLGVBQWUsR0FBRztFQUNwQixVQUFRLFNBRFk7RUFFcEIsVUFBUSxRQUZZO0VBR3BCLFVBQVEsd0JBSFk7RUFJcEIsVUFBUSx1QkFKWTtFQUtwQixVQUFRLHVCQUxZO0VBTXBCLFVBQVEsc0JBTlk7RUFPcEIsV0FBUyxlQVBXO0VBUXBCLFdBQVMsaUJBUlc7RUFTcEIsV0FBUztFQVRXLENBQXhCO0VBWUEsSUFBTUMsbUJBQW1CLEdBQUcsR0FBNUI7O01BRU1DOzs7RUFFRiw2QkFBWUMsS0FBWixFQUFtQjtFQUFBOztFQUNmLDZDQUFNQSxLQUFOO0VBQ0EsVUFBS0MsVUFBTCxHQUFrQixFQUFsQjtFQUNBLFVBQUtDLFdBQUwsR0FBbUIsRUFBbkI7RUFDQSxVQUFLQyxXQUFMLEdBQW1CLEVBQW5CO0VBQ0EsVUFBS0MsSUFBTCxHQUFZLEdBQVo7O0VBQ0EsVUFBS0MsV0FBTDs7RUFOZTtFQU9sQjs7OztXQUVEQyxPQUFBLGNBQUtDLFNBQUwsRUFBZ0I7RUFDWmpCLElBQUFBLGNBQWMsR0FBR2lCLFNBQWpCO0VBQ0EsU0FBS0MsYUFBTDs7RUFDQSxTQUFLQyxZQUFMO0VBQ0g7O1dBRURDLG9CQUFBLDJCQUFrQnJjLENBQWxCLEVBQXFCa2MsU0FBckIsRUFBZ0M7RUFDNUJqQixJQUFBQSxjQUFjLEdBQUdpQixTQUFqQjs7RUFDQSxTQUFLRSxZQUFMO0VBQ0g7O1dBRURFLGVBQUEsd0JBQWU7RUFDWCxTQUFLLElBQU1DLEdBQVgsSUFBa0IsS0FBS1osS0FBTCxDQUFXYSxVQUE3QixFQUF5QztFQUNyQyxVQUFNQyxNQUFNLEdBQUcsS0FBS2QsS0FBTCxDQUFXYSxVQUFYLENBQXNCRCxHQUF0QixDQUFmOztFQUNBLFVBQUlFLE1BQU0sQ0FBQ0MsT0FBUCxFQUFKLEVBQXNCO0VBQ2xCLGVBQU8sSUFBUDtFQUNIO0VBQ0o7O0VBQ0QsMkNBQWFKLFlBQWI7RUFDSDs7V0FFREssWUFBQSxxQkFBWTtFQUNSLFdBQU8sS0FBUDtFQUNIOztXQUVEQyxnQkFBQSx5QkFBZ0I7RUFDWixRQUFJLEtBQUtDLE1BQUwsQ0FBWUMsRUFBWixJQUFrQixLQUFLRCxNQUFMLENBQVlDLEVBQVosQ0FBZUMsSUFBckMsRUFBMkM7RUFDdkMsV0FBS0QsRUFBTCxHQUFVLEtBQUtELE1BQUwsQ0FBWUMsRUFBWixDQUFlQyxJQUFmLEVBQVY7RUFDSCxLQUZELE1BRU87RUFDSCxVQUFNcEIsS0FBSyxHQUFHLEtBQUtBLEtBQW5CO0VBQ0EsVUFBTTNXLFVBQVUsR0FBRzJXLEtBQUssQ0FBQ2xHLE9BQU4sQ0FBY3VILFNBQWQsSUFBMkI7RUFDMUNDLFFBQUFBLEtBQUssRUFBRSxJQURtQztFQUUxQ0MsUUFBQUEsS0FBSyxFQUFFLElBRm1DO0VBSTFDQyxRQUFBQSxPQUFPLEVBQUU7RUFKaUMsT0FBOUM7RUFNQSxXQUFLSCxTQUFMLEdBQWlCaFksVUFBakI7RUFDQSxXQUFLOFgsRUFBTCxHQUFVLEtBQUtBLEVBQUwsSUFBVyxLQUFLTSxnQkFBTCxDQUFzQixLQUFLUCxNQUEzQixFQUFtQzdYLFVBQW5DLENBQXJCO0VBQ0g7O0VBQ0QsU0FBS3FZLElBQUwsR0FBWUMsYUFBVSxDQUFDO0VBQ25CUixNQUFBQSxFQUFFLEVBQUUsS0FBS0EsRUFEVTtFQUVuQjdLLE1BQUFBLFVBQVUsRUFBRSxDQUNSLHdCQURRLEVBRVIsbUJBRlEsRUFJUix3QkFKUSxFQUtSLDBCQUxRLEVBTVIsd0JBTlEsQ0FGTztFQVVuQnNMLE1BQUFBLGtCQUFrQixFQUFFLEtBQUs1QixLQUFMLENBQVdsRyxPQUFYLENBQW1CLGNBQW5CLEtBQXNDO0VBVnZDLEtBQUQsQ0FBdEI7O0VBWUEsU0FBSytILGFBQUw7O0VBQ0EsU0FBSzdCLEtBQUwsQ0FBVzhCLElBQVgsQ0FBZ0IsZUFBaEIsRUFBaUM7RUFBRUMsTUFBQUEsT0FBTyxFQUFFLEtBQUtaO0VBQWhCLEtBQWpDO0VBQ0g7O1dBRURVLGdCQUFBLHlCQUFnQjtFQUNaLFFBQU1oZixHQUFHLEdBQUcsS0FBS21kLEtBQUwsQ0FBV2dDLE1BQVgsRUFBWjtFQUNBLFFBQU1DLFFBQVEsR0FBRyxJQUFJQyxXQUFRLENBQUNDLFFBQWIsQ0FBc0IsS0FBS1QsSUFBM0IsQ0FBakI7RUFDQSxTQUFLTyxRQUFMLEdBQWdCQSxRQUFoQjtFQUNBLFNBQUtHLFNBQUwsR0FBaUI7RUFDYixvQkFBY3ZmLEdBQUcsQ0FBQ3dmLFVBREw7RUFFYix3QkFBa0J4ZixHQUFHLENBQUN5ZixjQUZUO0VBR2Isb0JBQWN6ZixHQUFHLENBQUMwZixVQUhMO0VBSWIsaUJBQVcxZixHQUFHLENBQUMyZjtFQUpGLEtBQWpCO0VBTUEsU0FBS0MsVUFBTCxHQUFrQixLQUFLZixJQUFMLENBQVVnQixXQUFWLENBQXNCN2YsR0FBRyxDQUFDc1QsS0FBMUIsRUFBaUN0VCxHQUFHLENBQUN1VCxNQUFyQyxDQUFsQjtFQUNBLFNBQUt1TSxRQUFMLEdBQWdCLElBQUlULFdBQVEsQ0FBQ1UsYUFBYixDQUNaWCxRQURZLEVBRVo7RUFDSVksTUFBQUEsSUFBSSxFQUFFdEQsV0FEVjtFQUVJdUQsTUFBQUEsUUFBUSxFQUFFLENBQ047RUFDSTdRLFFBQUFBLElBQUksRUFBRSxxQkFEVjtFQUVJZ0IsUUFBQUEsSUFBSSxFQUFFLFVBRlY7RUFHSXRGLFFBQUFBLEVBQUUsRUFBRSxZQUFVb1UsT0FBVixFQUFtQmdCLEtBQW5CLEVBQTBCO0VBQzFCLGlCQUFPL0QsT0FBSSxDQUFDRyxRQUFMLENBQWMsRUFBZCxFQUFrQjRELEtBQUssQ0FBQyxnQkFBRCxDQUF2QixFQUEyQ0EsS0FBSyxDQUFDLGFBQUQsQ0FBaEQsQ0FBUDtFQUNIO0VBTEwsT0FETSxFQVFOLGdCQVJNLEVBU04sWUFUTTtFQUZkLEtBRlksRUFnQlosS0FBS04sVUFoQk8sQ0FBaEI7RUFrQkg7O1dBRURwQyxjQUFBLHVCQUFjO0VBQUE7O0VBRVYsUUFBTTJDLFNBQVMsR0FBRzFFLFVBQWxCOztFQUNBLFNBQUssSUFBTXJNLElBQVgsSUFBbUIrUSxTQUFuQixFQUE4QjtFQUMxQixVQUFNQyxNQUFNLEdBQUdELFNBQVMsQ0FBQy9RLElBQUQsQ0FBeEI7O0VBQ0EsV0FBS2lSLGVBQUwsQ0FBcUJELE1BQU0sQ0FBQ2hSLElBQTVCLEVBQWtDZ1IsTUFBTSxDQUFDaFEsSUFBekMsRUFBK0NnUSxNQUFNLENBQUNFLE1BQXRELEVBQThERixNQUFNLENBQUNILFFBQXJFO0VBQ0g7O0VBQ0QsUUFBTU0sUUFBUSxHQUFHO0VBQ2J4WCxNQUFBQSxDQUFDLEVBQUUsQ0FEVTtFQUViaEMsTUFBQUEsQ0FBQyxFQUFFLENBRlU7RUFHYnVNLE1BQUFBLEtBQUssRUFBRSxpQkFBTTtFQUNULGVBQU8sTUFBSSxDQUFDK0ssTUFBTCxHQUFjLE1BQUksQ0FBQ0EsTUFBTCxDQUFZL0ssS0FBMUIsR0FBa0MsQ0FBekM7RUFDSCxPQUxZO0VBTWJDLE1BQUFBLE1BQU0sRUFBRSxrQkFBTTtFQUNWLGVBQU8sTUFBSSxDQUFDOEssTUFBTCxHQUFjLE1BQUksQ0FBQ0EsTUFBTCxDQUFZOUssTUFBMUIsR0FBbUMsQ0FBMUM7RUFDSDtFQVJZLEtBQWpCO0VBVUEsU0FBS2lOLFlBQUwsR0FBb0IsSUFBSW5CLFdBQVEsQ0FBQ29CLFVBQWIsQ0FBd0I7RUFDeENULE1BQUFBLElBQUksRUFBR3JELE9BRGlDO0VBRXhDK0QsTUFBQUEsSUFBSSxFQUFHOUQsT0FGaUM7RUFHeENxRCxNQUFBQSxRQUFRLEVBQUcsQ0FDUCxnQkFETyxFQUVQLFNBRk8sRUFHUCxTQUhPLEVBSVA7RUFDSTdRLFFBQUFBLElBQUksRUFBRyxxQkFEWDtFQUVJZ0IsUUFBQUEsSUFBSSxFQUFHLFVBRlg7RUFHSXRGLFFBQUFBLEVBQUUsRUFBRyxZQUFVb1UsT0FBVixFQUFtQmdCLEtBQW5CLEVBQTBCO0VBQzNCLGlCQUFPL0QsT0FBSSxDQUFDRyxRQUFMLENBQWMsRUFBZCxFQUFrQjRELEtBQUssQ0FBQyxnQkFBRCxDQUF2QixFQUEyQ0EsS0FBSyxDQUFDLGFBQUQsQ0FBaEQsQ0FBUDtFQUNIO0VBTEwsT0FKTyxDQUg2QjtFQWV4Q1MsTUFBQUEsT0FBTyxFQUFHLEVBZjhCO0VBaUJ4Q0MsTUFBQUEsaUJBQWlCLEVBQUc7RUFBRUwsUUFBQUEsUUFBUSxFQUFSQTtFQUFGO0VBakJvQixLQUF4QixDQUFwQjtFQW1CSDs7V0FFRE0sb0JBQUEsMkJBQWtCNUMsTUFBbEIsRUFBMEI7RUFDdEIsUUFBTW1DLE1BQU0sR0FBR25DLE1BQU0sQ0FBQzZDLFNBQVAsRUFBZjs7RUFDQSxRQUFNQyxjQUFjLEdBQUcsS0FBSzFELFdBQUwsQ0FBaUJZLE1BQU0sQ0FBQytDLE1BQVAsRUFBakIsQ0FBdkI7O0VBQ0EsUUFBSVosTUFBTSxLQUFLLFdBQVgsSUFBMEJXLGNBQTlCLEVBQThDO0VBQzFDQSxNQUFBQSxjQUFjLENBQUNFLFVBQWYsQ0FBMEJ4VyxPQUExQixDQUFrQyxVQUFBeVcsU0FBUyxFQUFJO0VBQzNDQSxRQUFBQSxTQUFTLENBQUNDLFFBQVYsQ0FBbUJDLGlCQUFuQjs7RUFFQSxZQUFJLENBQUNGLFNBQVMsQ0FBQ0MsUUFBVixDQUFtQmhULElBQW5CLENBQXdCa1QsWUFBN0IsRUFBMkM7RUFDdkNILFVBQUFBLFNBQVMsQ0FBQ0MsUUFBVixDQUFtQkcsaUJBQW5CLENBQXFDLGNBQXJDO0VBQ0g7RUFDSixPQU5EO0VBT0g7RUFDSjs7V0FFRGpCLGtCQUFBLHlCQUFnQmpSLElBQWhCLEVBQXNCZ0IsSUFBdEIsRUFBNEJrUSxNQUE1QixFQUFvQ3hOLFFBQXBDLEVBQThDO0VBQUE7O0VBQzFDLFFBQU15TixRQUFRLEdBQUc7RUFDYnhYLE1BQUFBLENBQUMsRUFBRSxDQURVO0VBRWJoQyxNQUFBQSxDQUFDLEVBQUUsQ0FGVTtFQUdidU0sTUFBQUEsS0FBSyxFQUFFLGlCQUFNO0VBQ1QsZUFBTyxNQUFJLENBQUMrSyxNQUFMLEdBQWMsTUFBSSxDQUFDQSxNQUFMLENBQVkvSyxLQUExQixHQUFrQyxDQUF6QztFQUNILE9BTFk7RUFNYkMsTUFBQUEsTUFBTSxFQUFFLGtCQUFNO0VBQ1YsZUFBTyxNQUFJLENBQUM4SyxNQUFMLEdBQWMsTUFBSSxDQUFDQSxNQUFMLENBQVk5SyxNQUExQixHQUFtQyxDQUExQztFQUNIO0VBUlksS0FBakI7O0VBVUEsUUFBSSxDQUFDK00sTUFBTSxDQUFDTSxpQkFBWixFQUErQjtFQUMzQk4sTUFBQUEsTUFBTSxDQUFDTSxpQkFBUCxHQUEyQixFQUEzQjtFQUNIOztFQUVELFFBQU1XLFVBQVUsR0FBR0MsYUFBQSxDQUFjemdCLE1BQWQsQ0FBcUIsRUFBckIsRUFBeUJ1ZixNQUF6QixDQUFuQjtFQUNBaUIsSUFBQUEsVUFBVSxDQUFDWCxpQkFBWCxHQUErQlksYUFBQSxDQUFjemdCLE1BQWQsQ0FBcUIsRUFBckIsRUFBeUJ1ZixNQUFNLENBQUNNLGlCQUFoQyxDQUEvQjtFQUNBVyxJQUFBQSxVQUFVLENBQUNYLGlCQUFYLENBQTZCTCxRQUE3QixHQUF3Q0EsUUFBeEM7RUFDQSxRQUFJa0IsWUFBWSxHQUFHLElBQW5COztFQUNBLFFBQUksRUFBRTNPLFFBQVEsWUFBWXVNLFdBQVEsQ0FBQ3FDLFFBQS9CLENBQUosRUFBOEM7RUFDMUNELE1BQUFBLFlBQVksR0FBR0QsYUFBQSxDQUFjemdCLE1BQWQsQ0FBcUIsRUFBckIsRUFBeUIrUixRQUF6QixDQUFmO0VBQ0g7O0VBQ0QsUUFBSXNOLE1BQUo7O0VBRUEsUUFBSWhRLElBQUksQ0FBQ3RRLE9BQUwsQ0FBYSxHQUFiLElBQW9CLENBQUMsQ0FBekIsRUFBNEI7RUFDeEJzUSxNQUFBQSxJQUFJLEdBQUdBLElBQUksQ0FBQ3VSLEtBQUwsQ0FBVyxHQUFYLENBQVA7RUFDQSxVQUFNQyxTQUFTLEdBQUd4UixJQUFJLENBQUMsQ0FBRCxDQUF0QjtFQUNBQSxNQUFBQSxJQUFJLEdBQUdBLElBQUksQ0FBQyxDQUFELENBQVg7RUFDQWdRLE1BQUFBLE1BQU0sR0FBRyxJQUFJZixXQUFRLENBQUN1QyxTQUFELENBQVIsQ0FBb0J4UixJQUFwQixDQUFKLENBQThCbVIsVUFBOUIsQ0FBVDtFQUNILEtBTEQsTUFLTztFQUNIbkIsTUFBQUEsTUFBTSxHQUFHLElBQUlmLFdBQVEsQ0FBQ2pQLElBQUQsQ0FBWixDQUFtQm1SLFVBQW5CLENBQVQ7RUFDSDs7RUFDRCxTQUFLakUsV0FBTCxDQUFpQmxPLElBQWpCLElBQXlCO0VBQ3JCZ1IsTUFBQUEsTUFBTSxFQUFOQSxNQURxQjtFQUVyQnROLE1BQUFBLFFBQVEsRUFBUkEsUUFGcUI7RUFHckJtTixNQUFBQSxRQUFRLEVBQUV3QjtFQUhXLEtBQXpCO0VBS0EsU0FBS0ksY0FBTCxHQUFzQixLQUFLdkUsV0FBM0I7RUFDSDs7V0FFRHdFLGNBQUEsdUJBQWM7RUFDVixRQUFJLENBQUMsS0FBS3pELE1BQVYsRUFBa0I7RUFDZDtFQUNIOztFQUNELFNBQUtRLElBQUwsQ0FBVWtELEtBQVYsQ0FBZ0I7RUFDWkMsTUFBQUEsS0FBSyxFQUFFLENBQUMsQ0FBRCxFQUFJLENBQUosRUFBTyxDQUFQLEVBQVUsQ0FBVixDQURLO0VBRVp0RCxNQUFBQSxLQUFLLEVBQUUsQ0FGSztFQUdaQyxNQUFBQSxPQUFPLEVBQUU7RUFIRyxLQUFoQjs7RUFLQSxvQ0FBTW1ELFdBQU47RUFDSDs7V0FFREcsZUFBQSxzQkFBYUMsSUFBYixFQUFtQjtFQUNmLG9DQUFNRCxZQUFOLFlBQW1CQyxJQUFuQjs7RUFDQSxRQUFJLEtBQUt0QyxVQUFULEVBQXFCO0VBQ2pCLFdBQUtBLFVBQUwsQ0FBZ0J1QyxNQUFoQixDQUF1QixLQUFLOUQsTUFBTCxDQUFZL0ssS0FBbkMsRUFBMEMsS0FBSytLLE1BQUwsQ0FBWTlLLE1BQXREO0VBQ0g7RUFDSjs7V0FHRHFLLGVBQUEsd0JBQWU7RUFBQTs7RUFDWCxRQUFJd0UsV0FBVyxHQUFHLENBQWxCOztFQUVBLFFBQUk3Z0IsYUFBYSxDQUFDLEtBQUs2YixVQUFOLENBQWIsSUFBa0MsQ0FBQyxLQUFLaUYsWUFBNUMsRUFBMEQ7RUFDdEQ7RUFDSDs7RUFMVSwrQkFRQWpULElBUkE7RUFTUCxVQUFNa1QsY0FBYyxHQUFHLE1BQUksQ0FBQ25GLEtBQUwsQ0FBV29GLFdBQVgsQ0FBdUI5akIsTUFBdkIsQ0FBOEIsVUFBQXdmLE1BQU0sRUFBSTtFQUMzRCxlQUFPQSxNQUFNLENBQUN1RSxTQUFQLE1BQXNCdkUsTUFBTSxDQUFDNkMsU0FBUCxPQUF1QjFSLElBQXBEO0VBQ0gsT0FGc0IsQ0FBdkI7O0VBR0EsVUFBSSxDQUFDa1QsY0FBYyxDQUFDempCLE1BQXBCLEVBQTRCO0VBQ3hCO0VBQ0g7O0VBQ0QsTUFBQSxNQUFJLENBQUM0akIsa0JBQUwsQ0FBd0JILGNBQXhCOztFQUVBLE1BQUEsTUFBSSxDQUFDSSxjQUFMLEdBQXNCLE1BQUksQ0FBQ0MscUJBQUwsQ0FBMkJMLGNBQTNCLENBQXRCOztFQUNBLFVBQUksQ0FBQyxNQUFJLENBQUNJLGNBQVYsRUFBMEI7RUFDdEI7RUFDSDs7RUFDRCxNQUFBLE1BQUksQ0FBQ3RELFFBQUwsQ0FBY3dELE1BQWQsQ0FBcUIsTUFBSSxDQUFDdEYsV0FBTCxDQUFpQmxPLElBQWpCLEVBQXVCZ1IsTUFBNUMsRUFBb0QsTUFBSSxDQUFDYixTQUF6RCxFQUFvRSxNQUFJLENBQUNtRCxjQUF6RSxFQUF5RixJQUF6Rjs7RUFHQU4sTUFBQUEsV0FBVztFQXhCSjs7RUFRWCxTQUFLLElBQU1oVCxJQUFYLElBQW1CLEtBQUtrTyxXQUF4QixFQUFxQztFQUFBLHVCQUExQmxPLElBQTBCOztFQUFBLCtCQVc3QjtFQU1QOztFQUNELFNBQUt5VCxtQkFBTCxHQUEyQixJQUEzQjtFQUVBLFNBQUsxRixLQUFMLENBQVc4QixJQUFYLENBQWdCLHNCQUFoQixFQUF3QztFQUFFcFUsTUFBQUEsS0FBSyxFQUFFdVg7RUFBVCxLQUF4QztFQUNBLFNBQUtVLGNBQUw7RUFDSDs7V0FFREwscUJBQUEsNEJBQW1CTSxPQUFuQixFQUE0QjtFQUFBOztFQUN4QkEsSUFBQUEsT0FBTyxDQUFDdFksT0FBUixDQUFnQixVQUFBd1QsTUFBTSxFQUFJO0VBQ3RCLFVBQUlBLE1BQU0sQ0FBQ0MsT0FBUCxFQUFKLEVBQXNCO0VBQ2xCLFlBQU1ILEdBQUcsR0FBR0UsTUFBTSxDQUFDK0UsSUFBbkI7O0VBQ0EsWUFBSSxDQUFDLE1BQUksQ0FBQzVGLFVBQUwsQ0FBZ0JXLEdBQWhCLENBQUwsRUFBMkI7RUFDdkI7RUFDSDs7RUFDRCxRQUFBLE1BQUksQ0FBQ2tGLGtCQUFMLENBQXdCbEYsR0FBeEI7RUFDSDs7RUFHRCxVQUFJRSxNQUFNLENBQUNpRixVQUFQLE1BQXVCakYsTUFBTSxDQUFDa0YscUJBQVAsRUFBM0IsRUFBMkQ7RUFDdkRsRixRQUFBQSxNQUFNLENBQUNtRixRQUFQLENBQWdCLElBQWhCO0VBQ0gsT0FGRCxNQUVPO0VBQ0huRixRQUFBQSxNQUFNLENBQUNtRixRQUFQLENBQWdCLEtBQWhCO0VBQ0g7RUFDSixLQWZEO0VBZ0JIOztXQUdEVCx3QkFBQSwrQkFBc0JJLE9BQXRCLEVBQStCO0VBQzNCLFFBQU1NLFFBQVEsR0FBRyxFQUFqQjtFQUNBLFFBQU1yakIsR0FBRyxHQUFHLEtBQUttZCxLQUFMLENBQVdnQyxNQUFYLEVBQVo7O0VBQ0EsU0FBSyxJQUFJdGUsSUFBQyxHQUFHLENBQWIsRUFBZ0JBLElBQUMsR0FBR2tpQixPQUFPLENBQUNsa0IsTUFBNUIsRUFBb0NnQyxJQUFDLEVBQXJDLEVBQXlDO0VBQ3JDLFVBQU1vZCxNQUFNLEdBQUc4RSxPQUFPLENBQUNsaUIsSUFBRCxDQUF0QjtFQUNBLFVBQU11WCxLQUFLLEdBQUcsS0FBS2dGLFVBQUwsQ0FBZ0JhLE1BQU0sQ0FBQytFLElBQXZCLENBQWQ7O0VBQ0EsVUFBSSxDQUFDNUssS0FBTCxFQUFZO0VBRVI7RUFDSDs7RUFDRCxVQUFNM0ksTUFBTSxHQUFHMkksS0FBSyxDQUFDa0wsV0FBckI7O0VBQ0EsV0FBSyxJQUFJQyxFQUFFLEdBQUcsQ0FBZCxFQUFpQkEsRUFBRSxHQUFHOVQsTUFBTSxDQUFDNVEsTUFBN0IsRUFBcUMwa0IsRUFBRSxFQUF2QyxFQUEyQztFQUN2QyxZQUFNbFIsSUFBSSxHQUFHNUMsTUFBTSxDQUFDOFQsRUFBRCxDQUFuQjtFQUVBLFlBQU10RCxRQUFRLEdBQUdoQyxNQUFNLENBQUN1RixXQUFQLEVBQWpCOztFQUNBLGFBQUtDLGdCQUFMLENBQXNCcFIsSUFBdEIsRUFBNEI0TixRQUE1Qjs7RUFDQSxZQUFNbk4sUUFBUSxHQUFHbUwsTUFBTSxDQUFDMU4sV0FBUCxFQUFqQjs7RUFDQSxhQUFLLElBQU1yTixDQUFYLElBQWdCNFAsUUFBaEIsRUFBMEI7RUFDdEJULFVBQUFBLElBQUksQ0FBQ1MsUUFBTCxDQUFjNFEsR0FBZCxDQUFrQnhnQixDQUFsQixFQUFxQjRQLFFBQVEsQ0FBQzVQLENBQUQsQ0FBN0I7RUFDSDs7RUFFRCxZQUFJbVAsSUFBSSxZQUFZZ04sV0FBUSxDQUFDc0UsYUFBN0IsRUFBNEM7RUFDeENOLFVBQUFBLFFBQVEsQ0FBQ3ZpQixJQUFULENBQWN1UixJQUFkO0VBQ0E7RUFDSDs7RUFDRCxZQUFNMkgsR0FBRyxHQUFHM0gsSUFBSSxDQUFDOE8sUUFBTCxDQUFjeUMsV0FBMUI7RUFkdUMsWUFlL0I1WSxHQWYrQixHQWVsQmdQLEdBZmtCLENBZS9CaFAsR0FmK0I7RUFBQSxZQWUxQjBMLEdBZjBCLEdBZWxCc0QsR0Fma0IsQ0FlMUJ0RCxHQWYwQjtFQWdCdkN2SyxRQUFBQSxPQUFJLENBQUN1WCxHQUFMLENBQVM3RyxFQUFULEVBQWE3UixHQUFHLENBQUMsQ0FBRCxDQUFoQixFQUFxQkEsR0FBRyxDQUFDLENBQUQsQ0FBeEIsRUFBNkJBLEdBQUcsQ0FBQyxDQUFELENBQWhDLEVBQXFDLENBQXJDO0VBQ0FtQixRQUFBQSxPQUFJLENBQUN1WCxHQUFMLENBQVM1RyxFQUFULEVBQWFwRyxHQUFHLENBQUMsQ0FBRCxDQUFoQixFQUFxQkEsR0FBRyxDQUFDLENBQUQsQ0FBeEIsRUFBNkJBLEdBQUcsQ0FBQyxDQUFELENBQWhDLEVBQXFDLENBQXJDO0VBQ0EsWUFBTW1OLE1BQU0sR0FBRzFYLE9BQUksQ0FBQzJYLGFBQUwsQ0FBbUJqSCxFQUFuQixFQUF1QkEsRUFBdkIsRUFBMkJ4SyxJQUFJLENBQUMwUixjQUFoQyxDQUFmO0VBQUEsWUFDSUMsTUFBTSxHQUFHN1gsT0FBSSxDQUFDMlgsYUFBTCxDQUFtQmhILEVBQW5CLEVBQXVCQSxFQUF2QixFQUEyQnpLLElBQUksQ0FBQzBSLGNBQWhDLENBRGI7O0VBRUEsWUFBSWhLLGFBQWEsQ0FBQy9aLEdBQUcsQ0FBQ3lmLGNBQUwsRUFBcUIsQ0FBQ29FLE1BQUQsRUFBU0csTUFBVCxDQUFyQixDQUFqQixFQUF5RDtFQUNyRDNSLFVBQUFBLElBQUksQ0FBQzRSLFVBQUwsQ0FBZ0IsTUFBaEIsRUFBd0J4SCxjQUFjLEdBQUcsS0FBekM7RUFDQTRHLFVBQUFBLFFBQVEsQ0FBQ3ZpQixJQUFULENBQWN1UixJQUFkO0VBQ0g7RUFDSjtFQUNKOztFQUNELFdBQU9nUixRQUFRLENBQUN4a0IsTUFBVCxHQUFrQixJQUFJd2dCLFdBQVEsQ0FBQzZFLEtBQWIsQ0FBbUJiLFFBQW5CLENBQWxCLEdBQWlELElBQXhEO0VBQ0g7O1dBR0RjLGVBQUEsc0JBQWFqRCxTQUFiLEVBQXdCbkQsR0FBeEIsRUFBNkJxRyxVQUE3QixFQUF5Q25FLFFBQXpDLEVBQW1EO0VBQy9DLFFBQU1oQyxNQUFNLEdBQUcsS0FBS2QsS0FBTCxDQUFXYSxVQUFYLENBQXNCRCxHQUF0QixDQUFmO0VBQ0EsUUFBTW9ELFFBQVEsR0FBR0QsU0FBUyxDQUFDQyxRQUEzQjs7RUFFQSxRQUFJaUQsVUFBVSxLQUFLLFdBQWYsSUFBOEIsQ0FBQ2pELFFBQVEsQ0FBQ2hULElBQVQsQ0FBY2tULFlBQWpELEVBQStEO0VBRTNERixNQUFBQSxRQUFRLENBQUNDLGlCQUFUO0VBRUFELE1BQUFBLFFBQVEsQ0FBQ0csaUJBQVQsQ0FBMkIsY0FBM0I7RUFDSDs7RUFFRCxRQUFNK0MsU0FBUyxHQUFHLEtBQUtDLFVBQUwsQ0FBZ0J2RyxHQUFoQixFQUFxQm1ELFNBQXJCLENBQWxCOztFQUVBakIsSUFBQUEsUUFBUSxDQUFDc0UsVUFBVCxHQUFzQnhHLEdBQXRCOztFQUNBLFNBQUswRixnQkFBTCxDQUFzQlksU0FBdEIsRUFBaUNwRSxRQUFqQzs7RUFDQSxTQUFLdUUsZUFBTCxDQUFxQkosVUFBckIsRUFBaUNDLFNBQWpDLEVBQTZDcEcsTUFBTSxDQUFDd0csT0FBUCxFQUE3Qzs7RUFFQSxRQUFJTCxVQUFVLEtBQUssT0FBbkIsRUFBNEI7RUFFeEIsVUFBTU0sUUFBUSxHQUFHekcsTUFBTSxDQUFDMEcsWUFBUCxNQUF5QixLQUFLeEgsS0FBTCxDQUFXZ0MsTUFBWCxHQUFvQnlGLFNBQXBCLEVBQTFDO0VBQ0FQLE1BQUFBLFNBQVMsQ0FBQ0osVUFBVixDQUFxQixlQUFyQixFQUFzQyxDQUFDUyxRQUFRLENBQUMsQ0FBRCxDQUFSLEdBQWN6RSxRQUFRLENBQUMsZUFBRCxDQUFSLENBQTBCLENBQTFCLENBQWYsRUFBNkN5RSxRQUFRLENBQUMsQ0FBRCxDQUFSLEdBQWN6RSxRQUFRLENBQUMsZUFBRCxDQUFSLENBQTBCLENBQTFCLENBQTNELEVBQXlGQSxRQUFRLENBQUMsZUFBRCxDQUFSLENBQTBCLENBQTFCLENBQXpGLENBQXRDOztFQUNBLFVBQUlvRSxTQUFTLENBQUNRLFNBQWQsRUFBeUI7RUFDckIsYUFBS0MsZ0JBQUwsQ0FBc0JULFNBQXRCO0VBQ0gsT0FGRCxNQUVPO0VBQ0hBLFFBQUFBLFNBQVMsQ0FBQ0osVUFBVixDQUFxQixpQkFBckIsRUFBd0MsQ0FBQyxHQUFELEVBQU0sR0FBTixFQUFXLEdBQVgsRUFBZ0IsR0FBaEIsQ0FBeEM7RUFDSDtFQUNKLEtBVEQsTUFTTyxJQUFJLEtBQUtjLFlBQUwsQ0FBa0JYLFVBQWxCLENBQUosRUFBbUM7RUFDdEMsVUFBTVksZ0JBQWdCLEdBQUc7RUFBRUMsUUFBQUEsR0FBRyxFQUFHLGFBQVI7RUFBdUJDLFFBQUFBLFVBQVUsRUFBRyxvQkFBcEM7RUFBMERDLFFBQUFBLEtBQUssRUFBRztFQUFsRSxPQUF6Qjs7RUFFQSxVQUFNclMsUUFBUSxHQUFHbUwsTUFBTSxDQUFDMU4sV0FBUCxNQUF3QixLQUFLK00sV0FBTCxDQUFpQjhHLFVBQWpCLEVBQTZCdFIsUUFBdEU7O0VBQ0EsVUFBTXNTLGdCQUFnQixHQUFHLEtBQUtDLGNBQUwsQ0FBb0JoQixTQUFTLENBQUNRLFNBQTlCLENBQXpCOztFQUNBLFVBQUlPLGdCQUFKLEVBQXNCO0VBQ2xCLGFBQUssSUFBTTVmLENBQVgsSUFBZ0I0ZixnQkFBaEIsRUFBa0M7RUFDOUIsY0FBSXRTLFFBQVEsQ0FBQzRRLEdBQWIsRUFBa0I7RUFDZDVRLFlBQUFBLFFBQVEsQ0FBQzRRLEdBQVQsQ0FBYWxlLENBQWIsRUFBZ0I0ZixnQkFBZ0IsQ0FBQzVmLENBQUQsQ0FBaEM7RUFDSCxXQUZELE1BRU87RUFDSHNOLFlBQUFBLFFBQVEsQ0FBQ3ROLENBQUQsQ0FBUixHQUFjNGYsZ0JBQWdCLENBQUM1ZixDQUFELENBQTlCO0VBQ0g7RUFDSjtFQUNKOztFQUNENmUsTUFBQUEsU0FBUyxDQUFDdlIsUUFBVixHQUFxQkEsUUFBUSxZQUFZdU0sV0FBUSxDQUFDcUMsUUFBN0IsR0FBd0M1TyxRQUF4QyxHQUFtRCxJQUFJdU0sV0FBUSxDQUFDaUcsR0FBVCxDQUFhTixnQkFBZ0IsQ0FBQ1osVUFBRCxDQUE3QixDQUFKLENBQStDdFIsUUFBL0MsQ0FBeEU7RUFDSDs7RUFDRCxXQUFPdVIsU0FBUDtFQUNIOztXQUVERyxrQkFBQSx5QkFBZ0JKLFVBQWhCLEVBQTRCQyxTQUE1QixFQUF1Q2tCLFVBQXZDLEVBQW1EO0VBRS9DLFFBQUk1RSxPQUFPLEdBQUcwRCxTQUFTLENBQUNtQixVQUFWLEVBQWQ7RUFDQTdFLElBQUFBLE9BQU8sQ0FBQzhFLGNBQVIsR0FBeUIsQ0FBekI7O0VBQ0EsUUFBSXBCLFNBQVMsQ0FBQzFPLElBQVYsSUFBa0IwTyxTQUFTLENBQUMxTyxJQUFWLENBQWV0RCxJQUFmLENBQW9CQyxJQUExQyxFQUFnRDtFQUM1Q3FPLE1BQUFBLE9BQU8sQ0FBQytFLFFBQVIsR0FBbUIsQ0FBbkI7RUFDSDs7RUFDRC9FLElBQUFBLE9BQU8sR0FBR2EsYUFBQSxDQUFjemdCLE1BQWQsQ0FBcUIsRUFBckIsRUFBeUIsS0FBSzRrQixtQkFBTCxDQUF5QnRCLFNBQVMsQ0FBQ2xELFFBQW5DLEVBQTZDaUQsVUFBN0MsQ0FBekIsRUFBbUZ6RCxPQUFuRixDQUFWO0VBQ0EwRCxJQUFBQSxTQUFTLENBQUN1QixVQUFWLENBQXFCakYsT0FBckI7O0VBQ0EsUUFBSTRFLFVBQVUsS0FBSyxpQkFBbkIsRUFBc0M7RUFDbEMsVUFBTTVFLFFBQU8sR0FBRzBELFNBQVMsQ0FBQ21CLFVBQVYsRUFBaEI7O0VBQ0E3RSxNQUFBQSxRQUFPLENBQUNrRixZQUFSLEdBQXVCLENBQXZCO0VBRUFsRixNQUFBQSxRQUFPLENBQUM4RSxjQUFSLEdBQXlCLENBQXpCO0VBQ0FwQixNQUFBQSxTQUFTLENBQUN1QixVQUFWLENBQXFCcEUsYUFBQSxDQUFjemdCLE1BQWQsQ0FBcUI7RUFBRThrQixRQUFBQSxZQUFZLEVBQUU7RUFBaEIsT0FBckIsRUFBMENsRixRQUExQyxDQUFyQjtFQUNIO0VBQ0o7O1dBRUQyRCxhQUFBLG9CQUFXdkcsR0FBWCxFQUFnQm1ELFNBQWhCLEVBQTJCO0VBQUE7O0VBQ3ZCLFFBQU1DLFFBQVEsR0FBR0QsU0FBUyxDQUFDQyxRQUEzQjtFQUNBLFFBQU1sRCxNQUFNLEdBQUcsS0FBS2QsS0FBTCxDQUFXYSxVQUFYLENBQXNCRCxHQUF0QixDQUFmO0VBQ0EsUUFBTTNOLElBQUksR0FBRzZOLE1BQU0sQ0FBQ3dHLE9BQVAsRUFBYjs7RUFDQSxRQUFJclUsSUFBSSxLQUFLLGlCQUFiLEVBQWdDO0VBQzVCLFVBQU01SixVQUFVLEdBQUd5WCxNQUFNLENBQUM2SCwwQkFBUCxFQUFuQjs7RUFDQSxVQUFNamIsS0FBSyxHQUFHb1QsTUFBTSxDQUFDOEgsUUFBUCxFQUFkO0VBQ0EsVUFBTUMsWUFBWSxHQUFHLElBQUkzRyxXQUFRLENBQUNzRSxhQUFiLENBQTJCbmQsVUFBM0IsRUFBdUNxRSxLQUF2QyxFQUE4Q3NXLFFBQTlDLENBQXJCOztFQUNBLFVBQUksS0FBS3RDLElBQVQsRUFBZTtFQUNYbUgsUUFBQUEsWUFBWSxDQUFDQyx3QkFBYixDQUFzQyxLQUFLcEgsSUFBM0M7RUFDSCxPQUZELE1BRU87RUFDSCxhQUFLMUIsS0FBTCxDQUFXK0ksRUFBWCxDQUFjLGVBQWQsRUFBK0IsWUFBTTtFQUNqQ0YsVUFBQUEsWUFBWSxDQUFDQyx3QkFBYixDQUFzQyxNQUFJLENBQUNwSCxJQUEzQztFQUNILFNBRkQ7RUFHSDs7RUFDRCxhQUFPbUgsWUFBUDtFQUNIOztFQUNELFFBQU0zQixTQUFTLEdBQUcsSUFBSWhGLFdBQVEsQ0FBQzhHLElBQWIsQ0FBa0JoRixRQUFsQixDQUFsQjtFQUNBa0QsSUFBQUEsU0FBUyxDQUFDK0IsVUFBVixDQUFxQnJPLFNBQXJCLEdBQWlDbUosU0FBUyxDQUFDbkosU0FBM0M7RUFDQXNNLElBQUFBLFNBQVMsQ0FBQytCLFVBQVYsQ0FBcUJDLFFBQXJCLEdBQWdDdEksR0FBaEM7RUFDQXNHLElBQUFBLFNBQVMsQ0FBQ2lDLFdBQVYsR0FBd0JwRixTQUFTLENBQUN4ZSxNQUFsQztFQUNBMmhCLElBQUFBLFNBQVMsQ0FBQzFPLElBQVYsR0FBaUJ1TCxTQUFTLENBQUN2TCxJQUEzQjtFQUNBME8sSUFBQUEsU0FBUyxDQUFDUSxTQUFWLEdBQXNCM0QsU0FBUyxDQUFDMkQsU0FBaEM7RUFDQSxRQUFNeFMsSUFBSSxHQUFHNk8sU0FBUyxDQUFDN08sSUFBdkI7O0VBQ0EsUUFBSUEsSUFBSSxJQUFJQSxJQUFJLENBQUNDLElBQWpCLEVBQXVCO0VBQ25CK1IsTUFBQUEsU0FBUyxDQUFDL1IsSUFBVixHQUFpQkQsSUFBSSxDQUFDQyxJQUF0QjtFQUNBK1IsTUFBQUEsU0FBUyxDQUFDSixVQUFWLENBQXFCLGNBQXJCLEVBQXFDNVIsSUFBSSxDQUFDQyxJQUFMLENBQVVzSixZQUEvQztFQUNBeUksTUFBQUEsU0FBUyxDQUFDSixVQUFWLENBQXFCLGtCQUFyQixFQUF5QzVSLElBQUksQ0FBQ0MsSUFBTCxDQUFVeUosZ0JBQW5EO0VBQ0FzSSxNQUFBQSxTQUFTLENBQUNKLFVBQVYsQ0FBcUIsV0FBckIsRUFBa0M1UixJQUFJLENBQUNDLElBQUwsQ0FBVTBGLE1BQVYsQ0FBaUJuWixNQUFuRDtFQUNIOztFQUNELFdBQU93bEIsU0FBUDtFQUNIOztXQUVEc0Isc0JBQUEsNkJBQW9CeEUsUUFBcEIsRUFBOEJpRCxVQUE5QixFQUEwQztFQUN0QyxRQUFJekQsT0FBTyxHQUFHLEVBQWQ7RUFDQSxRQUFNUCxNQUFNLEdBQUcsS0FBSzlDLFdBQUwsQ0FBaUI4RyxVQUFqQixFQUE2QmhFLE1BQTVDOztFQUNBLFFBQUlBLE1BQU0sQ0FBQ21HLGtCQUFYLEVBQStCO0VBQzNCNUYsTUFBQUEsT0FBTyxHQUFHUCxNQUFNLENBQUNtRyxrQkFBUCxDQUEwQnBGLFFBQTFCLENBQVY7RUFDQVIsTUFBQUEsT0FBTyxDQUFDLDBCQUFELENBQVAsR0FBc0MsQ0FBdEM7RUFDQUEsTUFBQUEsT0FBTyxDQUFDLG1CQUFELENBQVAsR0FBZ0MzZCxJQUFJLENBQUN3akIsR0FBTCxDQUFTdkosbUJBQVQsSUFBZ0NqYSxJQUFJLENBQUN3akIsR0FBTCxDQUFTLENBQVQsQ0FBakMsR0FBZ0QsSUFBL0U7RUFDSDs7RUFDRCxXQUFPN0YsT0FBUDtFQUNIOztXQUVEOEYsa0JBQUEseUJBQWdCeEksTUFBaEIsRUFBd0I7RUFDcEIsUUFBTXlJLGNBQWMsR0FBR3pJLE1BQU0sQ0FBQ3VGLFdBQVAsRUFBdkI7RUFDQSxRQUFNWSxVQUFVLEdBQUduRyxNQUFNLENBQUM2QyxTQUFQLEVBQW5CO0VBQ0EsUUFBTTZGLGVBQWUsR0FBRyxLQUFLckosV0FBTCxDQUFpQjhHLFVBQWpCLEVBQTZCbkUsUUFBckQ7RUFFQSxRQUFNQSxRQUFRLEdBQUd1QixhQUFBLENBQWN6Z0IsTUFBZCxDQUFxQixFQUFyQixFQUF5QjRsQixlQUF6QixFQUEwQ0QsY0FBMUMsQ0FBakI7RUFDQSxXQUFPekcsUUFBUDtFQUNIOztXQUdEMkcsZUFBQSxzQkFBYTNJLE1BQWIsRUFBcUI7RUFBQTs7RUFDakIsUUFBTUYsR0FBRyxHQUFHRSxNQUFNLENBQUMrRSxJQUFuQjtFQUNBLFFBQU02RCxHQUFHLEdBQUc1SSxNQUFNLENBQUMrQyxNQUFQLEVBQVo7RUFDQSxRQUFJc0MsV0FBVyxHQUFHLEVBQWxCO0VBQ0EsUUFBTWMsVUFBVSxHQUFHbkcsTUFBTSxDQUFDNkMsU0FBUCxFQUFuQjs7RUFDQSxRQUFNYixRQUFRLEdBQUcsS0FBS3dHLGVBQUwsQ0FBcUJ4SSxNQUFyQixDQUFqQjs7RUFDQSxRQUFNNkksY0FBYyxHQUFHLEtBQUt6SixXQUFMLENBQWlCd0osR0FBakIsQ0FBdkI7O0VBRUEsUUFBSUMsY0FBSixFQUFvQjtFQUNoQkEsTUFBQUEsY0FBYyxDQUFDN0YsVUFBZixDQUEwQnhXLE9BQTFCLENBQWtDLFVBQUF5VyxTQUFTLEVBQUk7RUFDM0MsWUFBTW1ELFNBQVMsR0FBRyxNQUFJLENBQUNGLFlBQUwsQ0FBa0JqRCxTQUFsQixFQUE2Qm5ELEdBQTdCLEVBQWtDcUcsVUFBbEMsRUFBOENuRSxRQUE5QyxDQUFsQjs7RUFDQXFELFFBQUFBLFdBQVcsQ0FBQ3hpQixJQUFaLENBQWlCdWpCLFNBQWpCO0VBQ0gsT0FIRDtFQUlBeUMsTUFBQUEsY0FBYyxDQUFDamMsS0FBZixJQUF3QixDQUF4QjtFQUNILEtBTkQsTUFNTztFQUNILFVBQU11SyxJQUFJLEdBQUc2SSxNQUFNLENBQUM4SSxZQUFQLEVBQWI7O0VBQ0EsV0FBSzFKLFdBQUwsQ0FBaUJ3SixHQUFqQixJQUF3QjtFQUFFOUksUUFBQUEsR0FBRyxFQUFIQSxHQUFGO0VBQU8zSSxRQUFBQSxJQUFJLEVBQUpBLElBQVA7RUFBYTZMLFFBQUFBLFVBQVUsRUFBRSxFQUF6QjtFQUE2QnBXLFFBQUFBLEtBQUssRUFBRTtFQUFwQyxPQUF4Qjs7RUFDQSxVQUFJLENBQUN1SyxJQUFJLENBQUM4QyxNQUFWLEVBQWtCO0VBQ2RvTCxRQUFBQSxXQUFXLEdBQUcsS0FBSzBELGtCQUFMLENBQXdCNVIsSUFBeEIsRUFBOEIySSxHQUE5QixFQUFtQzhJLEdBQW5DLEVBQXdDekMsVUFBeEMsRUFBb0RuRSxRQUFwRCxDQUFkO0VBQ0gsT0FGRCxNQUVPO0VBQ0hxRCxRQUFBQSxXQUFXLEdBQUcsS0FBSzJELGdCQUFMLENBQXNCN1IsSUFBdEIsRUFBNEIySSxHQUE1QixFQUFpQzhJLEdBQWpDLEVBQXNDekMsVUFBdEMsRUFBa0RuRSxRQUFsRCxDQUFkO0VBQ0g7RUFDSjs7RUFDRCxTQUFLN0MsVUFBTCxDQUFnQlcsR0FBaEIsSUFBdUI7RUFBRUEsTUFBQUEsR0FBRyxFQUFIQSxHQUFGO0VBQU91RixNQUFBQSxXQUFXLEVBQVhBO0VBQVAsS0FBdkI7RUFDQXJGLElBQUFBLE1BQU0sQ0FBQ21GLFFBQVAsQ0FBZ0IsSUFBaEI7RUFDQSxTQUFLOEQsV0FBTDtFQUNIOztXQUVERCxtQkFBQSwwQkFBaUI3UixJQUFqQixFQUF1QjJJLEdBQXZCLEVBQTRCOEksR0FBNUIsRUFBaUN6QyxVQUFqQyxFQUE2Q25FLFFBQTdDLEVBQXVEO0VBQUE7O0VBQ25ELFFBQU1xRCxXQUFXLEdBQUcsRUFBcEI7RUFDQSxRQUFNN1QsTUFBTSxHQUFHLEVBQWY7RUFDQSxRQUFNb0gsS0FBSyxHQUFHekIsSUFBSSxDQUFDOEMsTUFBTCxDQUFZLENBQVosRUFBZXJCLEtBQTdCO0VBRUFBLElBQUFBLEtBQUssQ0FBQ3BNLE9BQU4sQ0FBYyxVQUFDa0wsSUFBRCxFQUFVO0VBQ3BCLE1BQUEsTUFBSSxDQUFDd1IsV0FBTCxDQUFpQnhSLElBQWpCLEVBQXVCbEcsTUFBdkI7RUFDSCxLQUZEO0VBR0FBLElBQUFBLE1BQU0sQ0FBQ2hGLE9BQVAsQ0FBZSxVQUFBNEgsSUFBSSxFQUFJO0VBQ25CQSxNQUFBQSxJQUFJLENBQUN1RyxVQUFMLENBQWdCbk8sT0FBaEIsQ0FBd0IsVUFBQW9hLFNBQVMsRUFBSTtFQUNqQyxZQUFNdUMsYUFBYSxHQUFHLE1BQUksQ0FBQ0MsZUFBTCxDQUFxQnhDLFNBQXJCLENBQXRCOztFQUNBLFlBQU0zRCxTQUFTLEdBQUc7RUFDZG5KLFVBQUFBLFNBQVMsRUFBRTFGLElBQUksQ0FBQzBGLFNBREY7RUFFZHNPLFVBQUFBLFFBQVEsRUFBRXRJLEdBRkk7RUFHZHJiLFVBQUFBLE1BQU0sRUFBRTJQLElBQUksQ0FBQzRKLFVBSEM7RUFJZGtGLFVBQUFBLFFBQVEsRUFBRWlHLGFBSkk7RUFLZHZDLFVBQUFBLFNBQVMsRUFBVEEsU0FMYztFQU1kbFAsVUFBQUEsSUFBSSxFQUFHdEQsSUFBSSxDQUFDc0QsSUFORTtFQU9kdEQsVUFBQUEsSUFBSSxFQUFKQTtFQVBjLFNBQWxCOztFQVNBLFFBQUEsTUFBSSxDQUFDZ0wsV0FBTCxDQUFpQndKLEdBQWpCLEVBQXNCNUYsVUFBdEIsQ0FBaUNuZ0IsSUFBakMsQ0FBc0NvZ0IsU0FBdEM7O0VBRUEsWUFBTW1ELFNBQVMsR0FBRyxNQUFJLENBQUNGLFlBQUwsQ0FBa0JqRCxTQUFsQixFQUE2Qm5ELEdBQTdCLEVBQWtDcUcsVUFBbEMsRUFBOENuRSxRQUE5QyxDQUFsQjs7RUFDQSxZQUFJNU4sSUFBSSxDQUFDeUUsT0FBVCxFQUFrQjtFQUNkdU4sVUFBQUEsU0FBUyxDQUFDSixVQUFWLENBQXFCLFNBQXJCLEVBQWdDNVIsSUFBSSxDQUFDeUUsT0FBckM7RUFDSDs7RUFDRHdNLFFBQUFBLFdBQVcsQ0FBQ3hpQixJQUFaLENBQWlCdWpCLFNBQWpCO0VBQ0gsT0FsQkQ7RUFtQkgsS0FwQkQ7RUFxQkEsV0FBT2YsV0FBUDtFQUNIOztXQUVENkQsY0FBQSxxQkFBWXhSLElBQVosRUFBa0JsRyxNQUFsQixFQUEwQjtFQUN0QixRQUFJa0csSUFBSSxDQUFDMlIsUUFBVCxFQUFtQjtFQUNmO0VBQ0g7O0VBQ0QzUixJQUFBQSxJQUFJLENBQUNzRyxVQUFMLEdBQWtCdEcsSUFBSSxDQUFDc0csVUFBTCxJQUFtQkUsT0FBSSxDQUFDb0wsUUFBTCxDQUFjLEVBQWQsQ0FBckM7RUFDQTVSLElBQUFBLElBQUksQ0FBQzZSLFdBQUwsR0FBbUI3UixJQUFJLENBQUM2UixXQUFMLElBQW9CckwsT0FBSSxDQUFDb0wsUUFBTCxDQUFjLEVBQWQsQ0FBdkM7O0VBQ0EsUUFBSTVSLElBQUksQ0FBQ2pULE1BQVQsRUFBaUI7RUFDYmlULE1BQUFBLElBQUksQ0FBQ29CLEdBQUwsR0FBVyxJQUFJd0YsR0FBSixFQUFYO0VBQ0E1RyxNQUFBQSxJQUFJLENBQUNvQixHQUFMLENBQVN5RixTQUFULENBQW1CN0csSUFBSSxDQUFDalQsTUFBeEI7RUFDSCxLQUhELE1BR087RUFDSGlULE1BQUFBLElBQUksQ0FBQ29CLEdBQUwsR0FBVyxJQUFJd0YsR0FBSixDQUFRNUcsSUFBSSxDQUFDelQsV0FBYixFQUEwQnlULElBQUksQ0FBQ3BHLFFBQS9CLEVBQXlDb0csSUFBSSxDQUFDdlQsS0FBOUMsQ0FBWDtFQUNIOztFQUNELFFBQUl1VCxJQUFJLENBQUN0RyxRQUFULEVBQW1CO0VBQ2YsV0FBSyxJQUFJeE8sSUFBQyxHQUFHLENBQWIsRUFBZ0JBLElBQUMsR0FBRzhVLElBQUksQ0FBQ3RHLFFBQUwsQ0FBY3hRLE1BQWxDLEVBQTBDZ0MsSUFBQyxFQUEzQyxFQUErQztFQUMzQyxZQUFNNG1CLEtBQUssR0FBRzlSLElBQUksQ0FBQ3RHLFFBQUwsQ0FBY3hPLElBQWQsQ0FBZDs7RUFDQSxhQUFLc21CLFdBQUwsQ0FBaUJNLEtBQWpCLEVBQXdCaFksTUFBeEI7RUFDSDtFQUNKOztFQUNELFFBQUluTyxPQUFPLENBQUNxVSxJQUFJLENBQUN0RCxJQUFOLENBQVgsRUFBd0I7RUFDcEJzRCxNQUFBQSxJQUFJLENBQUN0RCxJQUFMLEdBQVlzRCxJQUFJLENBQUNsRyxNQUFMLENBQVksQ0FBWixDQUFaO0VBQ0FrRyxNQUFBQSxJQUFJLENBQUN0RCxJQUFMLENBQVVzRCxJQUFWLEdBQWlCQSxJQUFqQjtFQUNBbEcsTUFBQUEsTUFBTSxDQUFDM08sSUFBUCxDQUFZNlUsSUFBSSxDQUFDdEQsSUFBakI7RUFDSDs7RUFDRCxRQUFJc0QsSUFBSSxDQUFDckQsSUFBVCxFQUFlO0VBQ1gsVUFBTUEsSUFBSSxHQUFHcUQsSUFBSSxDQUFDckQsSUFBbEI7RUFDQSxVQUFNc0osWUFBWSxHQUFHLEtBQUtpRCxJQUFMLENBQVUxTCxPQUFWLEVBQXJCO0VBQ0F3QyxNQUFBQSxJQUFJLENBQUN0RCxJQUFMLENBQVVDLElBQVYsR0FBaUIsSUFBSW9KLElBQUosQ0FBU3BKLElBQUksQ0FBQzBGLE1BQWQsRUFBc0IxRixJQUFJLENBQUNtRyxtQkFBTCxDQUF5QnRILEtBQS9DLEVBQXNEeUssWUFBdEQsQ0FBakI7RUFDSDs7RUFDRGpHLElBQUFBLElBQUksQ0FBQzJSLFFBQUwsR0FBZ0IsSUFBaEI7RUFDSDs7V0FFREQsa0JBQUEseUJBQWdCeEMsU0FBaEIsRUFBMkI7RUFDdkIsUUFBTXJlLFVBQVUsR0FBRyxFQUFuQjs7RUFDQSxTQUFLLElBQU1raEIsSUFBWCxJQUFtQjdDLFNBQVMsQ0FBQ3JlLFVBQTdCLEVBQXlDO0VBQ3JDQSxNQUFBQSxVQUFVLENBQUNraEIsSUFBRCxDQUFWLEdBQW1CN0MsU0FBUyxDQUFDcmUsVUFBVixDQUFxQmtoQixJQUFyQixFQUEyQnZXLEtBQTlDO0VBQ0g7O0VBQ0QsUUFBTWlXLGFBQWEsR0FBRyxJQUFJL0gsV0FBUSxDQUFDc0ksUUFBYixDQUNsQm5oQixVQURrQixFQUVsQnFlLFNBQVMsQ0FBQzlMLE9BRlEsRUFHbEIsQ0FIa0IsRUFJbEI7RUFFSThMLE1BQUFBLFNBQVMsRUFBRXJELGFBQUEsQ0FBY29HLFFBQWQsQ0FBdUIvQyxTQUFTLENBQUMxTCxJQUFqQyxJQUF5QzRELEtBQUssQ0FBQzhILFNBQVMsQ0FBQzFMLElBQVgsQ0FBOUMsR0FBaUUwTCxTQUFTLENBQUMxTCxJQUYxRjtFQUdJME8sTUFBQUEsaUJBQWlCLEVBQUUsVUFIdkI7RUFJSUMsTUFBQUEsZUFBZSxFQUFFLFFBSnJCO0VBS0lDLE1BQUFBLFlBQVksRUFBRTtFQUxsQixLQUprQixDQUF0Qjs7RUFZQSxRQUFJLENBQUNYLGFBQWEsQ0FBQ2paLElBQWQsQ0FBbUIsU0FBbkIsQ0FBTCxFQUFvQztFQUNoQ2laLE1BQUFBLGFBQWEsQ0FBQ1ksYUFBZCxDQUE0QixTQUE1QjtFQUNIOztFQUNELFdBQU9aLGFBQVA7RUFDSDs7V0FFREoscUJBQUEsNEJBQW1CNVIsSUFBbkIsRUFBeUIySSxHQUF6QixFQUE4QjhJLEdBQTlCLEVBQW1DekMsVUFBbkMsRUFBK0NuRSxRQUEvQyxFQUF5RDtFQUNyRCxRQUFNcUQsV0FBVyxHQUFHLEVBQXBCOztFQUNBLFFBQU04RCxhQUFhLEdBQUcsS0FBS0MsZUFBTCxDQUFxQmpTLElBQXJCLENBQXRCOztFQUNBLFFBQU04TCxTQUFTLEdBQUc7RUFDZG5KLE1BQUFBLFNBQVMsRUFBRSxJQURHO0VBRWRzTyxNQUFBQSxRQUFRLEVBQUV0SSxHQUZJO0VBR2RoSCxNQUFBQSxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUQsRUFBSSxDQUFKLEVBQU8sQ0FBUCxDQUFELEVBQVksQ0FBQyxDQUFELEVBQUksQ0FBSixFQUFPLENBQVAsRUFBVSxDQUFWLENBQVosRUFBMEIsQ0FBQyxDQUFELEVBQUksQ0FBSixFQUFPLENBQVAsQ0FBMUIsQ0FIUztFQUlkb0ssTUFBQUEsUUFBUSxFQUFFaUcsYUFKSTtFQUtkL1UsTUFBQUEsSUFBSSxFQUFHO0VBTE8sS0FBbEI7O0VBT0EsU0FBS2dMLFdBQUwsQ0FBaUJ3SixHQUFqQixFQUFzQjVGLFVBQXRCLENBQWlDbmdCLElBQWpDLENBQXNDb2dCLFNBQXRDOztFQUVBLFFBQU1tRCxTQUFTLEdBQUcsS0FBS0YsWUFBTCxDQUFrQmpELFNBQWxCLEVBQTZCbkQsR0FBN0IsRUFBa0NxRyxVQUFsQyxFQUE4Q25FLFFBQTlDLENBQWxCOztFQUNBcUQsSUFBQUEsV0FBVyxDQUFDeGlCLElBQVosQ0FBaUJ1akIsU0FBakI7RUFDQSxXQUFPZixXQUFQO0VBQ0g7O1dBSUR3QixtQkFBQSwwQkFBaUJULFNBQWpCLEVBQTRCO0VBRXhCLFFBQU1RLFNBQVMsR0FBR1IsU0FBUyxDQUFDUSxTQUE1QjtFQUNBLFFBQU0vUixRQUFRLEdBQUcrUixTQUFTLENBQUMvUixRQUFWLENBQW1CTixvQkFBcEM7RUFDQSxRQUFNTyxnQkFBZ0IsR0FBR0QsUUFBUSxDQUFDQyxnQkFBbEM7O0VBQ0EsUUFBSUEsZ0JBQUosRUFBc0I7RUFDbEIsVUFBTUksT0FBTyxHQUFHLEtBQUs4VSxVQUFMLENBQWdCbFYsZ0JBQWhCLENBQWhCOztFQUNBLFVBQU00TixPQUFPLEdBQUcwRCxTQUFTLENBQUNtQixVQUFWLEVBQWhCO0VBQ0E3RSxNQUFBQSxPQUFPLENBQUN1SCxvQkFBUixHQUErQixDQUEvQjtFQUNBN0QsTUFBQUEsU0FBUyxDQUFDdUIsVUFBVixDQUFxQmpGLE9BQXJCO0VBQ0EwRCxNQUFBQSxTQUFTLENBQUNKLFVBQVYsQ0FBcUIsa0JBQXJCLEVBQXlDOVEsT0FBekM7RUFDQWtSLE1BQUFBLFNBQVMsQ0FBQ0osVUFBVixDQUFxQixpQkFBckIsRUFBd0MsQ0FBQyxHQUFELEVBQU0sR0FBTixFQUFXLEdBQVgsRUFBZ0IsR0FBaEIsQ0FBeEM7RUFDSDs7RUFBQyxRQUFJblIsUUFBUSxDQUFDcVYsZUFBYixFQUE4QjtFQUM1QixVQUFNQSxlQUFlLEdBQUdyVixRQUFRLENBQUNxVixlQUFqQztFQUNBOUQsTUFBQUEsU0FBUyxDQUFDSixVQUFWLENBQXFCLGlCQUFyQixFQUF3Q2tFLGVBQXhDO0VBQ0g7RUFDSjs7V0FFRDlDLGlCQUFBLHdCQUFlUixTQUFmLEVBQTBCO0VBQ3RCLFFBQUksQ0FBQ0EsU0FBTCxFQUFnQjtFQUNaLGFBQU8sSUFBUDtFQUNIOztFQUNELFFBQU11RCxXQUFXLEdBQUd2RCxTQUFTLENBQUMvUixRQUFWLENBQW1CTixvQkFBdkM7RUFDQSxRQUFNUSx3QkFBd0IsR0FBR29WLFdBQVcsQ0FBQ3BWLHdCQUE3QztFQUNBLFFBQU1vUyxnQkFBZ0IsR0FBRyxFQUF6QjtFQUNBLFFBQU1yUyxnQkFBZ0IsR0FBR3FWLFdBQVcsQ0FBQ3JWLGdCQUFyQzs7RUFDQSxRQUFJQSxnQkFBSixFQUFzQjtFQUNsQixVQUFNSSxPQUFPLEdBQUcsS0FBSzhVLFVBQUwsQ0FBZ0JsVixnQkFBaEIsQ0FBaEI7O0VBQ0FxUyxNQUFBQSxnQkFBZ0IsQ0FBQyxrQkFBRCxDQUFoQixHQUF1Q2pTLE9BQXZDO0VBQ0gsS0FIRCxNQUdPLElBQUlpVixXQUFXLENBQUNELGVBQWhCLEVBQWlDO0VBQ3BDL0MsTUFBQUEsZ0JBQWdCLENBQUMsaUJBQUQsQ0FBaEIsR0FBc0NnRCxXQUFXLENBQUNELGVBQWxEO0VBQ0g7O0VBQ0QsUUFBSW5WLHdCQUFKLEVBQThCO0VBQzFCLFVBQU1HLFFBQU8sR0FBRyxLQUFLOFUsVUFBTCxDQUFnQmpWLHdCQUFoQixDQUFoQjs7RUFDQW9TLE1BQUFBLGdCQUFnQixDQUFDLDBCQUFELENBQWhCLEdBQStDalMsUUFBL0M7RUFDSCxLQUhELE1BR087RUFDSCxVQUFJN1IsT0FBTyxDQUFDOG1CLFdBQVcsQ0FBQ0MsY0FBYixDQUFYLEVBQXlDO0VBQ3JDakQsUUFBQUEsZ0JBQWdCLENBQUMsZ0JBQUQsQ0FBaEIsR0FBcUNnRCxXQUFXLENBQUNDLGNBQWpEO0VBQ0g7O0VBQ0QsVUFBSS9tQixPQUFPLENBQUM4bUIsV0FBVyxDQUFDRSxlQUFiLENBQVgsRUFBMEM7RUFDdENsRCxRQUFBQSxnQkFBZ0IsQ0FBQyxpQkFBRCxDQUFoQixHQUFzQ2dELFdBQVcsQ0FBQ0UsZUFBbEQ7RUFDSDtFQUNKOztFQUNELFFBQUl6RCxTQUFTLENBQUMvUixRQUFWLENBQW1CTCxhQUF2QixFQUFzQztFQUNsQyxVQUFNVSxTQUFPLEdBQUcsS0FBSzhVLFVBQUwsQ0FBZ0JwRCxTQUFTLENBQUMvUixRQUFWLENBQW1CTCxhQUFuQyxDQUFoQjs7RUFDQTJTLE1BQUFBLGdCQUFnQixDQUFDLGVBQUQsQ0FBaEIsR0FBb0NqUyxTQUFwQztFQUNIOztFQUNELFFBQUkwUixTQUFTLENBQUMvUixRQUFWLENBQW1CSixnQkFBdkIsRUFBeUM7RUFDckMsVUFBTVMsU0FBTyxHQUFHLEtBQUs4VSxVQUFMLENBQWdCcEQsU0FBUyxDQUFDL1IsUUFBVixDQUFtQkosZ0JBQW5DLENBQWhCOztFQUNBMFMsTUFBQUEsZ0JBQWdCLENBQUMsa0JBQUQsQ0FBaEIsR0FBdUNqUyxTQUF2QztFQUNIOztFQUNELFFBQUkwUixTQUFTLENBQUMvUixRQUFWLENBQW1CSCxlQUF2QixFQUF3QztFQUNwQyxVQUFNUSxTQUFPLEdBQUcsS0FBSzhVLFVBQUwsQ0FBZ0JwRCxTQUFTLENBQUMvUixRQUFWLENBQW1CSCxlQUFuQyxDQUFoQjs7RUFDQXlTLE1BQUFBLGdCQUFnQixDQUFDLGlCQUFELENBQWhCLEdBQXNDalMsU0FBdEM7RUFDSDs7RUFDRCxXQUFPaVMsZ0JBQVA7RUFDSDs7V0FFRDZDLGFBQUEsb0JBQVc5VSxPQUFYLEVBQW9CO0VBQ2hCLFFBQU1oRixJQUFJLEdBQUdnRixPQUFPLENBQUNBLE9BQVIsQ0FBZ0JFLEtBQWhCLENBQXNCbEMsS0FBbkM7RUFDQSxRQUFNbEIsT0FBTyxHQUFHa0QsT0FBTyxDQUFDQSxPQUFSLENBQWdCbEQsT0FBaEIsSUFBMkIsRUFBM0M7RUFDQSxRQUFNcUQsS0FBSyxHQUFHSCxPQUFPLENBQUNBLE9BQVIsQ0FBZ0JFLEtBQWhCLENBQXNCQyxLQUFwQztFQUNBLFFBQU1DLE1BQU0sR0FBR0osT0FBTyxDQUFDQSxPQUFSLENBQWdCRSxLQUFoQixDQUFzQkUsTUFBckM7RUFDQSxXQUFPLEtBQUtzTCxJQUFMLENBQVUxTCxPQUFWLENBQWtCO0VBQ3JCRyxNQUFBQSxLQUFLLEVBQUxBLEtBRHFCO0VBRXJCQyxNQUFBQSxNQUFNLEVBQU5BLE1BRnFCO0VBR3JCcEYsTUFBQUEsSUFBSSxFQUFKQSxJQUhxQjtFQUlyQm9hLE1BQUFBLEdBQUcsRUFBRXZMLGVBQWUsQ0FBQy9NLE9BQU8sQ0FBQ3VZLFNBQVQsQ0FBZixJQUFzQ3hMLGVBQWUsQ0FBQyxNQUFELENBSnJDO0VBS3JCaFMsTUFBQUEsR0FBRyxFQUFFZ1MsZUFBZSxDQUFDL00sT0FBTyxDQUFDd1ksU0FBVCxDQUFmLElBQXNDekwsZUFBZSxDQUFDLE1BQUQsQ0FMckM7RUFNckIwTCxNQUFBQSxLQUFLLEVBQUUxTCxlQUFlLENBQUMvTSxPQUFPLENBQUN5WSxLQUFULENBQWYsSUFBa0MxTCxlQUFlLENBQUMsT0FBRCxDQU5uQztFQU9yQjJMLE1BQUFBLEtBQUssRUFBRTNMLGVBQWUsQ0FBQy9NLE9BQU8sQ0FBQzBZLEtBQVQsQ0FBZixJQUFrQzNMLGVBQWUsQ0FBQyxPQUFEO0VBUG5DLEtBQWxCLENBQVA7RUFTSDs7V0FFRHlHLG1CQUFBLDBCQUFpQnBSLElBQWpCLEVBQXVCNE4sUUFBdkIsRUFBaUM7RUFDN0IsU0FBSyxJQUFNOWUsQ0FBWCxJQUFnQjhlLFFBQWhCLEVBQTBCO0VBQ3RCNU4sTUFBQUEsSUFBSSxDQUFDNFIsVUFBTCxDQUFnQjlpQixDQUFoQixFQUFtQjhlLFFBQVEsQ0FBQzllLENBQUQsQ0FBM0I7RUFDSDs7RUFDRCxXQUFPa1IsSUFBUDtFQUNIOztXQUVEdVcsb0JBQUEsMkJBQWtCM0ssTUFBbEIsRUFBMEJ0SSxJQUExQixFQUFnQ2tULGdCQUFoQyxFQUFrRDtFQUFBOztFQUM5QyxRQUFNOVIsR0FBRyxHQUFHcEIsSUFBSSxDQUFDb0IsR0FBakI7O0VBQ0EsUUFBSUEsR0FBSixFQUFTO0VBQ0xBLE1BQUFBLEdBQUcsQ0FBQ3lGLFNBQUosQ0FBYzdHLElBQUksQ0FBQzZSLFdBQW5CO0VBQ0g7O0VBQ0QsUUFBSXFCLGdCQUFKLEVBQXNCO0VBQ2xCMU0sTUFBQUEsT0FBSSxDQUFDRyxRQUFMLENBQWMzRyxJQUFJLENBQUNzRyxVQUFuQixFQUErQjRNLGdCQUEvQixFQUFpRGxULElBQUksQ0FBQzZSLFdBQXREO0VBQ0gsS0FGRCxNQUVPO0VBQ0hyTCxNQUFBQSxPQUFJLENBQUN4WixJQUFMLENBQVVnVCxJQUFJLENBQUNzRyxVQUFmLEVBQTJCdEcsSUFBSSxDQUFDNlIsV0FBaEM7RUFDSDs7RUFDRCxRQUFNdkwsVUFBVSxHQUFHdEcsSUFBSSxDQUFDc0csVUFBeEI7O0VBQ0EsUUFBSXRHLElBQUksQ0FBQ3RHLFFBQVQsRUFBbUI7RUFDZnNHLE1BQUFBLElBQUksQ0FBQ3RHLFFBQUwsQ0FBYzVFLE9BQWQsQ0FBc0IsVUFBQWdkLEtBQUssRUFBSTtFQUMzQixRQUFBLE1BQUksQ0FBQ21CLGlCQUFMLENBQXVCM0ssTUFBdkIsRUFBK0J3SixLQUEvQixFQUFzQ3hMLFVBQXRDO0VBQ0gsT0FGRDtFQUdIOztFQUNELFFBQUlnQyxNQUFNLENBQUNpRixVQUFQLEVBQUosRUFBeUI7RUFDckIsVUFBTTJELEdBQUcsR0FBRzVJLE1BQU0sQ0FBQytDLE1BQVAsRUFBWjtFQUNBLFVBQU01TCxJQUFJLEdBQUcsS0FBS2lJLFdBQUwsQ0FBaUJ3SixHQUFqQixFQUFzQnpSLElBQW5DO0VBQ0EsVUFBTTBULEtBQUssR0FBRzdLLE1BQU0sQ0FBQzhLLGlCQUFQLEVBQWQ7RUFDQSxVQUFNQyxRQUFRLEdBQUcvSyxNQUFNLENBQUMrSyxRQUFQLEVBQWpCO0VBRUEsVUFBTUMsUUFBUSxHQUFHN1QsSUFBSSxDQUFDSSxVQUFMLEdBQWtCdkcsQ0FBQSxDQUFnQnNJLG9CQUFoQixDQUFxQ25DLElBQXJDLENBQWxCLEdBQStELElBQWhGO0VBQ0EsVUFBTThULFFBQVEsR0FBR0YsUUFBUSxHQUFJdk0sY0FBYyxHQUFHLEtBQWxCLElBQTRCd00sUUFBUSxDQUFDdlMsR0FBVCxHQUFldVMsUUFBUSxDQUFDamUsR0FBcEQsQ0FBSCxHQUE4RHlSLGNBQWMsR0FBRyxLQUF4RztFQUNBLFVBQU0wTSxRQUFRLEdBQUdsYSxDQUFBLENBQWdCMkgsZ0JBQWhCLENBQWlDeEIsSUFBakMsRUFBdUMrQyxNQUFNLENBQUN4QyxJQUFJLENBQUNvQyxTQUFOLENBQTdDLEVBQStEbVIsUUFBUSxHQUFHSixLQUExRSxDQUFqQjtFQUNBLFVBQU1NLGdCQUFnQixHQUFHRCxRQUFRLENBQUNwUyxHQUFsQztFQUNBL1UsTUFBQUEsU0FBUyxDQUFDb25CLGdCQUFELEVBQW1CelQsSUFBSSxDQUFDb0IsR0FBTCxDQUFTN1UsV0FBNUIsRUFBeUN5VCxJQUFJLENBQUNvQixHQUFMLENBQVN4SCxRQUFsRCxFQUE0RG9HLElBQUksQ0FBQ29CLEdBQUwsQ0FBUzNVLEtBQXJFLENBQVQ7O0VBRUEsVUFBSSttQixRQUFRLENBQUNyUyxPQUFiLEVBQXNCO0VBQ2xCbkIsUUFBQUEsSUFBSSxDQUFDMFQsWUFBTCxHQUFvQkYsUUFBUSxDQUFDclMsT0FBN0I7RUFDSDs7RUFDRCxVQUFJbkIsSUFBSSxDQUFDckQsSUFBVCxFQUFlO0VBQ1hxRCxRQUFBQSxJQUFJLENBQUNyRCxJQUFMLENBQVUwRixNQUFWLENBQWlCdk4sT0FBakIsQ0FBeUIsVUFBQTRSLEtBQUssRUFBSTtFQUM5QixjQUFNaU4sV0FBVyxHQUFJcmEsQ0FBQSxDQUFnQjJILGdCQUFoQixDQUFpQ3hCLElBQWpDLEVBQXVDK0MsTUFBTSxDQUFDa0UsS0FBSyxDQUFDdEUsU0FBUCxDQUE3QyxFQUFnRW1SLFFBQVEsR0FBR0osS0FBM0UsRUFBa0YvUixHQUF2RztFQUNBL1UsVUFBQUEsU0FBUyxDQUFDc25CLFdBQUQsRUFBY2pOLEtBQUssQ0FBQ3RGLEdBQU4sQ0FBVTdVLFdBQXhCLEVBQXFDbWEsS0FBSyxDQUFDdEYsR0FBTixDQUFVeEgsUUFBL0MsRUFBeUQ4TSxLQUFLLENBQUN0RixHQUFOLENBQVUzVSxLQUFuRSxDQUFUO0VBQ0gsU0FIRDtFQUlIO0VBQ0o7RUFDSjs7V0FFRDZnQixxQkFBQSw0QkFBbUJsRixHQUFuQixFQUF3QjtFQUFBOztFQUNwQixRQUFNM0YsS0FBSyxHQUFHLEtBQUtnRixVQUFMLENBQWdCVyxHQUFoQixDQUFkOztFQUNBLFFBQUksQ0FBQzNGLEtBQUwsRUFBWTtFQUNSO0VBQ0g7O0VBQ0QsUUFBTTZGLE1BQU0sR0FBRyxLQUFLZCxLQUFMLENBQVdhLFVBQVgsQ0FBc0JELEdBQXRCLENBQWY7RUFDQSxRQUFNOEksR0FBRyxHQUFHNUksTUFBTSxDQUFDK0MsTUFBUCxFQUFaOztFQUNBLFFBQUksQ0FBQyxLQUFLM0QsV0FBTCxDQUFpQndKLEdBQWpCLENBQUwsRUFBNEI7RUFFeEI7RUFDSDs7RUFDRCxRQUFNelIsSUFBSSxHQUFHLEtBQUtpSSxXQUFMLENBQWlCd0osR0FBakIsRUFBc0J6UixJQUFuQzs7RUFDQSxRQUFJLENBQUNBLElBQUwsRUFBVztFQUNQO0VBQ0g7O0VBRUQ2SSxJQUFBQSxNQUFNLENBQUNzTCxhQUFQOztFQUNBLFFBQU1DLFlBQVksR0FBR3ZMLE1BQU0sQ0FBQ3dMLGNBQVAsRUFBckI7O0VBQ0EsUUFBSXJVLElBQUksQ0FBQzhDLE1BQVQsRUFBaUI7RUFDYjlDLE1BQUFBLElBQUksQ0FBQzhDLE1BQUwsQ0FBWSxDQUFaLEVBQWVyQixLQUFmLENBQXFCcE0sT0FBckIsQ0FBNkIsVUFBQWtMLElBQUksRUFBSTtFQUNqQyxRQUFBLE9BQUksQ0FBQ2lULGlCQUFMLENBQXVCM0ssTUFBdkIsRUFBK0J0SSxJQUEvQjtFQUNILE9BRkQ7RUFHSDs7RUFDRCxRQUFNbEcsTUFBTSxHQUFHMkksS0FBSyxDQUFDa0wsV0FBckI7RUFDQTdULElBQUFBLE1BQU0sQ0FBQ2hGLE9BQVAsQ0FBZSxVQUFBNEgsSUFBSSxFQUFJO0VBSW5CLFVBQUlBLElBQUksQ0FBQ0MsSUFBVCxFQUFlO0VBQ1hELFFBQUFBLElBQUksQ0FBQ0MsSUFBTCxDQUFVMEosTUFBVixDQUFpQjNKLElBQUksQ0FBQ3NELElBQUwsQ0FBVXNHLFVBQTNCO0VBQ0E1SixRQUFBQSxJQUFJLENBQUM0UixVQUFMLENBQWdCLGNBQWhCLEVBQWdDNVIsSUFBSSxDQUFDQyxJQUFMLENBQVVzSixZQUExQztFQUNIOztFQUNELFVBQUl2SixJQUFJLENBQUNzRCxJQUFMLElBQWF0RCxJQUFJLENBQUNzRCxJQUFMLENBQVVzRyxVQUEzQixFQUF1QztFQUVuQ0UsUUFBQUEsT0FBSSxDQUFDRyxRQUFMLENBQWNrTixZQUFkLEVBQTRCQSxZQUE1QixFQUEwQ25YLElBQUksQ0FBQ3NELElBQUwsQ0FBVXNHLFVBQXBEO0VBQ0g7O0VBQ0Q1SixNQUFBQSxJQUFJLENBQUNxWCxpQkFBTCxDQUF1QkYsWUFBdkI7RUFDSCxLQWJEO0VBY0g7O1dBRURHLDJCQUFBLGtDQUF5QnRYLElBQXpCLEVBQStCNEwsTUFBL0IsRUFBdUM7RUFDbkMsUUFBTXpYLFVBQVUsR0FBR3lYLE1BQU0sQ0FBQzZILDBCQUFQLENBQWtDelQsSUFBSSxDQUFDMFIsY0FBdkMsQ0FBbkI7O0VBQ0EsUUFBTXJoQixNQUFNLEdBQUd5WixPQUFJLENBQUNHLFFBQUwsQ0FBYyxFQUFkLEVBQWtCMkIsTUFBTSxDQUFDMkwsZ0JBQVAsQ0FBd0IsQ0FBeEIsQ0FBbEIsRUFBOEN2WCxJQUFJLENBQUMwUixjQUFuRCxDQUFmO0VBQ0ExUixJQUFBQSxJQUFJLENBQUNxWCxpQkFBTCxDQUF1QmhuQixNQUF2Qjs7RUFDQSxTQUFLLElBQU1tbkIsR0FBWCxJQUFrQnJqQixVQUFsQixFQUE4QjtFQUMxQjZMLE1BQUFBLElBQUksQ0FBQ3lYLG1CQUFMLENBQXlCRCxHQUF6QixFQUE4QnJqQixVQUFVLENBQUNxakIsR0FBRCxDQUF4QztFQUNBeFgsTUFBQUEsSUFBSSxDQUFDMFgsYUFBTCxHQUFxQjlMLE1BQU0sQ0FBQzhILFFBQVAsRUFBckI7RUFDSDtFQUNKOztXQUVEaUUsZUFBQSxzQkFBYWpNLEdBQWIsRUFBa0I7RUFDZCxRQUFJemMsT0FBTyxDQUFDeWMsR0FBRCxDQUFYLEVBQWtCO0VBQ2QsV0FBS2tNLFlBQUwsQ0FBa0JsTSxHQUFsQjs7RUFDQSxhQUFPLEtBQUtYLFVBQUwsQ0FBZ0JXLEdBQWhCLENBQVA7RUFDQSxXQUFLbUosV0FBTDtFQUNIO0VBQ0o7O1dBRURnRCxhQUFBLHNCQUFhO0VBQ1QsU0FBSyxJQUFNbk0sR0FBWCxJQUFrQixLQUFLWCxVQUF2QixFQUFtQztFQUMvQixXQUFLNk0sWUFBTCxDQUFrQmxNLEdBQWxCO0VBQ0g7O0VBQ0QsU0FBS1gsVUFBTCxHQUFrQixFQUFsQjtFQUNBLFNBQUs4SixXQUFMO0VBQ0g7O1dBRUQrQyxlQUFBLHNCQUFhbE0sR0FBYixFQUFrQjtFQUFBOztFQUNkLFFBQUksQ0FBQyxLQUFLWCxVQUFMLENBQWdCVyxHQUFoQixDQUFMLEVBQTJCO0VBQ3ZCO0VBQ0g7O0VBQ0QsUUFBTUUsTUFBTSxHQUFHLEtBQUtkLEtBQUwsQ0FBV2EsVUFBWCxDQUFzQkQsR0FBdEIsQ0FBZjtFQUNBLFFBQU04SSxHQUFHLEdBQUc1SSxNQUFNLENBQUMrQyxNQUFQLEVBQVo7RUFDQSxTQUFLM0QsV0FBTCxDQUFpQndKLEdBQWpCLEVBQXNCaGMsS0FBdEIsSUFBK0IsQ0FBL0I7RUFDQSxRQUFNNEUsTUFBTSxHQUFHLEtBQUsyTixVQUFMLENBQWdCVyxHQUFoQixFQUFxQnVGLFdBQXBDO0VBQ0E3VCxJQUFBQSxNQUFNLENBQUNoRixPQUFQLENBQWUsVUFBQTRILElBQUksRUFBSTtFQUNuQixVQUFJLE9BQUksQ0FBQ2dMLFdBQUwsQ0FBaUJ3SixHQUFqQixFQUFzQmhjLEtBQXRCLElBQStCLENBQW5DLEVBQXNDO0VBQ2xDd0gsUUFBQUEsSUFBSSxDQUFDOE8sUUFBTCxDQUFjZ0osT0FBZDtFQUNIOztFQUNELFVBQUk5WCxJQUFJLENBQUNTLFFBQVQsRUFBbUI7RUFDZlQsUUFBQUEsSUFBSSxDQUFDUyxRQUFMLENBQWNxWCxPQUFkO0VBQ0g7O0VBQ0Q5WCxNQUFBQSxJQUFJLENBQUM4WCxPQUFMO0VBQ0gsS0FSRDtFQVNIOztXQUVEQyxrQkFBQSx5QkFBZ0J2RCxHQUFoQixFQUFxQjtFQUNqQixRQUFJLEtBQUt4SixXQUFMLElBQW9CLEtBQUtBLFdBQUwsQ0FBaUJ3SixHQUFqQixDQUF4QixFQUErQztFQUMzQyxXQUFLeEosV0FBTCxDQUFpQndKLEdBQWpCLEVBQXNCaGMsS0FBdEIsSUFBK0IsQ0FBL0I7O0VBQ0EsVUFBSSxLQUFLd1MsV0FBTCxDQUFpQndKLEdBQWpCLEVBQXNCaGMsS0FBdEIsSUFBK0IsQ0FBbkMsRUFBc0M7RUFDbEMsYUFBS3dTLFdBQUwsQ0FBaUJ3SixHQUFqQixFQUFzQjVGLFVBQXRCLENBQWlDeFcsT0FBakMsQ0FBeUMsVUFBQXlXLFNBQVMsRUFBSTtFQUNsREEsVUFBQUEsU0FBUyxDQUFDQyxRQUFWLENBQW1CZ0osT0FBbkI7RUFDSCxTQUZEOztFQUdBLGVBQU8sS0FBSzlNLFdBQUwsQ0FBaUJ3SixHQUFqQixDQUFQO0VBQ0g7RUFDSjtFQUNKOztXQUVEakksbUJBQUEsMEJBQWlCUCxNQUFqQixFQUF5QnBILE9BQXpCLEVBQWtDO0VBQzlCLFFBQU1vVCxLQUFLLEdBQUcsQ0FBQyxPQUFELEVBQVUsb0JBQVYsQ0FBZDtFQUNBLFFBQUluTCxPQUFPLEdBQUcsSUFBZDs7RUFFQSxTQUFLLElBQUlyZSxJQUFDLEdBQUcsQ0FBYixFQUFnQkEsSUFBQyxHQUFHd3BCLEtBQUssQ0FBQ3hyQixNQUExQixFQUFrQyxFQUFFZ0MsSUFBcEMsRUFBdUM7RUFDbkMsVUFBSTtFQUNBcWUsUUFBQUEsT0FBTyxHQUFHYixNQUFNLENBQUMzRSxVQUFQLENBQWtCMlEsS0FBSyxDQUFDeHBCLElBQUQsQ0FBdkIsRUFBNEJvVyxPQUE1QixDQUFWO0VBQ0gsT0FGRCxDQUVFLE9BQU96VixDQUFQLEVBQVU7O0VBQ1osVUFBSTBkLE9BQUosRUFBYTtFQUNUO0VBQ0g7RUFDSjs7RUFDRCxXQUFPQSxPQUFQO0VBRUg7O1dBRURvTCxZQUFBLG1CQUFVdmhCLENBQVYsRUFBYWhDLENBQWIsRUFBZ0JrUSxPQUFoQixFQUE4QjtFQUFBLFFBQWRBLE9BQWM7RUFBZEEsTUFBQUEsT0FBYyxHQUFKLEVBQUk7RUFBQTs7RUFDMUIsUUFBSSxDQUFDLEtBQUs2SSxRQUFWLEVBQW9CO0VBQ2hCLGFBQU8sSUFBUDtFQUNIOztFQUNELFFBQU05ZixHQUFHLEdBQUcsS0FBS21kLEtBQUwsQ0FBV2dDLE1BQVgsRUFBWjs7RUFDQSxRQUFJLEtBQUswRCxtQkFBVCxFQUE4QjtFQUMxQixVQUFJLENBQUMsS0FBS0gsY0FBVixFQUEwQjtFQUN0QixlQUFPLElBQVA7RUFDSDs7RUFDRCxVQUFNalQsTUFBTSxHQUFHLEtBQUtpVCxjQUFMLENBQW9CNkgsU0FBcEIsRUFBZjs7RUFDQSxXQUFLekssUUFBTCxDQUFjOEMsTUFBZCxDQUFxQm5ULE1BQXJCLEVBQTZCLEtBQUs4UCxTQUFsQyxFQUE2QyxJQUE3Qzs7RUFDQSxXQUFLc0QsbUJBQUwsR0FBMkIsS0FBM0I7RUFDSDs7RUFaeUIsOEJBYVcsS0FBSy9DLFFBQUwsQ0FBYzBLLElBQWQsQ0FDakN6aEIsQ0FEaUMsRUFFakNoQyxDQUZpQyxFQUdqQ2tRLE9BQU8sQ0FBQ3dULFNBQVIsSUFBcUIsQ0FIWSxFQUlqQztFQUNJLHdCQUFrQnpxQixHQUFHLENBQUN5ZjtFQUQxQixLQUppQyxFQU9qQztFQUNJQyxNQUFBQSxVQUFVLEVBQUUxZixHQUFHLENBQUMwZixVQURwQjtFQUVJRixNQUFBQSxVQUFVLEVBQUV4ZixHQUFHLENBQUN3ZixVQUZwQjtFQUdJa0wsTUFBQUEsV0FBVyxFQUFFO0VBSGpCLEtBUGlDLENBYlg7RUFBQSxRQWFsQkMsTUFia0IsdUJBYWxCQSxNQWJrQjtFQUFBLFFBYVZDLFNBYlUsdUJBYVZBLFNBYlU7RUFBQSxRQWFDQyxLQWJELHVCQWFDQSxLQWJEOztFQTBCMUIsUUFBTTlNLEdBQUcsR0FBRyxLQUFLK00sY0FBTCxDQUFvQkYsU0FBcEIsQ0FBWjs7RUFDQSxRQUFNbFYsTUFBTSxHQUFHLEtBQUt5SCxLQUFMLENBQVdhLFVBQVgsQ0FBc0JELEdBQXRCLENBQWY7RUFDQSxXQUFPO0VBQUU0TSxNQUFBQSxNQUFNLEVBQU5BLE1BQUY7RUFBVWpWLE1BQUFBLE1BQU0sRUFBTkEsTUFBVjtFQUFrQmtWLE1BQUFBLFNBQVMsRUFBVEEsU0FBbEI7RUFBNkJDLE1BQUFBLEtBQUssRUFBTEE7RUFBN0IsS0FBUDtFQUNIOztXQUVEQyxpQkFBQSx3QkFBZUYsU0FBZixFQUEwQjtFQUN0QixRQUFJLENBQUN0cEIsT0FBTyxDQUFDc3BCLFNBQUQsQ0FBWixFQUF5QjtFQUNyQixhQUFPLElBQVA7RUFDSDs7RUFDRCxRQUFJLEtBQUt6TixLQUFMLENBQVdhLFVBQVgsQ0FBc0I0TSxTQUF0QixDQUFKLEVBQXNDO0VBQ2xDLGFBQU9BLFNBQVA7RUFDSDs7RUFDRCxRQUFNclIsSUFBSSxHQUFHRCxNQUFNLENBQUNDLElBQVAsQ0FBWSxLQUFLNEQsS0FBTCxDQUFXYSxVQUF2QixDQUFiOztFQUNBLFNBQUssSUFBSW5kLElBQUMsR0FBRyxDQUFiLEVBQWdCQSxJQUFDLEdBQUcwWSxJQUFJLENBQUMxYSxNQUFMLEdBQWMsQ0FBbEMsRUFBcUNnQyxJQUFDLEVBQXRDLEVBQTBDO0VBQ3RDLFVBQU1rcUIsSUFBSSxHQUFHNVMsTUFBTSxDQUFDb0IsSUFBSSxDQUFDMVksSUFBRCxDQUFMLENBQW5CO0VBQ0EsVUFBTW1xQixJQUFJLEdBQUc3UyxNQUFNLENBQUNvQixJQUFJLENBQUMxWSxJQUFDLEdBQUcsQ0FBTCxDQUFMLENBQW5COztFQUNBLFVBQUsrcEIsU0FBUyxJQUFJRyxJQUFiLElBQXFCSCxTQUFTLEdBQUdJLElBQXRDLEVBQTZDO0VBQ3pDLGVBQU9ELElBQVA7RUFDSDtFQUNKOztFQUNELFFBQU1FLE1BQU0sR0FBRzlTLE1BQU0sQ0FBQ29CLElBQUksQ0FBQ0EsSUFBSSxDQUFDMWEsTUFBTCxHQUFjLENBQWYsQ0FBTCxDQUFyQjs7RUFDQSxRQUFJK3JCLFNBQVMsSUFBSUssTUFBakIsRUFBeUI7RUFDckIsYUFBT0EsTUFBUDtFQUNIOztFQUNELFdBQU8sSUFBUDtFQUNIOztXQUVEbEcsZUFBQSxzQkFBYVgsVUFBYixFQUF5QjtFQUNyQixXQUFPQSxVQUFVLEtBQUssS0FBZixJQUF3QkEsVUFBVSxLQUFLLFlBQXZDLElBQXVEQSxVQUFVLEtBQUssT0FBN0U7RUFDSDs7O0lBejBCMkI1QyxpQkFBQSxDQUFrQjBKOztFQy9FbEQsU0FBU0MsY0FBVCxDQUF3QkMsVUFBeEIsRUFBb0NDLFdBQXBDLEVBQWlEO0VBQzdDLE1BQUlDLEdBQUo7RUFDQSxNQUFJQyxpQkFBSixFQUF1QkMsY0FBdkI7O0VBQ0EsTUFBSSxDQUFDQyxvQkFBb0IsQ0FBQ0wsVUFBRCxDQUF6QixFQUF1QztFQUNuQ0UsSUFBQUEsR0FBRyxHQUFHLGVBQVk7RUFBRSxhQUFPRixVQUFQO0VBQW9CLEtBQXhDOztFQUNBRyxJQUFBQSxpQkFBaUIsR0FBRyxJQUFwQjtFQUNBQyxJQUFBQSxjQUFjLEdBQUcsSUFBakI7RUFFSCxHQUxELE1BS087RUFDSCxRQUFJRSx1QkFBdUIsR0FBR04sVUFBVSxDQUFDTyxLQUFYLElBQW9CLE9BQU9QLFVBQVUsQ0FBQ08sS0FBWCxDQUFpQixDQUFqQixFQUFvQixDQUFwQixDQUFQLEtBQWtDLFFBQXBGO0VBQ0EsUUFBSUMsZ0JBQWdCLEdBQUdGLHVCQUF1QixJQUFJTixVQUFVLENBQUM5ckIsUUFBWCxLQUF3QnVzQixTQUExRTtFQUNBLFFBQUlDLGFBQWEsR0FBR0osdUJBQXVCLElBQUksQ0FBQ0UsZ0JBQWhEO0VBQ0EsUUFBSXhiLElBQUksR0FBR2diLFVBQVUsQ0FBQ2hiLElBQVgsSUFBbUJpYixXQUFuQixJQUFrQyxhQUE3QztFQUVBLFFBQUlVLFFBQUo7O0VBQ0EsUUFBSTNiLElBQUksS0FBSyxhQUFiLEVBQTRCO0VBQ3hCMmIsTUFBQUEsUUFBUSxHQUFHQywyQkFBWDtFQUNILEtBRkQsTUFFTyxJQUFJNWIsSUFBSSxLQUFLLFVBQWIsRUFBeUI7RUFDNUIyYixNQUFBQSxRQUFRLEdBQUdFLHdCQUFYO0VBQ0gsS0FGTSxNQUVBLElBQUk3YixJQUFJLEtBQUssYUFBYixFQUE0QjtFQUMvQjJiLE1BQUFBLFFBQVEsR0FBR0csMkJBQVg7RUFDSCxLQUZNLE1BRUEsSUFBSTliLElBQUksS0FBSyxVQUFiLEVBQXlCO0VBQzVCMmIsTUFBQUEsUUFBUSxHQUFHSSx3QkFBWDtFQUNILEtBRk0sTUFFQTtFQUNILFlBQU0sSUFBSXZrQixLQUFKLENBQVUsNEJBQTRCd0ksSUFBNUIsR0FBbUMsR0FBN0MsQ0FBTjtFQUNIOztFQUVELFFBQUlzYix1QkFBSixFQUE2QjtFQUN6QixVQUFJVSxnQkFBZ0IsR0FBRyxFQUF2QjtFQUNBLFVBQUlDLG9CQUFvQixHQUFHLEVBQTNCOztFQUNBLFdBQUssSUFBSXZvQixDQUFDLEdBQUcsQ0FBYixFQUFnQkEsQ0FBQyxHQUFHc25CLFVBQVUsQ0FBQ08sS0FBWCxDQUFpQjlzQixNQUFyQyxFQUE2Q2lGLENBQUMsRUFBOUMsRUFBa0Q7RUFDOUMsWUFBSXdvQixJQUFJLEdBQUdsQixVQUFVLENBQUNPLEtBQVgsQ0FBaUI3bkIsQ0FBakIsQ0FBWDs7RUFDQSxZQUFJc29CLGdCQUFnQixDQUFDRSxJQUFJLENBQUMsQ0FBRCxDQUFKLENBQVFDLElBQVQsQ0FBaEIsS0FBbUNWLFNBQXZDLEVBQWtEO0VBQzlDTyxVQUFBQSxnQkFBZ0IsQ0FBQ0UsSUFBSSxDQUFDLENBQUQsQ0FBSixDQUFRQyxJQUFULENBQWhCLEdBQWlDO0VBQzdCQSxZQUFBQSxJQUFJLEVBQUVELElBQUksQ0FBQyxDQUFELENBQUosQ0FBUUMsSUFEZTtFQUU3Qm5jLFlBQUFBLElBQUksRUFBRWdiLFVBQVUsQ0FBQ2hiLElBRlk7RUFHN0I5USxZQUFBQSxRQUFRLEVBQUU4ckIsVUFBVSxDQUFDOXJCLFFBSFE7RUFJN0JrdEIsWUFBQUEsT0FBTyxFQUFFcEIsVUFBVSxDQUFDb0IsT0FKUztFQUs3QmIsWUFBQUEsS0FBSyxFQUFFO0VBTHNCLFdBQWpDO0VBT0g7O0VBQ0RTLFFBQUFBLGdCQUFnQixDQUFDRSxJQUFJLENBQUMsQ0FBRCxDQUFKLENBQVFDLElBQVQsQ0FBaEIsQ0FBK0JaLEtBQS9CLENBQXFDN3FCLElBQXJDLENBQTBDLENBQUN3ckIsSUFBSSxDQUFDLENBQUQsQ0FBSixDQUFRNXNCLEtBQVQsRUFBZ0I0c0IsSUFBSSxDQUFDLENBQUQsQ0FBcEIsQ0FBMUM7RUFDSDs7RUFFRCxXQUFLLElBQUl0akIsQ0FBVCxJQUFjb2pCLGdCQUFkLEVBQWdDO0VBQzVCQyxRQUFBQSxvQkFBb0IsQ0FBQ3ZyQixJQUFyQixDQUEwQixDQUFDc3JCLGdCQUFnQixDQUFDcGpCLENBQUQsQ0FBaEIsQ0FBb0J1akIsSUFBckIsRUFBMkJwQixjQUFjLENBQUNpQixnQkFBZ0IsQ0FBQ3BqQixDQUFELENBQWpCLENBQXpDLENBQTFCO0VBQ0g7O0VBQ0RzaUIsTUFBQUEsR0FBRyxHQUFHLGFBQVVpQixJQUFWLEVBQWdCRSxPQUFoQixFQUF5QjtFQUMzQixZQUFNL3NCLEtBQUssR0FBR3NzQiwyQkFBMkIsQ0FBQztFQUFFTCxVQUFBQSxLQUFLLEVBQUVVLG9CQUFUO0VBQStCSyxVQUFBQSxJQUFJLEVBQUV0QixVQUFVLENBQUNzQjtFQUFoRCxTQUFELEVBQXlESCxJQUF6RCxDQUEzQixDQUEwRkEsSUFBMUYsRUFBZ0dFLE9BQWhHLENBQWQ7RUFDQSxlQUFPLE9BQU8vc0IsS0FBUCxLQUFpQixVQUFqQixHQUE4QkEsS0FBSyxDQUFDNnNCLElBQUQsRUFBT0UsT0FBUCxDQUFuQyxHQUFxRC9zQixLQUE1RDtFQUNILE9BSEQ7O0VBSUE2ckIsTUFBQUEsaUJBQWlCLEdBQUcsS0FBcEI7RUFDQUMsTUFBQUEsY0FBYyxHQUFHLEtBQWpCO0VBRUgsS0EzQkQsTUEyQk8sSUFBSU0sYUFBSixFQUFtQjtFQUN0QlIsTUFBQUEsR0FBRyxHQUFHLGFBQVVpQixJQUFWLEVBQWdCO0VBQ2xCLFlBQU03c0IsS0FBSyxHQUFHcXNCLFFBQVEsQ0FBQ1gsVUFBRCxFQUFhbUIsSUFBYixDQUF0QjtFQUNBLGVBQU8sT0FBTzdzQixLQUFQLEtBQWlCLFVBQWpCLEdBQThCQSxLQUFLLENBQUM2c0IsSUFBRCxDQUFuQyxHQUE0QzdzQixLQUFuRDtFQUNILE9BSEQ7O0VBSUE2ckIsTUFBQUEsaUJBQWlCLEdBQUcsSUFBcEI7RUFDQUMsTUFBQUEsY0FBYyxHQUFHLEtBQWpCO0VBQ0gsS0FQTSxNQU9BO0VBQ0hGLE1BQUFBLEdBQUcsR0FBRyxhQUFVaUIsSUFBVixFQUFnQkUsT0FBaEIsRUFBeUI7RUFDM0IsWUFBTS9zQixLQUFLLEdBQUdxc0IsUUFBUSxDQUFDWCxVQUFELEVBQWFxQixPQUFPLEdBQUdBLE9BQU8sQ0FBQ3JCLFVBQVUsQ0FBQzlyQixRQUFaLENBQVYsR0FBa0MsSUFBdEQsQ0FBdEI7RUFDQSxlQUFPLE9BQU9JLEtBQVAsS0FBaUIsVUFBakIsR0FBOEJBLEtBQUssQ0FBQzZzQixJQUFELEVBQU9FLE9BQVAsQ0FBbkMsR0FBcUQvc0IsS0FBNUQ7RUFDSCxPQUhEOztFQUlBNnJCLE1BQUFBLGlCQUFpQixHQUFHLEtBQXBCO0VBQ0FDLE1BQUFBLGNBQWMsR0FBRyxJQUFqQjtFQUNIO0VBQ0o7O0VBQ0RGLEVBQUFBLEdBQUcsQ0FBQ0UsY0FBSixHQUFxQkEsY0FBckI7RUFDQUYsRUFBQUEsR0FBRyxDQUFDQyxpQkFBSixHQUF3QkEsaUJBQXhCO0VBQ0EsU0FBT0QsR0FBUDtFQUNIOztFQUVELFNBQVNxQixRQUFULENBQWtCcnNCLENBQWxCLEVBQXFCQyxDQUFyQixFQUF3QmdGLENBQXhCLEVBQTJCO0VBQ3ZCLE1BQUlqRixDQUFDLEtBQUt1ckIsU0FBVixFQUFxQixPQUFPdnJCLENBQVA7RUFDckIsTUFBSUMsQ0FBQyxLQUFLc3JCLFNBQVYsRUFBcUIsT0FBT3RyQixDQUFQO0VBQ3JCLE1BQUlnRixDQUFDLEtBQUtzbUIsU0FBVixFQUFxQixPQUFPdG1CLENBQVA7RUFDckIsU0FBTyxJQUFQO0VBQ0g7O0VBRUQsU0FBUzJtQiwyQkFBVCxDQUFxQ2QsVUFBckMsRUFBaUQxVyxLQUFqRCxFQUF3RDtFQUNwRCxPQUFLLElBQUk3VCxDQUFDLEdBQUcsQ0FBYixFQUFnQkEsQ0FBQyxHQUFHdXFCLFVBQVUsQ0FBQ08sS0FBWCxDQUFpQjlzQixNQUFyQyxFQUE2Q2dDLENBQUMsRUFBOUMsRUFBa0Q7RUFDOUMsUUFBSTZULEtBQUssS0FBSzBXLFVBQVUsQ0FBQ08sS0FBWCxDQUFpQjlxQixDQUFqQixFQUFvQixDQUFwQixDQUFkLEVBQXNDO0VBQ2xDLGFBQU91cUIsVUFBVSxDQUFDTyxLQUFYLENBQWlCOXFCLENBQWpCLEVBQW9CLENBQXBCLENBQVA7RUFDSDtFQUNKOztFQUNELFNBQU91cUIsVUFBVSxDQUFDb0IsT0FBbEI7RUFDSDs7RUFFRCxTQUFTUCx3QkFBVCxDQUFrQ2IsVUFBbEMsRUFBOEMxVyxLQUE5QyxFQUFxRDtFQUNqRCxPQUFLLElBQUk3VCxDQUFDLEdBQUcsQ0FBYixFQUFnQkEsQ0FBQyxHQUFHdXFCLFVBQVUsQ0FBQ08sS0FBWCxDQUFpQjlzQixNQUFyQyxFQUE2Q2dDLENBQUMsRUFBOUMsRUFBa0Q7RUFDOUMsUUFBSTZULEtBQUssR0FBRzBXLFVBQVUsQ0FBQ08sS0FBWCxDQUFpQjlxQixDQUFqQixFQUFvQixDQUFwQixDQUFaLEVBQW9DO0VBQ3ZDOztFQUNELFNBQU91cUIsVUFBVSxDQUFDTyxLQUFYLENBQWlCM29CLElBQUksQ0FBQzBULEdBQUwsQ0FBUzdWLENBQUMsR0FBRyxDQUFiLEVBQWdCLENBQWhCLENBQWpCLEVBQXFDLENBQXJDLENBQVA7RUFDSDs7RUFFRCxTQUFTbXJCLDJCQUFULENBQXFDWixVQUFyQyxFQUFpRDFXLEtBQWpELEVBQXdEO0VBQ3BELE1BQUlnWSxJQUFJLEdBQUd0QixVQUFVLENBQUNzQixJQUFYLEtBQW9CYixTQUFwQixHQUFnQ1QsVUFBVSxDQUFDc0IsSUFBM0MsR0FBa0QsQ0FBN0Q7RUFFQSxNQUFJN3JCLENBQUMsR0FBRyxDQUFSOztFQUNBLFNBQU8sSUFBUCxFQUFhO0VBQ1QsUUFBSUEsQ0FBQyxJQUFJdXFCLFVBQVUsQ0FBQ08sS0FBWCxDQUFpQjlzQixNQUExQixFQUFrQyxNQUFsQyxLQUNLLElBQUk2VixLQUFLLElBQUkwVyxVQUFVLENBQUNPLEtBQVgsQ0FBaUI5cUIsQ0FBakIsRUFBb0IsQ0FBcEIsQ0FBYixFQUFxQyxNQUFyQyxLQUNBQSxDQUFDO0VBQ1Q7O0VBRUQsTUFBSUEsQ0FBQyxLQUFLLENBQVYsRUFBYTtFQUNULFdBQU91cUIsVUFBVSxDQUFDTyxLQUFYLENBQWlCOXFCLENBQWpCLEVBQW9CLENBQXBCLENBQVA7RUFFSCxHQUhELE1BR08sSUFBSUEsQ0FBQyxLQUFLdXFCLFVBQVUsQ0FBQ08sS0FBWCxDQUFpQjlzQixNQUEzQixFQUFtQztFQUN0QyxXQUFPdXNCLFVBQVUsQ0FBQ08sS0FBWCxDQUFpQjlxQixDQUFDLEdBQUcsQ0FBckIsRUFBd0IsQ0FBeEIsQ0FBUDtFQUVILEdBSE0sTUFHQTtFQUNILFdBQU8rckIsV0FBVyxDQUNkbFksS0FEYyxFQUVkZ1ksSUFGYyxFQUdkdEIsVUFBVSxDQUFDTyxLQUFYLENBQWlCOXFCLENBQUMsR0FBRyxDQUFyQixFQUF3QixDQUF4QixDQUhjLEVBSWR1cUIsVUFBVSxDQUFDTyxLQUFYLENBQWlCOXFCLENBQWpCLEVBQW9CLENBQXBCLENBSmMsRUFLZHVxQixVQUFVLENBQUNPLEtBQVgsQ0FBaUI5cUIsQ0FBQyxHQUFHLENBQXJCLEVBQXdCLENBQXhCLENBTGMsRUFNZHVxQixVQUFVLENBQUNPLEtBQVgsQ0FBaUI5cUIsQ0FBakIsRUFBb0IsQ0FBcEIsQ0FOYyxDQUFsQjtFQVFIO0VBQ0o7O0VBRUQsU0FBU3NyQix3QkFBVCxDQUFrQ2YsVUFBbEMsRUFBOEMxVyxLQUE5QyxFQUFxRDtFQUNqRCxTQUFPaVksUUFBUSxDQUFDalksS0FBRCxFQUFRMFcsVUFBVSxDQUFDb0IsT0FBbkIsQ0FBZjtFQUNIOztFQUVELFNBQVNJLFdBQVQsQ0FBcUJsWSxLQUFyQixFQUE0QmdZLElBQTVCLEVBQWtDRyxVQUFsQyxFQUE4Q0MsVUFBOUMsRUFBMERDLFdBQTFELEVBQXVFQyxXQUF2RSxFQUFvRjtFQUNoRixNQUFJLE9BQU9ELFdBQVAsS0FBdUIsVUFBM0IsRUFBdUM7RUFDbkMsV0FBTyxZQUFZO0VBQ2YsVUFBSUUsY0FBYyxHQUFHRixXQUFXLENBQUNHLEtBQVosQ0FBa0JyQixTQUFsQixFQUE2QjVxQixTQUE3QixDQUFyQjtFQUNBLFVBQUlrc0IsY0FBYyxHQUFHSCxXQUFXLENBQUNFLEtBQVosQ0FBa0JyQixTQUFsQixFQUE2QjVxQixTQUE3QixDQUFyQjtFQUNBLGFBQU8yckIsV0FBVyxDQUFDbFksS0FBRCxFQUFRZ1ksSUFBUixFQUFjRyxVQUFkLEVBQTBCQyxVQUExQixFQUFzQ0csY0FBdEMsRUFBc0RFLGNBQXRELENBQWxCO0VBQ0gsS0FKRDtFQUtILEdBTkQsTUFNTyxJQUFJSixXQUFXLENBQUNsdUIsTUFBaEIsRUFBd0I7RUFDM0IsV0FBT3V1QixnQkFBZ0IsQ0FBQzFZLEtBQUQsRUFBUWdZLElBQVIsRUFBY0csVUFBZCxFQUEwQkMsVUFBMUIsRUFBc0NDLFdBQXRDLEVBQW1EQyxXQUFuRCxDQUF2QjtFQUNILEdBRk0sTUFFQTtFQUNILFdBQU9LLGlCQUFpQixDQUFDM1ksS0FBRCxFQUFRZ1ksSUFBUixFQUFjRyxVQUFkLEVBQTBCQyxVQUExQixFQUFzQ0MsV0FBdEMsRUFBbURDLFdBQW5ELENBQXhCO0VBQ0g7RUFDSjs7RUFFRCxTQUFTSyxpQkFBVCxDQUEyQjNZLEtBQTNCLEVBQWtDZ1ksSUFBbEMsRUFBd0NHLFVBQXhDLEVBQW9EQyxVQUFwRCxFQUFnRUMsV0FBaEUsRUFBNkVDLFdBQTdFLEVBQTBGO0VBQ3RGLE1BQUlNLFVBQVUsR0FBSVIsVUFBVSxHQUFHRCxVQUEvQjtFQUNBLE1BQUlVLFFBQVEsR0FBRzdZLEtBQUssR0FBR21ZLFVBQXZCO0VBRUEsTUFBSVcsS0FBSjs7RUFDQSxNQUFJZCxJQUFJLEtBQUssQ0FBYixFQUFnQjtFQUNaYyxJQUFBQSxLQUFLLEdBQUdELFFBQVEsR0FBR0QsVUFBbkI7RUFDSCxHQUZELE1BRU87RUFDSEUsSUFBQUEsS0FBSyxHQUFHLENBQUN4cUIsSUFBSSxDQUFDMlQsR0FBTCxDQUFTK1YsSUFBVCxFQUFlYSxRQUFmLElBQTJCLENBQTVCLEtBQWtDdnFCLElBQUksQ0FBQzJULEdBQUwsQ0FBUytWLElBQVQsRUFBZVksVUFBZixJQUE2QixDQUEvRCxDQUFSO0VBQ0g7O0VBRUQsU0FBUVAsV0FBVyxJQUFJLElBQUlTLEtBQVIsQ0FBWixHQUErQlIsV0FBVyxHQUFHUSxLQUFwRDtFQUNIOztFQUVELFNBQVNKLGdCQUFULENBQTBCMVksS0FBMUIsRUFBaUNnWSxJQUFqQyxFQUF1Q0csVUFBdkMsRUFBbURDLFVBQW5ELEVBQStEQyxXQUEvRCxFQUE0RUMsV0FBNUUsRUFBeUY7RUFDckYsTUFBSXJZLE1BQU0sR0FBRyxFQUFiOztFQUNBLE9BQUssSUFBSTlULENBQUMsR0FBRyxDQUFiLEVBQWdCQSxDQUFDLEdBQUdrc0IsV0FBVyxDQUFDbHVCLE1BQWhDLEVBQXdDZ0MsQ0FBQyxFQUF6QyxFQUE2QztFQUN6QzhULElBQUFBLE1BQU0sQ0FBQzlULENBQUQsQ0FBTixHQUFZd3NCLGlCQUFpQixDQUFDM1ksS0FBRCxFQUFRZ1ksSUFBUixFQUFjRyxVQUFkLEVBQTBCQyxVQUExQixFQUFzQ0MsV0FBVyxDQUFDbHNCLENBQUQsQ0FBakQsRUFBc0Rtc0IsV0FBVyxDQUFDbnNCLENBQUQsQ0FBakUsQ0FBN0I7RUFDSDs7RUFDRCxTQUFPOFQsTUFBUDtFQUNIOztBQVFELEVBQU8sU0FBUzhXLG9CQUFULENBQThCcHFCLEdBQTlCLEVBQW1DO0VBQ3RDLFNBQU9BLEdBQUcsSUFBSSxPQUFPQSxHQUFQLEtBQWUsUUFBdEIsS0FBbUNBLEdBQUcsQ0FBQ3NxQixLQUFKLElBQWF0cUIsR0FBRyxDQUFDL0IsUUFBSixJQUFnQitCLEdBQUcsQ0FBQytPLElBQUosS0FBYSxVQUE3RSxDQUFQO0VBQ0g7QUFRRCxFQUFPLFNBQVMrUyxxQkFBVCxDQUErQjloQixHQUEvQixFQUFvQztFQUN2QyxPQUFLLElBQU00RixDQUFYLElBQWdCNUYsR0FBaEIsRUFBcUI7RUFDakIsUUFBSW9xQixvQkFBb0IsQ0FBQ3BxQixHQUFHLENBQUM0RixDQUFELENBQUosQ0FBeEIsRUFBa0M7RUFDOUIsYUFBTyxJQUFQO0VBQ0g7RUFDSjs7RUFDRCxTQUFPLEtBQVA7RUFDSDtBQUVELEVBQU8sU0FBU3dtQixZQUFULENBQXNCckMsVUFBdEIsRUFBa0M7RUFDckMsU0FBT3NDLGVBQWUsQ0FBQ3RDLFVBQUQsRUFBYSxhQUFiLENBQXRCO0VBQ0g7QUFHRCxFQVVPLFNBQVN1QyxpQkFBVCxDQUEyQnRzQixHQUEzQixFQUFnQ3VzQixLQUFoQyxFQUF1QztFQUMxQyxNQUFJLENBQUN2c0IsR0FBTCxFQUFVO0VBQ04sV0FBTyxJQUFQO0VBQ0g7O0VBQ0QsTUFBSXdzQixHQUFHLEdBQUcsS0FBVjs7RUFDQSxNQUFJbnRCLEtBQUssQ0FBQ0MsT0FBTixDQUFjVSxHQUFkLENBQUosRUFBd0I7RUFDcEIsUUFBSXlzQixVQUFVLEdBQUcsRUFBakI7RUFBQSxRQUNJQyxNQURKOztFQUVBLFNBQUssSUFBSWx0QixDQUFDLEdBQUcsQ0FBYixFQUFnQkEsQ0FBQyxHQUFHUSxHQUFHLENBQUN4QyxNQUF4QixFQUFnQ2dDLENBQUMsRUFBakMsRUFBcUM7RUFDakNrdEIsTUFBQUEsTUFBTSxHQUFHSixpQkFBaUIsQ0FBQ3RzQixHQUFHLENBQUNSLENBQUQsQ0FBSixFQUFTK3NCLEtBQVQsQ0FBMUI7O0VBQ0EsVUFBSSxDQUFDRyxNQUFMLEVBQWE7RUFDVEQsUUFBQUEsVUFBVSxDQUFDaHRCLElBQVgsQ0FBZ0JPLEdBQUcsQ0FBQ1IsQ0FBRCxDQUFuQjtFQUNILE9BRkQsTUFFTztFQUNIaXRCLFFBQUFBLFVBQVUsQ0FBQ2h0QixJQUFYLENBQWdCaXRCLE1BQWhCO0VBQ0FGLFFBQUFBLEdBQUcsR0FBRyxJQUFOO0VBQ0g7RUFDSjs7RUFDRCxXQUFPQSxHQUFHLEdBQUdDLFVBQUgsR0FBZ0J6c0IsR0FBMUI7RUFDSDs7RUFDRCxNQUFJMnNCLE1BQU0sR0FBRztFQUNMLHlCQUFzQjtFQURqQixHQUFiO0VBQUEsTUFHSTlOLEtBQUssR0FBRyxFQUhaO0VBQUEsTUFJSWpaLENBSko7O0VBS0EsT0FBS0EsQ0FBTCxJQUFVNUYsR0FBVixFQUFlO0VBQ1gsUUFBSUEsR0FBRyxDQUFDNHNCLGNBQUosQ0FBbUJobkIsQ0FBbkIsQ0FBSixFQUEyQjtFQUN2QmlaLE1BQUFBLEtBQUssQ0FBQ3BmLElBQU4sQ0FBV21HLENBQVg7RUFDSDtFQUNKOztFQUVELE1BQU1pbkIsT0FBTyxHQUFHLFNBQVZBLE9BQVUsQ0FBVWpuQixDQUFWLEVBQWE7RUFDekJxUyxJQUFBQSxNQUFNLENBQUM2VSxjQUFQLENBQXNCSCxNQUF0QixFQUE4Qi9tQixDQUE5QixFQUFpQztFQUM3QmtHLE1BQUFBLEdBQUcsRUFBRSxlQUFZO0VBQ2IsWUFBSSxDQUFDLEtBQUssVUFBVWxHLENBQWYsQ0FBTCxFQUF3QjtFQUNwQixlQUFLLFVBQVVBLENBQWYsSUFBb0J3bUIsWUFBWSxDQUFDLEtBQUssTUFBTXhtQixDQUFYLENBQUQsQ0FBaEM7RUFDSDs7RUFDRCxlQUFPLEtBQUssVUFBVUEsQ0FBZixFQUFrQmltQixLQUFsQixDQUF3QixJQUF4QixFQUE4QlUsS0FBSyxFQUFuQyxDQUFQO0VBQ0gsT0FONEI7RUFPN0JsSyxNQUFBQSxHQUFHLEVBQUUsYUFBVTVoQixDQUFWLEVBQWE7RUFDZCxhQUFLLE1BQU1tRixDQUFYLElBQWdCbkYsQ0FBaEI7RUFDSCxPQVQ0QjtFQVU3QnNzQixNQUFBQSxZQUFZLEVBQUUsSUFWZTtFQVc3QkMsTUFBQUEsVUFBVSxFQUFFO0VBWGlCLEtBQWpDO0VBYUgsR0FkRDs7RUFnQkEsT0FBSyxJQUFJeHRCLEVBQUMsR0FBRyxDQUFSLEVBQVdtSixHQUFHLEdBQUdrVyxLQUFLLENBQUNyaEIsTUFBNUIsRUFBb0NnQyxFQUFDLEdBQUdtSixHQUF4QyxFQUE2Q25KLEVBQUMsRUFBOUMsRUFBa0Q7RUFDOUNvRyxJQUFBQSxDQUFDLEdBQUdpWixLQUFLLENBQUNyZixFQUFELENBQVQ7O0VBQ0EsUUFBSTRxQixvQkFBb0IsQ0FBQ3BxQixHQUFHLENBQUM0RixDQUFELENBQUosQ0FBeEIsRUFBa0M7RUFDOUI0bUIsTUFBQUEsR0FBRyxHQUFHLElBQU47RUFDQUcsTUFBQUEsTUFBTSxDQUFDLE1BQU0vbUIsQ0FBUCxDQUFOLEdBQWtCNUYsR0FBRyxDQUFDNEYsQ0FBRCxDQUFyQjtFQUNBaW5CLE1BQUFBLE9BQU8sQ0FBQ2puQixDQUFELENBQVA7RUFDSCxLQUpELE1BSU87RUFDSCttQixNQUFBQSxNQUFNLENBQUMvbUIsQ0FBRCxDQUFOLEdBQVk1RixHQUFHLENBQUM0RixDQUFELENBQWY7RUFDSDtFQUNKOztFQUNELFNBQU80bUIsR0FBRyxHQUFHRyxNQUFILEdBQVkzc0IsR0FBdEI7RUFDSDtBQVFEO0VBWUEsU0FBU3FzQixlQUFULENBQXlCdEMsVUFBekIsRUFBcUNDLFdBQXJDLEVBQWtEO0VBQzlDLE1BQUksQ0FBQ0ksb0JBQW9CLENBQUNMLFVBQUQsQ0FBekIsRUFBdUM7RUFDbkMsV0FBTyxZQUFZO0VBQUUsYUFBT0EsVUFBUDtFQUFvQixLQUF6QztFQUNIOztFQUNEQSxFQUFBQSxVQUFVLEdBQUc1ckIsSUFBSSxDQUFDdVAsS0FBTCxDQUFXdlAsSUFBSSxDQUFDQyxTQUFMLENBQWUyckIsVUFBZixDQUFYLENBQWI7RUFDQSxNQUFJSSxjQUFjLEdBQUcsSUFBckI7RUFDQSxNQUFJRCxpQkFBaUIsR0FBRyxJQUF4QjtFQUNBLE1BQU1JLEtBQUssR0FBR1AsVUFBVSxDQUFDTyxLQUF6Qjs7RUFDQSxPQUFLLElBQUk5cUIsQ0FBQyxHQUFHLENBQWIsRUFBZ0JBLENBQUMsR0FBRzhxQixLQUFLLENBQUM5c0IsTUFBMUIsRUFBa0NnQyxDQUFDLEVBQW5DLEVBQXVDO0VBQ25DLFFBQUk0cUIsb0JBQW9CLENBQUNFLEtBQUssQ0FBQzlxQixDQUFELENBQUwsQ0FBUyxDQUFULENBQUQsQ0FBeEIsRUFBdUM7RUFDbkMsVUFBTWlLLEdBQUUsR0FBR3FnQixjQUFjLENBQUNRLEtBQUssQ0FBQzlxQixDQUFELENBQUwsQ0FBUyxDQUFULENBQUQsRUFBY3dxQixXQUFkLENBQXpCOztFQUNBRyxNQUFBQSxjQUFjLEdBQUdBLGNBQWMsSUFBSTFnQixHQUFFLENBQUMwZ0IsY0FBdEM7RUFDQUQsTUFBQUEsaUJBQWlCLEdBQUdBLGlCQUFpQixJQUFJemdCLEdBQUUsQ0FBQ3lnQixpQkFBNUM7RUFDQUksTUFBQUEsS0FBSyxDQUFDOXFCLENBQUQsQ0FBTCxHQUFXLENBQUM4cUIsS0FBSyxDQUFDOXFCLENBQUQsQ0FBTCxDQUFTLENBQVQsQ0FBRCxFQUFjaUssR0FBZCxDQUFYO0VBQ0g7RUFDSjs7RUFDRCxNQUFNQSxFQUFFLEdBQUdxZ0IsY0FBYyxDQUFDQyxVQUFELEVBQWFDLFdBQWIsQ0FBekI7RUFDQXZnQixFQUFBQSxFQUFFLENBQUMwZ0IsY0FBSCxHQUFvQkEsY0FBYyxJQUFJMWdCLEVBQUUsQ0FBQzBnQixjQUF6QztFQUNBMWdCLEVBQUFBLEVBQUUsQ0FBQ3lnQixpQkFBSCxHQUF1QkEsaUJBQWlCLElBQUl6Z0IsRUFBRSxDQUFDeWdCLGlCQUEvQztFQUNBLFNBQU96Z0IsRUFBUDtFQUNIOztFQzFTRCxJQUFNd2pCLGdCQUFnQixHQUFHLENBQUMsQ0FBRCxFQUFJLENBQUosRUFBTyxDQUFQLENBQXpCO0VBR0EsSUFBTXJYLE9BQU8sR0FBRztFQUNac1gsRUFBQUEsT0FBTyxFQUFHO0VBREUsQ0FBaEI7O01BSXFCQzs7O0VBQ2pCLHNCQUFZQyxXQUFaLEVBQXlCeFgsT0FBekIsRUFBa0M7RUFBQTs7RUFFOUIsa0NBQU1BLE9BQU47O0VBQ0EsUUFBSXdYLFdBQUosRUFBaUI7RUFDYixZQUFLQyxjQUFMLENBQW9CRCxXQUFwQjtFQUNIOztFQUNELFVBQUtFLE9BQUwsR0FBZSxLQUFmOztFQUNBLFVBQUtDLFdBQUw7O0VBQ0EsVUFBS3JGLGFBQUw7O0VBQ0EsVUFBS3NGLEtBQUwsR0FBYSxZQUFiO0VBVDhCO0VBVWpDOztlQUVNQyxXQUFQLGtCQUFnQjFaLElBQWhCLEVBQXNCO0VBQ2xCLFdBQU8sSUFBSW9aLFVBQUosQ0FBZXBaLElBQUksQ0FBQ3FaLFdBQXBCLEVBQWlDclosSUFBSSxDQUFDNkIsT0FBdEMsQ0FBUDtFQUNIOzs7O1dBRUQ4WCxZQUFBLHFCQUFZO0VBQUE7O0VBQ1IsUUFBTWxJLEdBQUcsR0FBRyxLQUFLN0YsTUFBTCxFQUFaO0VBQ0EsUUFBTS9OLEtBQUssR0FBRzRULEdBQUcsQ0FBQ21JLFdBQUosQ0FBZ0IsR0FBaEIsQ0FBZDtFQUNBLFFBQU1DLElBQUksR0FBR3BJLEdBQUcsQ0FBQzVuQixLQUFKLENBQVUsQ0FBVixFQUFhZ1UsS0FBYixDQUFiO0VBQ0EsUUFBTWljLE9BQU8sR0FBR3JJLEdBQUcsQ0FBQzVuQixLQUFKLENBQVU0bkIsR0FBRyxDQUFDbUksV0FBSixDQUFnQixHQUFoQixDQUFWLENBQWhCOztFQUNBLFFBQUlFLE9BQU8sS0FBSyxPQUFoQixFQUF5QjtFQUNyQixhQUFPamdCLENBQUEsQ0FBVUgsT0FBVixDQUFrQitYLEdBQWxCLEVBQXVCLEVBQXZCLEVBQTJCemYsSUFBM0IsQ0FBZ0MsVUFBQ2dPLElBQUQsRUFBVTtFQUM3QyxRQUFBLE1BQUksQ0FBQytaLFNBQUwsR0FBaUIvWixJQUFqQjtFQUNBLFlBQU1nYSxNQUFNLEdBQUcsSUFBSW5nQixDQUFKLENBQW9CZ2dCLElBQXBCLEVBQTBCN1osSUFBMUIsQ0FBZjtFQUNBLGVBQU8sTUFBSSxDQUFDaWEsZUFBTCxDQUFxQkQsTUFBckIsQ0FBUDtFQUNILE9BSk0sQ0FBUDtFQUtILEtBTkQsTUFNTyxJQUFJRixPQUFPLEtBQUssTUFBaEIsRUFBd0I7RUFDM0IsYUFBT2pnQixDQUFBLENBQVVMLGNBQVYsQ0FBeUJpWSxHQUF6QixFQUE4QixFQUE5QixFQUFrQ3pmLElBQWxDLENBQXVDLFVBQUFnTyxJQUFJLEVBQUk7RUFDbEQsUUFBQSxNQUFJLENBQUMrWixTQUFMLEdBQWlCL1osSUFBakI7RUFDQSxZQUFNZ2EsTUFBTSxHQUFHLElBQUluZ0IsQ0FBSixDQUFvQmdnQixJQUFwQixFQUEwQjtFQUFFamUsVUFBQUEsTUFBTSxFQUFHb0UsSUFBSSxDQUFDakgsSUFBaEI7RUFBc0JtRCxVQUFBQSxVQUFVLEVBQUc7RUFBbkMsU0FBMUIsQ0FBZjtFQUNBLGVBQU8sTUFBSSxDQUFDK2QsZUFBTCxDQUFxQkQsTUFBckIsQ0FBUDtFQUNILE9BSk0sQ0FBUDtFQUtIOztFQUNELFdBQU8sSUFBUDtFQUNIOztXQUVEQyxrQkFBQSx5QkFBZ0JELE1BQWhCLEVBQXdCO0VBQUE7O0VBQ3BCLFdBQU9BLE1BQU0sQ0FBQ2hZLElBQVAsR0FBY2hRLElBQWQsQ0FBbUIsVUFBQWtvQixRQUFRLEVBQUk7RUFDbEMsTUFBQSxNQUFJLENBQUNDLFlBQUwsQ0FBa0JELFFBQWxCOztFQUNBLGFBQU9BLFFBQVA7RUFDSCxLQUhNLENBQVA7RUFJSDs7V0FFRFYsY0FBQSx1QkFBYztFQUNWLFFBQUksS0FBSzNYLE9BQUwsQ0FBYXVZLE1BQWpCLEVBQXlCO0VBQ3JCLFdBQUtDLFNBQUwsQ0FBZSxLQUFLeFksT0FBTCxDQUFhdVksTUFBNUI7RUFDSCxLQUZELE1BRU87RUFDSCxXQUFLdlksT0FBTCxDQUFhdVksTUFBYixHQUFzQixFQUF0QjtFQUNBLFdBQUtFLGFBQUwsR0FBcUIsRUFBckI7RUFDSDtFQUNKOztXQUVEM0ksZUFBQSx3QkFBZTtFQUNYLFdBQU8sS0FBSzRJLFNBQVo7RUFDSDs7V0FFREosZUFBQSxzQkFBYXBoQixJQUFiLEVBQW1CO0VBQ2YsU0FBS3doQixTQUFMLEdBQWlCeGhCLElBQWpCO0VBQ0g7O1dBRUR5aEIsZUFBQSx3QkFBZTtFQUNYLFdBQU8sS0FBS1QsU0FBWjtFQUNIOztXQUVEVSxtQkFBQSwwQkFBaUJDLElBQWpCLEVBQXVCcHdCLEtBQXZCLEVBQThCO0VBQzFCLFNBQUt1WCxPQUFMLENBQWF1WSxNQUFiLEdBQXNCLEtBQUt2WSxPQUFMLENBQWF1WSxNQUFiLElBQXVCLEVBQTdDO0VBQ0EsU0FBS3ZZLE9BQUwsQ0FBYXVZLE1BQWIsQ0FBb0JNLElBQXBCLElBQTRCcHdCLEtBQTVCO0VBQ0g7O1dBRURxd0IseUJBQUEsZ0NBQXVCRCxJQUF2QixFQUE2QnB3QixLQUE3QixFQUFvQztFQUNoQyxTQUFLZ3dCLGFBQUwsR0FBcUIsS0FBS0EsYUFBTCxJQUFzQixFQUEzQztFQUNBLFNBQUtBLGFBQUwsQ0FBbUJJLElBQW5CLElBQTJCcHdCLEtBQTNCO0VBQ0g7O1dBRUR5ZixTQUFBLGtCQUFTO0VBQ0wsUUFBSSxDQUFDLEtBQUs2USxNQUFWLEVBQWtCO0VBQ2QsYUFBTyxJQUFQO0VBQ0g7O0VBQ0QsV0FBTyxLQUFLQSxNQUFMLENBQVk3USxNQUFaLEVBQVA7RUFDSDs7V0FFRDhRLFdBQUEsb0JBQVc7RUFDUCxXQUFPLEtBQUtELE1BQVo7RUFDSDs7V0FFREUsU0FBQSxnQkFBT3JKLEdBQVAsRUFBWTtFQUFBOztFQUNSLFFBQU1zSixNQUFNLEdBQUcsS0FBS25QLE1BQUwsRUFBZjs7RUFDQSxTQUFLNk8sZ0JBQUwsQ0FBc0IsS0FBdEIsRUFBNkJoSixHQUE3Qjs7RUFDQSxRQUFJLEtBQUttSixNQUFULEVBQWlCO0VBQ2IsV0FBS0EsTUFBTCxDQUFZSSxhQUFaLENBQTBCLElBQTFCLEVBQWdDaHBCLElBQWhDLENBQXFDLFlBQU07RUFFdkMsUUFBQSxNQUFJLENBQUM0b0IsTUFBTCxDQUFZSyxtQkFBWixDQUFnQ0YsTUFBaEM7O0VBQ0EsUUFBQSxNQUFJLENBQUNsUixJQUFMLENBQVUsY0FBVjtFQUNILE9BSkQ7RUFLSDs7RUFDRCxTQUFLcVIsTUFBTCxHQUFjLElBQWQ7RUFDQSxXQUFPLElBQVA7RUFDSDs7V0FFRHRQLFNBQUEsa0JBQVM7RUFDTCxRQUFNd08sTUFBTSxHQUFHLEtBQUtlLGtCQUFMLE1BQTZCLEVBQTVDO0VBQ0EsV0FBT2YsTUFBTSxDQUFDM0ksR0FBUCxJQUFjLFFBQXJCO0VBQ0g7O1dBRUQySixRQUFBLGVBQU1yVCxLQUFOLEVBQWE7RUFDVCxRQUFJLEtBQUs2UyxNQUFULEVBQWlCO0VBQ2IsWUFBTSxJQUFJcG9CLEtBQUosQ0FBVSxvRUFBVixDQUFOO0VBQ0g7O0VBQ0QsU0FBS29vQixNQUFMLEdBQWM3UyxLQUFkOztFQUNBLFNBQUs2UyxNQUFMLENBQVlTLFNBQVosQ0FBc0IsSUFBdEI7O0VBQ0EsV0FBTyxJQUFQO0VBQ0g7O1dBRURDLFNBQUEsa0JBQVM7RUFDTCxRQUFJLEtBQUtWLE1BQVQsRUFBaUI7RUFDYixXQUFLQSxNQUFMLENBQVlXLFlBQVosQ0FBeUIsSUFBekI7O0VBQ0EsYUFBTyxLQUFLWCxNQUFaO0VBQ0g7RUFDSjs7V0FFRFksT0FBQSxnQkFBTztFQUNILFNBQUszWixPQUFMLENBQWFzWCxPQUFiLEdBQXVCLElBQXZCO0VBQ0EsU0FBSytCLE1BQUwsR0FBYyxJQUFkO0VBQ0EsV0FBTyxJQUFQO0VBQ0g7O1dBRURPLE9BQUEsZ0JBQU87RUFDSCxTQUFLNVosT0FBTCxDQUFhc1gsT0FBYixHQUF1QixLQUF2QjtFQUNBLFNBQUsrQixNQUFMLEdBQWMsSUFBZDtFQUNIOztXQUVEOU4sWUFBQSxxQkFBWTtFQUNSLFdBQU8sS0FBS3ZMLE9BQUwsQ0FBYXNYLE9BQXBCO0VBQ0g7O1dBRUR1QyxpQkFBQSwwQkFBaUI7RUFDYixXQUFPLEtBQUtDLFlBQVo7RUFDSDs7V0FHRHJDLGlCQUFBLHdCQUFlRCxXQUFmLEVBQTRCO0VBQ3hCLFFBQUkvdEIsS0FBSyxDQUFDQyxPQUFOLENBQWM4dEIsV0FBZCxDQUFKLEVBQWdDO0VBQzVCLFdBQUtzQyxZQUFMLEdBQW9CLElBQUlDLG1CQUFKLENBQWV2QyxXQUFmLENBQXBCO0VBQ0gsS0FGRCxNQUVPO0VBQ0gsV0FBS3NDLFlBQUwsR0FBb0J0QyxXQUFwQjtFQUNIOztFQUNELFNBQUs2QixNQUFMLEdBQWMsSUFBZDtFQUNBLFdBQU8sSUFBUDtFQUNIOztXQUVEM3RCLE9BQUEsZ0JBQU87RUFDSCxRQUFNc3VCLFFBQVEsR0FBRyxLQUFLQyxNQUFMLEVBQWpCO0VBQ0EsV0FBTzFDLFVBQVUsQ0FBQ00sUUFBWCxDQUFvQm1DLFFBQXBCLENBQVA7RUFDSDs7V0FFREUsUUFBQSxlQUFNQyxFQUFOLEVBQVU7RUFDTixTQUFLbmEsT0FBTCxDQUFhbWEsRUFBYixHQUFrQkEsRUFBbEI7RUFDSDs7V0FFREMsUUFBQSxpQkFBUTtFQUNKLFdBQU8sS0FBS3BhLE9BQUwsQ0FBYW1hLEVBQXBCO0VBQ0g7O1dBR0RFLFlBQUEsbUJBQVVsUixNQUFWLEVBQWtCO0VBRWQsU0FBS25KLE9BQUwsQ0FBYXVZLE1BQWIsQ0FBb0JwUCxNQUFwQixHQUE2QkEsTUFBN0I7O0VBQ0EsUUFBSSxLQUFLNFAsTUFBVCxFQUFpQjtFQUNiLFdBQUtBLE1BQUwsQ0FBWW5QLGlCQUFaLENBQThCLElBQTlCO0VBQ0g7O0VBQ0QsU0FBS3lQLE1BQUwsR0FBYyxJQUFkO0VBQ0EsV0FBTyxJQUFQO0VBQ0g7O1dBRUR4UCxZQUFBLHFCQUFZO0VBQ1IsUUFBTTBPLE1BQU0sR0FBRyxLQUFLZSxrQkFBTCxNQUE2QixFQUE1QztFQUNBLFdBQU9mLE1BQU0sQ0FBQ3BQLE1BQVAsSUFBaUIsT0FBeEI7RUFDSDs7V0FFRG1SLGNBQUEscUJBQVl0UixRQUFaLEVBQXNCO0VBQ2xCLFNBQUtoSixPQUFMLENBQWF1WSxNQUFiLENBQW9CdlAsUUFBcEIsR0FBK0J1UixhQUFJLENBQUN6d0IsTUFBTCxDQUFZLEVBQVosRUFBZ0JrZixRQUFoQixDQUEvQjtFQUNBLFNBQUtxUSxNQUFMLEdBQWMsSUFBZDtFQUNBLFdBQU8sSUFBUDtFQUNIOztXQUVEOU0sY0FBQSx1QkFBYztFQUNWLFFBQU1nTSxNQUFNLEdBQUcsS0FBS2Usa0JBQUwsTUFBNkIsRUFBNUM7RUFDQSxXQUFPZixNQUFNLENBQUN2UCxRQUFkO0VBQ0g7O1dBRURnRSxhQUFBLG9CQUFXNEYsR0FBWCxFQUFnQm5xQixLQUFoQixFQUF1QjtFQUNuQixRQUFNOHZCLE1BQU0sR0FBRyxLQUFLdlksT0FBTCxDQUFhdVksTUFBNUI7O0VBQ0EsUUFBSSxDQUFDQSxNQUFNLENBQUN2UCxRQUFaLEVBQXNCO0VBQ2xCdVAsTUFBQUEsTUFBTSxDQUFDdlAsUUFBUCxHQUFrQixFQUFsQjtFQUNIOztFQUNEdVAsSUFBQUEsTUFBTSxDQUFDdlAsUUFBUCxDQUFnQjRKLEdBQWhCLElBQXVCbnFCLEtBQXZCO0VBQ0EsU0FBSzR3QixNQUFMLEdBQWMsSUFBZDtFQUNBLFdBQU8sSUFBUDtFQUNIOztXQUVEbUIsYUFBQSxvQkFBVzVILEdBQVgsRUFBZ0I7RUFDWixRQUFNMkYsTUFBTSxHQUFHLEtBQUtlLGtCQUFMLE1BQTZCLEVBQTVDOztFQUNBLFFBQUksQ0FBQ2YsTUFBTSxDQUFDdlAsUUFBWixFQUFzQjtFQUNsQixhQUFPLElBQVA7RUFDSDs7RUFDRCxXQUFPdVAsTUFBTSxDQUFDdlAsUUFBUCxDQUFnQjRKLEdBQWhCLENBQVA7RUFDSDs7V0FHRDZILGNBQUEscUJBQVk1ZSxRQUFaLEVBQXNCO0VBQ2xCLFNBQUttRSxPQUFMLENBQWF1WSxNQUFiLENBQW9CMWMsUUFBcEIsR0FBK0JBLFFBQS9CO0VBQ0EsU0FBS3dkLE1BQUwsR0FBYyxJQUFkO0VBQ0EsV0FBTyxJQUFQO0VBQ0g7O1dBRUQvZixjQUFBLHVCQUFjO0VBQ1YsUUFBTWlmLE1BQU0sR0FBRyxLQUFLZSxrQkFBTCxNQUE2QixFQUE1QztFQUNBLFdBQU9mLE1BQU0sQ0FBQzFjLFFBQWQ7RUFDSDs7V0FFRG9RLGFBQUEsc0JBQWE7RUFDVCxRQUFNc00sTUFBTSxHQUFHLEtBQUtlLGtCQUFMLE1BQTZCLEVBQTVDO0VBQ0EsV0FBT2YsTUFBTSxDQUFDbUMsU0FBUCxJQUFvQixLQUFLaEMsU0FBekIsSUFBc0MsS0FBS0EsU0FBTCxDQUFlbmEsVUFBNUQ7RUFDSDs7V0FFRG9jLGVBQUEsc0JBQWFDLFdBQWIsRUFBMEI7RUFDdEIsU0FBS3ZCLE1BQUwsR0FBYyxJQUFkO0VBQ0EsU0FBS3JaLE9BQUwsQ0FBYXVZLE1BQWIsQ0FBb0JtQyxTQUFwQixHQUFnQ0UsV0FBaEM7RUFDQSxXQUFPLElBQVA7RUFDSDs7V0FFREMsbUJBQUEsMEJBQWlCQyxNQUFqQixFQUF5QjtFQUNyQixTQUFLOWEsT0FBTCxDQUFhdVksTUFBYixDQUFvQndDLElBQXBCLEdBQTJCRCxNQUEzQjtFQUNBLFdBQU8sSUFBUDtFQUNIOztXQUVEL0ksV0FBQSxvQkFBVztFQUNQLFdBQU8sS0FBSy9SLE9BQUwsQ0FBYXVZLE1BQWIsQ0FBb0J3QyxJQUEzQjtFQUNIOztXQUVEakosb0JBQUEsNkJBQW9CO0VBQ2hCLFFBQU15RyxNQUFNLEdBQUcsS0FBS2Usa0JBQUwsTUFBNkIsRUFBNUM7RUFDQSxXQUFPZixNQUFNLENBQUMxRyxLQUFQLElBQWdCLEdBQXZCO0VBQ0g7O1dBRURtSixvQkFBQSwyQkFBa0JuSixLQUFsQixFQUF5QjtFQUNyQixTQUFLN1IsT0FBTCxDQUFhdVksTUFBYixDQUFvQjFHLEtBQXBCLEdBQTRCQSxLQUE1QjtFQUNBLFdBQU8sSUFBUDtFQUNIOztXQUVEbkUsZUFBQSxzQkFBYXVOLFVBQWIsRUFBeUI7RUFDckIsUUFBTWx5QixHQUFHLEdBQUcsS0FBS21mLE1BQUwsRUFBWjs7RUFDQSxRQUFJbmYsR0FBSixFQUFTO0VBQ0wsYUFBT215QixpQkFBaUIsQ0FBQ255QixHQUFELEVBQU1reUIsVUFBVSxJQUFJLEtBQUtwQixjQUFMLEVBQXBCLENBQXhCO0VBQ0g7O0VBQ0QsV0FBTyxJQUFQO0VBQ0g7O1dBRURzQixpQkFBQSx3QkFBZWx3QixXQUFmLEVBQTRCO0VBQ3hCLFNBQUsrVSxPQUFMLENBQWF1WSxNQUFiLENBQW9CdHRCLFdBQXBCLEdBQWtDQSxXQUFXLElBQUksQ0FBQyxDQUFELEVBQUksQ0FBSixFQUFPLENBQVAsQ0FBakQ7O0VBQ0EsU0FBS3FuQixhQUFMOztFQUNBLFdBQU8sSUFBUDtFQUNIOztXQUVEOEksaUJBQUEsMEJBQWlCO0VBQ2IsUUFBTTdDLE1BQU0sR0FBRyxLQUFLZSxrQkFBTCxNQUE2QixFQUE1QztFQUNBLFdBQU9mLE1BQU0sQ0FBQ3R0QixXQUFQLElBQXNCLENBQUMsQ0FBRCxFQUFJLENBQUosRUFBTyxDQUFQLENBQTdCO0VBQ0g7O1dBRURvd0IsdUJBQUEsZ0NBQXVCO0VBQ25CLFFBQU1DLEtBQUssR0FBRyxLQUFLRixjQUFMLEVBQWQ7O0VBQ0EsUUFBTTNOLFFBQVEsR0FBRyxLQUFLQyxZQUFMLEVBQWpCOztFQUNBLFFBQUlELFFBQUosRUFBYztFQUNWLGFBQU9wWSxPQUFJLENBQUNrbUIsR0FBTCxDQUFTLEVBQVQsRUFBYUQsS0FBYixFQUFvQjdOLFFBQXBCLENBQVA7RUFDSDs7RUFDRCxXQUFPNk4sS0FBUDtFQUNIOztXQUVERSxjQUFBLHFCQUFZQyxNQUFaLEVBQW9CQyxNQUFwQixFQUE0QkMsTUFBNUIsRUFBb0M7RUFDaEMsU0FBSzNiLE9BQUwsQ0FBYXVZLE1BQWIsQ0FBb0JqZ0IsUUFBcEIsR0FBK0IsQ0FBQ21qQixNQUFELEVBQVNDLE1BQVQsRUFBaUJDLE1BQWpCLENBQS9COztFQUNBLFNBQUtySixhQUFMOztFQUNBLFdBQU8sSUFBUDtFQUNIOztXQUVEc0osY0FBQSx1QkFBYztFQUNWLFFBQU1yRCxNQUFNLEdBQUcsS0FBS2Usa0JBQUwsTUFBNkIsRUFBNUM7RUFDQSxXQUFPZixNQUFNLENBQUNqZ0IsUUFBUCxJQUFtQitlLGdCQUExQjtFQUNIOztXQVlEd0UsV0FBQSxrQkFBUzF3QixLQUFULEVBQWdCO0VBQ1osU0FBSzZVLE9BQUwsQ0FBYXVZLE1BQWIsQ0FBb0JwdEIsS0FBcEIsR0FBNEJBLEtBQUssSUFBSSxDQUFDLENBQUQsRUFBSSxDQUFKLEVBQU8sQ0FBUCxDQUFyQzs7RUFDQSxTQUFLbW5CLGFBQUw7O0VBQ0EsV0FBTyxJQUFQO0VBQ0g7O1dBRUR3SixXQUFBLG9CQUFXO0VBQ1AsUUFBTXZELE1BQU0sR0FBRyxLQUFLZSxrQkFBTCxNQUE2QixFQUE1QztFQUNBLFdBQU9mLE1BQU0sQ0FBQ3B0QixLQUFQLElBQWdCLENBQUMsQ0FBRCxFQUFJLENBQUosRUFBTyxDQUFQLENBQXZCO0VBQ0g7O1dBRURxdEIsWUFBQSxtQkFBVUQsTUFBVixFQUFrQjtFQUNkLFNBQUt3RCxTQUFMLENBQWV4RCxNQUFmOztFQUNBLFNBQUt2WSxPQUFMLENBQWF1WSxNQUFiLEdBQXNCLEtBQUt5RCxjQUFMLENBQW9CekQsTUFBcEIsQ0FBdEI7O0VBQ0EsU0FBSzBELGdCQUFMOztFQUNBLFdBQU8sSUFBUDtFQUNIOztXQUVEQyxZQUFBLHFCQUFZO0VBQ1IsV0FBTyxLQUFLbGMsT0FBTCxDQUFhdVksTUFBcEI7RUFDSDs7V0FFRDRELG1CQUFBLDBCQUFpQjVELE1BQWpCLEVBQXlCO0VBQ3JCLFNBQUtFLGFBQUwsR0FBcUIsS0FBS3VELGNBQUwsQ0FBb0J6RCxNQUFwQixDQUFyQjs7RUFDQSxTQUFLMEQsZ0JBQUw7O0VBQ0EsV0FBTyxJQUFQO0VBQ0g7O1dBRUQzQyxxQkFBQSw4QkFBcUI7RUFDakIsUUFBSWYsTUFBTSxHQUFHLElBQWI7O0VBQ0EsUUFBSSxDQUFDanVCLGFBQWEsQ0FBQyxLQUFLMFYsT0FBTCxDQUFhdVksTUFBZCxDQUFsQixFQUF5QztFQUNyQ0EsTUFBQUEsTUFBTSxHQUFHLEtBQUt2WSxPQUFMLENBQWF1WSxNQUF0QjtFQUNILEtBRkQsTUFFTyxJQUFJLENBQUNqdUIsYUFBYSxDQUFDLEtBQUttdUIsYUFBTixDQUFsQixFQUF3QztFQUMzQ0YsTUFBQUEsTUFBTSxHQUFHLEtBQUtFLGFBQWQ7RUFDSDs7RUFDRCxXQUFPRixNQUFQO0VBQ0g7O1dBRUQ2RCxxQkFBQSw0QkFBbUJoeUIsR0FBbkIsRUFBd0I7RUFBQTs7RUFDcEIsV0FBT3NzQixpQkFBaUIsQ0FBQ3RzQixHQUFELEVBQU0sWUFBTTtFQUNoQyxVQUFNckIsR0FBRyxHQUFHLE1BQUksQ0FBQ21mLE1BQUwsRUFBWjs7RUFDQSxVQUFJbmYsR0FBSixFQUFTO0VBQ0wsWUFBTXVzQixJQUFJLEdBQUd2c0IsR0FBRyxDQUFDc3pCLE9BQUosRUFBYjtFQUNBLGVBQU8sQ0FBQy9HLElBQUQsQ0FBUDtFQUNILE9BSEQsTUFHTztFQUNILGVBQU8sSUFBUDtFQUNIO0VBQ0osS0FSdUIsQ0FBeEI7RUFTSDs7V0FFRDBHLGlCQUFBLHdCQUFlekQsTUFBZixFQUF1QjtFQUNuQixRQUFNK0QsVUFBVSxHQUFHL3pCLElBQUksQ0FBQ3VQLEtBQUwsQ0FBV3ZQLElBQUksQ0FBQ0MsU0FBTCxDQUFlK3ZCLE1BQWYsQ0FBWCxDQUFuQjs7RUFDQSxRQUFNZ0UsY0FBYyxHQUFHLEtBQUtILGtCQUFMLENBQXdCRSxVQUF4QixDQUF2Qjs7RUFDQSxRQUFJQyxjQUFjLElBQUlBLGNBQWMsQ0FBQ3ZULFFBQXJDLEVBQStDO0VBQzNDdVQsTUFBQUEsY0FBYyxDQUFDdlQsUUFBZixHQUEwQixLQUFLb1Qsa0JBQUwsQ0FBd0I3RCxNQUFNLENBQUN2UCxRQUEvQixDQUExQjtFQUNIOztFQUVELFdBQU8sS0FBS3dULGtCQUFaO0VBQ0EsV0FBT0QsY0FBUDtFQUNIOztXQUVEclEsd0JBQUEsb0NBQXdCO0VBRXBCLFFBQUk3aEIsT0FBTyxDQUFDLEtBQUtteUIsa0JBQU4sQ0FBWCxFQUFzQztFQUNsQyxhQUFPLEtBQUtBLGtCQUFaO0VBQ0g7O0VBQ0QsUUFBTWpFLE1BQU0sR0FBRyxLQUFLZSxrQkFBTCxFQUFmOztFQUNBLFNBQUtrRCxrQkFBTCxHQUEyQnRRLHFCQUFxQixDQUFDcU0sTUFBRCxDQUFyQixJQUFrQ0EsTUFBTSxJQUFJQSxNQUFNLENBQUN2UCxRQUFqQixJQUE2QmtELHFCQUFxQixDQUFDcU0sTUFBTSxDQUFDdlAsUUFBUixDQUEvRztFQUNBLFdBQU8sS0FBS3dULGtCQUFaO0VBQ0g7O1dBRURQLG1CQUFBLDRCQUFtQjtFQUNmLFNBQUszSixhQUFMOztFQUVBLFFBQUksS0FBS3lHLE1BQVQsRUFBaUI7RUFDYixXQUFLQSxNQUFMLENBQVluUCxpQkFBWixDQUE4QixJQUE5QjtFQUNIO0VBQ0o7O1dBRUQ2UyxlQUFBLHNCQUFhbEUsTUFBYixFQUFxQjtFQUNqQixRQUFNK0QsVUFBVSxHQUFHLEtBQUtOLGNBQUwsQ0FBb0J6RCxNQUFwQixDQUFuQjs7RUFDQSxTQUFLd0QsU0FBTCxDQUFlTyxVQUFmOztFQUNBLFNBQUssSUFBTTF5QixJQUFYLElBQWdCMHlCLFVBQWhCLEVBQTRCO0VBQ3hCLFdBQUsxRCxnQkFBTCxDQUFzQmh2QixJQUF0QixFQUF5QjB5QixVQUFVLENBQUMxeUIsSUFBRCxDQUFuQztFQUNIOztFQUNELFNBQUtxeUIsZ0JBQUw7RUFDSDs7V0FFREYsWUFBQSxtQkFBVXhELE1BQVYsRUFBa0I7RUFDZCxRQUFNVyxNQUFNLEdBQUcsS0FBS25QLE1BQUwsRUFBZjtFQUNBLFFBQU0yUyxNQUFNLEdBQUduRSxNQUFNLENBQUMzSSxHQUF0Qjs7RUFDQSxRQUFJOE0sTUFBTSxJQUFJQSxNQUFNLEtBQUt4RCxNQUF6QixFQUFpQztFQUM3QixXQUFLRCxNQUFMLENBQVl5RCxNQUFaO0VBQ0g7RUFDSjs7V0FFREMsaUJBQUEsd0JBQWVseEIsTUFBZixFQUF1QjtFQUNuQixTQUFLbXhCLFlBQUwsR0FBb0JueEIsTUFBcEI7RUFDQSxXQUFPLElBQVA7RUFDSDs7V0FFRCttQixpQkFBQSwwQkFBaUI7RUFDYixTQUFLb0ssWUFBTCxHQUFvQixLQUFLQSxZQUFMLElBQXFCMVgsT0FBSSxDQUFDb0wsUUFBTCxDQUFjLEVBQWQsQ0FBekM7RUFDQSxXQUFPLEtBQUtzTSxZQUFaO0VBQ0g7O1dBRUR0SyxnQkFBQSx5QkFBZ0I7RUFDWixRQUFNaGEsUUFBUSxHQUFHLEtBQUtzakIsV0FBTCxFQUFqQjtFQUNBLFFBQU1pQixTQUFTLEdBQUdDLE9BQUksQ0FBQ0MsU0FBTCxDQUFlLEVBQWYsRUFBbUJ6a0IsUUFBUSxDQUFDLENBQUQsQ0FBUixJQUFlLENBQWxDLEVBQXFDQSxRQUFRLENBQUMsQ0FBRCxDQUFSLElBQWUsQ0FBcEQsRUFBdURBLFFBQVEsQ0FBQyxDQUFELENBQVIsSUFBZSxDQUF0RSxDQUFsQjtFQUNBLFNBQUtza0IsWUFBTCxHQUFvQjFYLE9BQUksQ0FBQ3RULDRCQUFMLENBQWtDLEVBQWxDLEVBQXNDaXJCLFNBQXRDLEVBQWlELEtBQUt4QixvQkFBTCxFQUFqRCxFQUE4RSxLQUFLUyxRQUFMLEVBQTlFLENBQXBCO0VBQ0EsU0FBS3pDLE1BQUwsR0FBYyxJQUFkO0VBQ0g7O1dBRUQyRCxnQkFBQSx1QkFBYzdOLFVBQWQsRUFBMEI7RUFDdEIsU0FBS25QLE9BQUwsQ0FBYW1QLFVBQWIsR0FBMEJBLFVBQTFCO0VBQ0EsV0FBTyxJQUFQO0VBQ0g7O1dBRUQ4TixnQkFBQSx5QkFBZ0I7RUFDWixXQUFPLEtBQUtqZCxPQUFMLENBQWFtUCxVQUFwQjtFQUNIOztXQUVEbEksVUFBQSxtQkFBVTtFQUNOLFdBQU8sS0FBS29TLE1BQVo7RUFDSDs7V0FFRGxOLFdBQUEsa0JBQVMrUSxLQUFULEVBQWdCO0VBQ1osU0FBSzdELE1BQUwsR0FBYzZELEtBQWQ7RUFDQSxXQUFPLElBQVA7RUFDSDs7V0FHRGpPLEtBQUEsWUFBR2tPLE1BQUgsRUFBV0MsUUFBWCxFQUFxQm5WLE9BQXJCLEVBQThCO0VBQzFCLHlCQUFNZ0gsRUFBTixZQUFTa08sTUFBVCxFQUFpQkMsUUFBakIsRUFBMkJuVixPQUFPLElBQUksSUFBdEM7O0VBQ0EsUUFBSSxLQUFLOFEsTUFBVCxFQUFpQjtFQUNiLFdBQUtBLE1BQUwsQ0FBWXNFLFVBQVosQ0FBdUJGLE1BQXZCO0VBQ0g7RUFDSjs7V0FFREcsTUFBQSxhQUFJSCxNQUFKLEVBQVlDLFFBQVosRUFBc0JuVixPQUF0QixFQUErQjtFQUMzQix5QkFBTXFWLEdBQU4sWUFBVUgsTUFBVixFQUFrQkMsUUFBbEIsRUFBNEJuVixPQUFPLElBQUksSUFBdkM7O0VBQ0EsUUFBSSxLQUFLOFEsTUFBVCxFQUFpQjtFQUNiLFdBQUtBLE1BQUwsQ0FBWXdFLGFBQVo7RUFDSDtFQUNKOztXQUVEdEQsU0FBQSxrQkFBUztFQUNMLFdBQU8xeEIsSUFBSSxDQUFDdVAsS0FBTCxDQUFXdlAsSUFBSSxDQUFDQyxTQUFMLENBQWU7RUFDN0JndkIsTUFBQUEsV0FBVyxFQUFHLEtBQUtxQyxjQUFMLEVBRGU7RUFFN0I3WixNQUFBQSxPQUFPLEVBQUcsS0FBS0E7RUFGYyxLQUFmLENBQVgsQ0FBUDtFQUlIOztXQUdEd2QsZ0JBQUEsdUJBQWN0dEIsS0FBZCxFQUFxQjtFQUNqQixTQUFLd25CLE9BQUwsR0FBZXhuQixLQUFmO0VBQ0g7O1dBRUR1dEIsV0FBQSxvQkFBVztFQUNQLFdBQU8sS0FBSy9GLE9BQVo7RUFDSDs7V0FFRGxLLFVBQUEsbUJBQVU7RUFDTixXQUFPLEtBQUtvSyxLQUFaO0VBQ0g7O1dBRUQ4RixVQUFBLG1CQUFVO0VBQ04sV0FBTyxLQUFLM1IsSUFBWjtFQUNIOzs7SUFyZG1DNFIsa0JBQVMsQ0FBQ0Msb0JBQVcsQ0FBQ0MsY0FBRCxDQUFaO0VBd2RqRHRHLFVBQVUsQ0FBQ3VHLFlBQVgsQ0FBd0I5ZCxPQUF4Qjs7RUFFQSxTQUFTa2IsaUJBQVQsQ0FBMkJueUIsR0FBM0IsRUFBZ0NreUIsVUFBaEMsRUFBNENscEIsQ0FBNUMsRUFBbUQ7RUFBQSxNQUFQQSxDQUFPO0VBQVBBLElBQUFBLENBQU8sR0FBSCxDQUFHO0VBQUE7O0VBQy9DLE1BQUksQ0FBQ2hKLEdBQUQsSUFBUSxFQUFFa3lCLFVBQVUsWUFBWWxCLG1CQUF4QixDQUFaLEVBQWlEO0VBQzdDLFdBQU8sSUFBUDtFQUNIOztFQUNELE1BQU0vcEIsQ0FBQyxHQUFHakgsR0FBRyxDQUFDZzFCLGlCQUFKLENBQXNCOUMsVUFBdEIsRUFBa0MrQyxhQUFhLENBQUNqMUIsR0FBRCxDQUEvQyxDQUFWO0VBQ0EsU0FBTyxDQUFDaUgsQ0FBQyxDQUFDOEIsQ0FBSCxFQUFNOUIsQ0FBQyxDQUFDRixDQUFSLEVBQVdpQyxDQUFYLENBQVA7RUFDSDs7RUFFRCxTQUFTaXNCLGFBQVQsQ0FBdUJqMUIsR0FBdkIsRUFBNEI7RUFDeEIsU0FBT0EsR0FBRyxDQUFDazFCLFNBQUosRUFBUDtFQUNIOztFQzllRCxJQUFNMzJCLE9BQUssR0FBRyxDQUVWLE9BRlUsRUFHVixTQUhVLEVBSVYsWUFKVSxFQUtWLFlBTFUsRUFNVixjQU5VLEVBT1YsaUJBUFUsRUFRVixvQkFSVSxFQVNWLFNBVFUsRUFVVixtQkFWVSxFQVdUMmEsTUFYUyxDQVdGLFVBQUNpYyxJQUFELEVBQU8xekIsQ0FBUCxFQUFhO0VBQ2pCMHpCLEVBQUFBLElBQUksQ0FBQzF6QixDQUFELENBQUosR0FBVSxJQUFWO0VBQ0EsU0FBTzB6QixJQUFQO0VBQ0gsQ0FkUyxFQWNQLEVBZE8sQ0FBZDtFQWdCQSxJQUFNQyxPQUFPLEdBQUc7RUFDWkMsRUFBQUEsVUFBVSxFQUFFLG9CQUFVQyxPQUFWLEVBQW1CO0VBQzNCLFFBQUk5RCxhQUFJLENBQUMrRCxRQUFMLENBQWNELE9BQWQsQ0FBSixFQUE0QjtFQUN4QkEsTUFBQUEsT0FBTyxHQUFHOUQsYUFBSSxDQUFDZ0UsU0FBTCxDQUFlRixPQUFmLENBQVY7RUFDSDs7RUFDRCxRQUFJNTBCLEtBQUssQ0FBQ0MsT0FBTixDQUFjMjBCLE9BQWQsQ0FBSixFQUE0QjtFQUN4QixVQUFNRyxVQUFVLEdBQUcsRUFBbkI7O0VBQ0EsV0FBSyxJQUFJNTBCLENBQUMsR0FBRyxDQUFSLEVBQVdtSixHQUFHLEdBQUdzckIsT0FBTyxDQUFDejJCLE1BQTlCLEVBQXNDZ0MsQ0FBQyxHQUFHbUosR0FBMUMsRUFBK0NuSixDQUFDLEVBQWhELEVBQW9EO0VBQ2hELFlBQU02MEIsR0FBRyxHQUFHTixPQUFPLENBQUNPLFFBQVIsQ0FBaUJMLE9BQU8sQ0FBQ3owQixDQUFELENBQXhCLENBQVo7O0VBQ0EsWUFBSUgsS0FBSyxDQUFDQyxPQUFOLENBQWMrMEIsR0FBZCxDQUFKLEVBQXdCO0VBQ3BCbEUsVUFBQUEsYUFBSSxDQUFDb0UsTUFBTCxDQUFZSCxVQUFaLEVBQXdCQyxHQUF4QjtFQUNILFNBRkQsTUFFTztFQUNIRCxVQUFBQSxVQUFVLENBQUMzMEIsSUFBWCxDQUFnQjQwQixHQUFoQjtFQUNIO0VBQ0o7O0VBQ0QsYUFBT0QsVUFBUDtFQUNILEtBWEQsTUFXTztFQUNILFVBQU1JLFNBQVMsR0FBR1QsT0FBTyxDQUFDTyxRQUFSLENBQWlCTCxPQUFqQixDQUFsQjs7RUFDQSxhQUFPTyxTQUFQO0VBQ0g7RUFDSixHQXBCVztFQXNCWkYsRUFBQUEsUUFBUSxFQUFFLGtCQUFVdmdCLElBQVYsRUFBZ0I7RUFDdEIsUUFBSSxDQUFDQSxJQUFELElBQVNvYyxhQUFJLENBQUNwd0IsS0FBTCxDQUFXZ1UsSUFBSSxDQUFDLE1BQUQsQ0FBZixDQUFiLEVBQXVDO0VBQ25DLGFBQU8sSUFBUDtFQUNIOztFQUNELFFBQU1oRixJQUFJLEdBQUdnRixJQUFJLENBQUMsTUFBRCxDQUFqQjs7RUFDQSxRQUFJaEYsSUFBSSxLQUFLLFNBQWIsRUFBd0I7RUFDcEIsVUFBTThCLENBQUMsR0FBR2tELElBQUksQ0FBQyxVQUFELENBQWQ7O0VBQ0EsVUFBTStMLFFBQVEsR0FBR2lVLE9BQU8sQ0FBQ08sUUFBUixDQUFpQnpqQixDQUFqQixDQUFqQjs7RUFDQSxVQUFJLENBQUNpUCxRQUFMLEVBQWU7RUFDWCxlQUFPLElBQVA7RUFDSDs7RUFDREEsTUFBQUEsUUFBUSxDQUFDZ1EsS0FBVCxDQUFlL2IsSUFBSSxDQUFDLElBQUQsQ0FBbkI7RUFDQStMLE1BQUFBLFFBQVEsQ0FBQzhTLGFBQVQsQ0FBdUI3ZSxJQUFJLENBQUMsWUFBRCxDQUEzQjtFQUNBLGFBQU8rTCxRQUFQO0VBQ0gsS0FURCxNQVNPLElBQUkvUSxJQUFJLEtBQUssbUJBQWIsRUFBa0M7RUFDckMsVUFBTTBsQixRQUFRLEdBQUcxZ0IsSUFBSSxDQUFDLFVBQUQsQ0FBckI7O0VBQ0EsVUFBSSxDQUFDMGdCLFFBQUwsRUFBZTtFQUNYLGVBQU8sSUFBUDtFQUNIOztFQUNELFVBQU05SCxNQUFNLEdBQUdvSCxPQUFPLENBQUNDLFVBQVIsQ0FBbUJTLFFBQW5CLENBQWY7RUFDQSxhQUFPOUgsTUFBUDtFQUNILEtBUE0sTUFPQSxJQUFJNWQsSUFBSSxLQUFLLE9BQWIsRUFBc0I7RUFDekIsYUFBTyxJQUFJb2UsVUFBSixDQUFlcFosSUFBSSxDQUFDLGFBQUQsQ0FBbkIsQ0FBUDtFQUNILEtBRk0sTUFFQSxJQUFJaEYsSUFBSSxLQUFLLG9CQUFiLEVBQW1DO0VBQ3RDLFVBQU02USxVQUFVLEdBQUc3TCxJQUFJLENBQUMsWUFBRCxDQUF2QjtFQUNBLFVBQU0yZ0IsS0FBSyxHQUFHLEVBQWQ7RUFDQSxVQUFNL3JCLEdBQUcsR0FBR2lYLFVBQVUsQ0FBQ3BpQixNQUF2Qjs7RUFDQSxXQUFLLElBQUlnQyxDQUFDLEdBQUcsQ0FBYixFQUFnQkEsQ0FBQyxHQUFHbUosR0FBcEIsRUFBeUJuSixDQUFDLEVBQTFCLEVBQThCO0VBQzFCazFCLFFBQUFBLEtBQUssQ0FBQ2oxQixJQUFOLENBQVdzMEIsT0FBTyxDQUFDTyxRQUFSLENBQWlCMVUsVUFBVSxDQUFDcGdCLENBQUQsQ0FBM0IsQ0FBWDtFQUNIOztFQUNELGFBQU9rMUIsS0FBUDtFQUNILEtBUk0sTUFRQTtFQUNILFlBQU0sSUFBSW51QixLQUFKLENBQVUseURBQVYsQ0FBTjtFQUNIO0VBQ0osR0F4RFc7RUEwRFpvdUIsRUFBQUEsU0FBUyxFQUFHLG1CQUFVVixPQUFWLEVBQW1CO0VBQzNCLFFBQUksQ0FBQ0EsT0FBRCxJQUFZLE9BQU9BLE9BQVAsS0FBbUIsUUFBbkMsRUFBNkMsT0FBTyxLQUFQO0VBQzdDLFFBQUksQ0FBQ0EsT0FBTyxDQUFDbGxCLElBQWIsRUFBbUIsT0FBTyxLQUFQO0VBQ25CLFFBQUksQ0FBQzdSLE9BQUssQ0FBQysyQixPQUFPLENBQUNsbEIsSUFBVCxDQUFWLEVBQTBCLE9BQU8sS0FBUDtFQUMxQixXQUFPLElBQVA7RUFDSDtFQS9EVyxDQUFoQjs7QUNuQkEsaUJBQWU7RUFDWCxXQUFTO0VBQ0x1aEIsSUFBQUEsU0FBUyxFQUFFLElBRE47RUFFTEssSUFBQUEsSUFBSSxFQUFFLElBRkQ7RUFHTGxKLElBQUFBLEtBQUssRUFBRSxJQUhGO0VBSUw1bUIsSUFBQUEsV0FBVyxFQUFFLElBSlI7RUFLTHFOLElBQUFBLFFBQVEsRUFBRSxJQUxMO0VBTUxuTixJQUFBQSxLQUFLLEVBQUUsSUFORjtFQU9MNnpCLElBQUFBLEtBQUssRUFBRSxNQVBGO0VBUUw3VixJQUFBQSxNQUFNLEVBQUUsTUFSSDtFQVNMOFYsSUFBQUEsS0FBSyxFQUFFLE1BVEY7RUFVTEMsSUFBQUEsU0FBUyxFQUFFLElBVk47RUFXTEMsSUFBQUEsYUFBYSxFQUFFLE1BWFY7RUFZTEMsSUFBQUEsWUFBWSxFQUFFLEtBWlQ7RUFhTEMsSUFBQUEsWUFBWSxFQUFFLEtBYlQ7RUFjTEMsSUFBQUEsYUFBYSxFQUFFLE1BZFY7RUFlTEMsSUFBQUEsZUFBZSxFQUFFLE9BZlo7RUFnQkxDLElBQUFBLGdCQUFnQixFQUFFLE1BaEJiO0VBaUJMQyxJQUFBQSxpQkFBaUIsRUFBRSxPQWpCZDtFQWtCTEMsSUFBQUEsT0FBTyxFQUFFLEtBbEJKO0VBbUJMQyxJQUFBQSxVQUFVLEVBQUUsS0FuQlA7RUFvQkxDLElBQUFBLFNBQVMsRUFBRSxLQXBCTjtFQXFCTEMsSUFBQUEsU0FBUyxFQUFFLEtBckJOO0VBc0JMQyxJQUFBQSxJQUFJLEVBQUcsS0F0QkY7RUF1QkxDLElBQUFBLE1BQU0sRUFBRyxNQXZCSjtFQXdCTEMsSUFBQUEsU0FBUyxFQUFFLElBeEJOO0VBeUJMeFksSUFBQUEsS0FBSyxFQUFFLEtBekJGO0VBMEJMeVksSUFBQUEsY0FBYyxFQUFFLE1BMUJYO0VBMkJMQyxJQUFBQSxVQUFVLEVBQUUsTUEzQlA7RUE0QkxDLElBQUFBLFNBQVMsRUFBRSxJQTVCTjtFQTZCTHZuQixJQUFBQSxPQUFPLEVBQUUsSUE3Qko7RUE4QkxtUyxJQUFBQSxLQUFLLEVBQUUsSUE5QkY7RUErQkwxTyxJQUFBQSxLQUFLLEVBQUUsSUEvQkY7RUFnQ0xrWixJQUFBQSxPQUFPLEVBQUUsS0FoQ0o7RUFpQ0w2SyxJQUFBQSxVQUFVLEVBQUUsSUFqQ1A7RUFrQ0xDLElBQUFBLElBQUksRUFBRyxJQWxDRjtFQW1DTEMsSUFBQUEsV0FBVyxFQUFHLE1BbkNUO0VBb0NMQyxJQUFBQSxXQUFXLEVBQUcsTUFwQ1Q7RUFxQ0xDLElBQUFBLFdBQVcsRUFBRyxNQXJDVDtFQXNDTEMsSUFBQUEsV0FBVyxFQUFHLE1BdENUO0VBdUNMQyxJQUFBQSxVQUFVLEVBQUcsTUF2Q1I7RUF3Q0xDLElBQUFBLE9BQU8sRUFBRyxJQXhDTDtFQXlDTEMsSUFBQUEsY0FBYyxFQUFHLFFBekNaO0VBMENMQyxJQUFBQSxVQUFVLEVBQUcsUUExQ1I7RUEyQ0xDLElBQUFBLFVBQVUsRUFBRyxPQTNDUjtFQTRDTEMsSUFBQUEsVUFBVSxFQUFHLE9BNUNSO0VBNkNMQyxJQUFBQSxLQUFLLEVBQUcsS0E3Q0g7RUE4Q0xDLElBQUFBLFVBQVUsRUFBRyxJQTlDUjtFQStDTEMsSUFBQUEsVUFBVSxFQUFHLElBL0NSO0VBZ0RMQyxJQUFBQSxVQUFVLEVBQUcsSUFoRFI7RUFpRExDLElBQUFBLFNBQVMsRUFBRyxJQWpEUDtFQWtETEMsSUFBQUEsUUFBUSxFQUFHLElBbEROO0VBbURMQyxJQUFBQSxPQUFPLEVBQUcsSUFuREw7RUFvRExDLElBQUFBLE1BQU0sRUFBRyxJQXBESjtFQXFETEMsSUFBQUEsTUFBTSxFQUFHLElBckRKO0VBc0RMQyxJQUFBQSxPQUFPLEVBQUc7RUF0REwsR0FERTtFQXlEWCxXQUFTO0VBQ0wvRyxJQUFBQSxTQUFTLEVBQUUsV0FETjtFQUVMSyxJQUFBQSxJQUFJLEVBQUUsTUFGRDtFQUdMbEosSUFBQUEsS0FBSyxFQUFFLE9BSEY7RUFJTDVtQixJQUFBQSxXQUFXLEVBQUUsYUFKUjtFQUtMcU4sSUFBQUEsUUFBUSxFQUFFLFVBTEw7RUFNTG5OLElBQUFBLEtBQUssRUFBRSxPQU5GO0VBT0w2ekIsSUFBQUEsS0FBSyxFQUFFLE9BUEY7RUFRTDdWLElBQUFBLE1BQU0sRUFBRSxRQVJIO0VBU0w4VixJQUFBQSxLQUFLLEVBQUUsT0FURjtFQVVMQyxJQUFBQSxTQUFTLEVBQUUsV0FWTjtFQVdMQyxJQUFBQSxhQUFhLEVBQUUsZ0JBWFY7RUFZTEMsSUFBQUEsWUFBWSxFQUFFLGVBWlQ7RUFhTEMsSUFBQUEsWUFBWSxFQUFFLGVBYlQ7RUFjTEMsSUFBQUEsYUFBYSxFQUFFLGdCQWRWO0VBZUxDLElBQUFBLGVBQWUsRUFBRSxrQkFmWjtFQWdCTEMsSUFBQUEsZ0JBQWdCLEVBQUUsbUJBaEJiO0VBaUJMQyxJQUFBQSxpQkFBaUIsRUFBRSxvQkFqQmQ7RUFrQkxDLElBQUFBLE9BQU8sRUFBRSxTQWxCSjtFQW1CTEMsSUFBQUEsVUFBVSxFQUFFLGFBbkJQO0VBb0JMQyxJQUFBQSxTQUFTLEVBQUUsWUFwQk47RUFxQkxDLElBQUFBLFNBQVMsRUFBRSxZQXJCTjtFQXNCTEMsSUFBQUEsSUFBSSxFQUFHLFlBdEJGO0VBdUJMQyxJQUFBQSxNQUFNLEVBQUcsY0F2Qko7RUF3QkxDLElBQUFBLFNBQVMsRUFBRSxZQXhCTjtFQXlCTHhZLElBQUFBLEtBQUssRUFBRSxPQXpCRjtFQTBCTHlZLElBQUFBLGNBQWMsRUFBRSxXQTFCWDtFQTJCTEMsSUFBQUEsVUFBVSxFQUFFLE9BM0JQO0VBNEJMQyxJQUFBQSxTQUFTLEVBQUUsV0E1Qk47RUE2Qkx2bkIsSUFBQUEsT0FBTyxFQUFFLFNBN0JKO0VBOEJMbVMsSUFBQUEsS0FBSyxFQUFFLE9BOUJGO0VBK0JMMU8sSUFBQUEsS0FBSyxFQUFFLE9BL0JGO0VBZ0NMa1osSUFBQUEsT0FBTyxFQUFFLFNBaENKO0VBaUNMNkssSUFBQUEsVUFBVSxFQUFFLGFBakNQO0VBa0NMQyxJQUFBQSxJQUFJLEVBQUUsV0FsQ0Q7RUFtQ0xDLElBQUFBLFdBQVcsRUFBRSxhQW5DUjtFQW9DTEMsSUFBQUEsV0FBVyxFQUFFLGdCQXBDUjtFQXFDTEMsSUFBQUEsV0FBVyxFQUFHLGNBckNUO0VBc0NMQyxJQUFBQSxXQUFXLEVBQUcsY0F0Q1Q7RUF1Q0xDLElBQUFBLFVBQVUsRUFBRyxhQXZDUjtFQXdDTEMsSUFBQUEsT0FBTyxFQUFHLFNBeENMO0VBeUNMQyxJQUFBQSxjQUFjLEVBQUcsY0F6Q1o7RUEwQ0xDLElBQUFBLFVBQVUsRUFBRyxZQTFDUjtFQTJDTEMsSUFBQUEsVUFBVSxFQUFHLGFBM0NSO0VBNENMQyxJQUFBQSxVQUFVLEVBQUcsYUE1Q1I7RUE2Q0xDLElBQUFBLEtBQUssRUFBRyxRQTdDSDtFQThDTEMsSUFBQUEsVUFBVSxFQUFHLFlBOUNSO0VBK0NMQyxJQUFBQSxVQUFVLEVBQUcsWUEvQ1I7RUFnRExDLElBQUFBLFVBQVUsRUFBRyxZQWhEUjtFQWlETEMsSUFBQUEsU0FBUyxFQUFHLFdBakRQO0VBa0RMQyxJQUFBQSxRQUFRLEVBQUcsVUFsRE47RUFtRExDLElBQUFBLE9BQU8sRUFBRyxTQW5ETDtFQW9ETEMsSUFBQUEsTUFBTSxFQUFHLFFBcERKO0VBcURMQyxJQUFBQSxNQUFNLEVBQUcsUUFyREo7RUFzRExDLElBQUFBLE9BQU8sRUFBRztFQXRETDtFQXpERSxDQUFmOztFQ0VlLFNBQVNDLGdCQUFULEdBQTRCO0VBQ3ZDLFNBQU87RUFDSEMsSUFBQUEsSUFBSSxFQUFHQyxRQURKO0VBRUhDLElBQUFBLE1BQU0sRUFBRSxDQUNKO0VBQ0kxcEIsTUFBQUEsSUFBSSxFQUFFLGdCQURWO0VBRUlDLE1BQUFBLFFBQVEsRUFBRSxDQUNOO0VBQUVELFFBQUFBLElBQUksRUFBRTtFQUFSLE9BRE0sRUFFTjtFQUFFQSxRQUFBQSxJQUFJLEVBQUU7RUFBUixPQUZNLEVBR047RUFBRUEsUUFBQUEsSUFBSSxFQUFFO0VBQVIsT0FITSxFQUlOO0VBQUVBLFFBQUFBLElBQUksRUFBRTtFQUFSLE9BSk0sRUFLTjtFQUFFQSxRQUFBQSxJQUFJLEVBQUU7RUFBUixPQUxNLEVBTU47RUFBRUEsUUFBQUEsSUFBSSxFQUFFO0VBQVIsT0FOTTtFQUZkLEtBREksRUFZSjtFQUNJQSxNQUFBQSxJQUFJLEVBQUUsWUFEVjtFQUVJQyxNQUFBQSxRQUFRLEVBQUUsQ0FDTjtFQUFFRCxRQUFBQSxJQUFJLEVBQUU7RUFBUixPQURNLEVBRU47RUFBRUEsUUFBQUEsSUFBSSxFQUFFO0VBQVIsT0FGTTtFQUZkLEtBWkksQ0FGTDtFQXNCSDJwQixJQUFBQSxNQUFNLEVBQUU7RUFDSjNwQixNQUFBQSxJQUFJLEVBQUUsT0FERjtFQUVKZ0IsTUFBQUEsSUFBSSxFQUFFLE9BRkY7RUFHSjRvQixNQUFBQSxRQUFRLEVBQUUsVUFITjtFQUlKQyxNQUFBQSxLQUFLLEVBQUUsQ0FDSDtFQUNJN29CLFFBQUFBLElBQUksRUFBRSxRQURWO0VBRUlnVyxRQUFBQSxVQUFVLEVBQUU7RUFDUjNuQixVQUFBQSxNQUFNLEVBQUU7RUFDSjJSLFlBQUFBLElBQUksRUFBRSxRQURGO0VBRUpoQixZQUFBQSxJQUFJLEVBQUUsUUFGRjtFQUdKMVAsWUFBQUEsS0FBSyxFQUFFLENBQUMsSUFBRCxFQUFPLE9BQVA7RUFISCxXQURBO0VBTVI4dkIsVUFBQUEsTUFBTSxFQUFFO0VBQ0pwZixZQUFBQSxJQUFJLEVBQUUsUUFERjtFQUVKaEIsWUFBQUEsSUFBSSxFQUFFLFFBRkY7RUFHSmdYLFlBQUFBLFVBQVUsRUFBRTtFQUNSdUwsY0FBQUEsU0FBUyxFQUFFO0VBQ1B2aEIsZ0JBQUFBLElBQUksRUFBRSxRQURDO0VBRVBoQixnQkFBQUEsSUFBSSxFQUFFLFdBRkM7RUFHUDFQLGdCQUFBQSxLQUFLLEVBQUU7RUFIQSxlQURIO0VBTVJzeUIsY0FBQUEsSUFBSSxFQUFFO0VBQ0Y1aEIsZ0JBQUFBLElBQUksRUFBRSxRQURKO0VBRUZoQixnQkFBQUEsSUFBSSxFQUFFLE1BRko7RUFHRjFQLGdCQUFBQSxLQUFLLEVBQUU7RUFITCxlQU5FO0VBV1JvcEIsY0FBQUEsS0FBSyxFQUFFO0VBQ0gxWSxnQkFBQUEsSUFBSSxFQUFFLE9BREg7RUFFSGhCLGdCQUFBQSxJQUFJLEVBQUUsT0FGSDtFQUdINkgsZ0JBQUFBLE9BQU8sRUFBRSxDQUFDLENBQUQsRUFBSSxFQUFKLEVBQVEsR0FBUixDQUhOO0VBSUh2WCxnQkFBQUEsS0FBSyxFQUFFO0VBSkosZUFYQztFQWlCUndDLGNBQUFBLFdBQVcsRUFBRTtFQUNUa08sZ0JBQUFBLElBQUksRUFBRSxPQURHO0VBRVRoQixnQkFBQUEsSUFBSSxFQUFFLGFBRkc7RUFHVDFQLGdCQUFBQSxLQUFLLEVBQUUsQ0FBQyxDQUFELEVBQUksQ0FBSixFQUFPLENBQVAsQ0FIRTtFQUlUdTVCLGdCQUFBQSxLQUFLLEVBQUUsQ0FDSDtFQUNJN29CLGtCQUFBQSxJQUFJLEVBQUUsT0FEVjtFQUVJaEIsa0JBQUFBLElBQUksRUFBRSxZQUZWO0VBR0k2SCxrQkFBQUEsT0FBTyxFQUFFLENBQUMsR0FBRCxFQUFNLEVBQU4sRUFBVSxHQUFWO0VBSGIsaUJBREcsRUFNSDtFQUNJN0csa0JBQUFBLElBQUksRUFBRSxPQURWO0VBRUloQixrQkFBQUEsSUFBSSxFQUFFLFlBRlY7RUFHSTZILGtCQUFBQSxPQUFPLEVBQUUsQ0FBQyxHQUFELEVBQU0sRUFBTixFQUFVLEdBQVY7RUFIYixpQkFORyxFQVdIO0VBQ0k3RyxrQkFBQUEsSUFBSSxFQUFFLE9BRFY7RUFFSWhCLGtCQUFBQSxJQUFJLEVBQUUsWUFGVjtFQUdJNkgsa0JBQUFBLE9BQU8sRUFBRSxDQUFDLEdBQUQsRUFBTSxFQUFOLEVBQVUsR0FBVjtFQUhiLGlCQVhHO0VBSkUsZUFqQkw7RUF1Q1IxSCxjQUFBQSxRQUFRLEVBQUU7RUFDTmEsZ0JBQUFBLElBQUksRUFBRSxPQURBO0VBRU5oQixnQkFBQUEsSUFBSSxFQUFFLFVBRkE7RUFHTjFQLGdCQUFBQSxLQUFLLEVBQUUsQ0FBQyxDQUFELEVBQUksQ0FBSixFQUFPLENBQVAsQ0FIRDtFQUlOdTVCLGdCQUFBQSxLQUFLLEVBQUUsQ0FDSDtFQUNJN29CLGtCQUFBQSxJQUFJLEVBQUUsT0FEVjtFQUVJaEIsa0JBQUFBLElBQUksRUFBRSxZQUZWO0VBR0k2SCxrQkFBQUEsT0FBTyxFQUFFLENBQUMsR0FBRCxFQUFNLEVBQU4sRUFBVSxHQUFWO0VBSGIsaUJBREcsRUFNSDtFQUNJN0csa0JBQUFBLElBQUksRUFBRSxPQURWO0VBRUloQixrQkFBQUEsSUFBSSxFQUFFLFlBRlY7RUFHSTZILGtCQUFBQSxPQUFPLEVBQUUsQ0FBQyxHQUFELEVBQU0sRUFBTixFQUFVLEdBQVY7RUFIYixpQkFORyxFQVdIO0VBQ0k3RyxrQkFBQUEsSUFBSSxFQUFFLE9BRFY7RUFFSWhCLGtCQUFBQSxJQUFJLEVBQUUsWUFGVjtFQUdJNkgsa0JBQUFBLE9BQU8sRUFBRSxDQUFDLEdBQUQsRUFBTSxFQUFOLEVBQVUsR0FBVjtFQUhiLGlCQVhHO0VBSkQsZUF2Q0Y7RUE2RFI3VSxjQUFBQSxLQUFLLEVBQUU7RUFDSGdPLGdCQUFBQSxJQUFJLEVBQUUsT0FESDtFQUVIaEIsZ0JBQUFBLElBQUksRUFBRSxPQUZIO0VBR0gxUCxnQkFBQUEsS0FBSyxFQUFFLENBQUMsQ0FBRCxFQUFJLENBQUosRUFBTyxDQUFQLENBSEo7RUFJSHU1QixnQkFBQUEsS0FBSyxFQUFFLENBQ0g7RUFDSTdvQixrQkFBQUEsSUFBSSxFQUFFLE9BRFY7RUFFSWhCLGtCQUFBQSxJQUFJLEVBQUUsWUFGVjtFQUdJNkgsa0JBQUFBLE9BQU8sRUFBRSxDQUFDLEdBQUQsRUFBTSxFQUFOLEVBQVUsR0FBVjtFQUhiLGlCQURHLEVBTUg7RUFDSTdHLGtCQUFBQSxJQUFJLEVBQUUsT0FEVjtFQUVJaEIsa0JBQUFBLElBQUksRUFBRSxZQUZWO0VBR0k2SCxrQkFBQUEsT0FBTyxFQUFFLENBQUMsR0FBRCxFQUFNLEVBQU4sRUFBVSxHQUFWO0VBSGIsaUJBTkcsRUFXSDtFQUNJN0csa0JBQUFBLElBQUksRUFBRSxPQURWO0VBRUloQixrQkFBQUEsSUFBSSxFQUFFLFlBRlY7RUFHSTZILGtCQUFBQSxPQUFPLEVBQUUsQ0FBQyxHQUFELEVBQU0sRUFBTixFQUFVLEdBQVY7RUFIYixpQkFYRztFQUpKLGVBN0RDO0VBbUZSbUosY0FBQUEsTUFBTSxFQUFFO0VBQ0poUSxnQkFBQUEsSUFBSSxFQUFFLE9BREY7RUFFSmhCLGdCQUFBQSxJQUFJLEVBQUUsUUFGRjtFQUdKNkgsZ0JBQUFBLE9BQU8sRUFBRSxFQUhMO0VBSUp2WCxnQkFBQUEsS0FBSyxFQUFFO0VBSkgsZUFuRkE7RUF5RlJ1Z0IsY0FBQUEsUUFBUSxFQUFFO0VBQ043UCxnQkFBQUEsSUFBSSxFQUFFLFFBREE7RUFFTmhCLGdCQUFBQSxJQUFJLEVBQUUsVUFGQTtFQUdOMVAsZ0JBQUFBLEtBQUssRUFBRSxPQUhEO0VBSU53NUIsZ0JBQUFBLEtBQUssRUFBRTtFQUpEO0VBekZGO0VBSFI7RUFOQTtFQUZoQixPQURHO0VBSkg7RUF0QkwsR0FBUDtFQTRJSDs7RUM3SUQsSUFBTUMsWUFBWSxHQUFHLENBQUMsQ0FBRCxFQUFJLENBQUosRUFBTyxDQUFQLEVBQVUsQ0FBQyxDQUFYLEVBQWMsQ0FBZCxFQUFpQixDQUFqQixFQUFvQixDQUFDLENBQXJCLEVBQXdCLENBQUMsQ0FBekIsRUFBNEIsQ0FBNUIsRUFBK0IsQ0FBL0IsRUFBa0MsQ0FBQyxDQUFuQyxFQUFzQyxDQUF0QyxFQUNqQixDQURpQixFQUNkLENBRGMsRUFDWCxDQURXLEVBQ1IsQ0FEUSxFQUNMLENBQUMsQ0FESSxFQUNELENBREMsRUFDRSxDQURGLEVBQ0ssQ0FBQyxDQUROLEVBQ1MsQ0FBQyxDQURWLEVBQ2EsQ0FEYixFQUNnQixDQURoQixFQUNtQixDQUFDLENBRHBCLEVBRWpCLENBRmlCLEVBRWQsQ0FGYyxFQUVYLENBRlcsRUFFUixDQUZRLEVBRUwsQ0FGSyxFQUVGLENBQUMsQ0FGQyxFQUVFLENBQUMsQ0FGSCxFQUVNLENBRk4sRUFFUyxDQUFDLENBRlYsRUFFYSxDQUFDLENBRmQsRUFFaUIsQ0FGakIsRUFFb0IsQ0FGcEIsRUFHakIsQ0FBQyxDQUhnQixFQUdiLENBSGEsRUFHVixDQUhVLEVBR1AsQ0FBQyxDQUhNLEVBR0gsQ0FIRyxFQUdBLENBQUMsQ0FIRCxFQUdJLENBQUMsQ0FITCxFQUdRLENBQUMsQ0FIVCxFQUdZLENBQUMsQ0FIYixFQUdnQixDQUFDLENBSGpCLEVBR29CLENBQUMsQ0FIckIsRUFHd0IsQ0FIeEIsRUFJakIsQ0FBQyxDQUpnQixFQUliLENBQUMsQ0FKWSxFQUlULENBQUMsQ0FKUSxFQUlMLENBSkssRUFJRixDQUFDLENBSkMsRUFJRSxDQUFDLENBSkgsRUFJTSxDQUpOLEVBSVMsQ0FBQyxDQUpWLEVBSWEsQ0FKYixFQUlnQixDQUFDLENBSmpCLEVBSW9CLENBQUMsQ0FKckIsRUFJd0IsQ0FKeEIsRUFLakIsQ0FMaUIsRUFLZCxDQUFDLENBTGEsRUFLVixDQUFDLENBTFMsRUFLTixDQUFDLENBTEssRUFLRixDQUFDLENBTEMsRUFLRSxDQUFDLENBTEgsRUFLTSxDQUFDLENBTFAsRUFLVSxDQUxWLEVBS2EsQ0FBQyxDQUxkLEVBS2lCLENBTGpCLEVBS29CLENBTHBCLEVBS3VCLENBQUMsQ0FMeEIsQ0FBckI7RUFNQSxJQUFNQyxVQUFVLEdBQUksQ0FBQyxDQUFELEVBQUksQ0FBSixFQUFPLENBQVAsRUFBVSxDQUFWLEVBQWEsQ0FBYixFQUFnQixDQUFoQixFQUFtQixDQUFuQixFQUFzQixDQUF0QixFQUF5QixDQUF6QixFQUE0QixDQUE1QixFQUErQixDQUEvQixFQUFrQyxDQUFsQyxFQUNoQixDQURnQixFQUNiLENBRGEsRUFDVixDQURVLEVBQ1AsQ0FETyxFQUNKLENBREksRUFDRCxDQURDLEVBQ0UsQ0FERixFQUNLLENBREwsRUFDUSxDQURSLEVBQ1csQ0FEWCxFQUNjLENBRGQsRUFDaUIsQ0FEakIsRUFFaEIsQ0FGZ0IsRUFFYixDQUZhLEVBRVYsQ0FGVSxFQUVQLENBRk8sRUFFSixDQUZJLEVBRUQsQ0FGQyxFQUVFLENBRkYsRUFFSyxDQUZMLEVBRVEsQ0FGUixFQUVXLENBRlgsRUFFYyxDQUZkLEVBRWlCLENBRmpCLEVBR2hCLENBQUMsQ0FIZSxFQUdaLENBSFksRUFHVCxDQUhTLEVBR04sQ0FBQyxDQUhLLEVBR0YsQ0FIRSxFQUdDLENBSEQsRUFHSSxDQUFDLENBSEwsRUFHUSxDQUhSLEVBR1csQ0FIWCxFQUdjLENBQUMsQ0FIZixFQUdrQixDQUhsQixFQUdxQixDQUhyQixFQUloQixDQUpnQixFQUliLENBQUMsQ0FKWSxFQUlULENBSlMsRUFJTixDQUpNLEVBSUgsQ0FBQyxDQUpFLEVBSUMsQ0FKRCxFQUlJLENBSkosRUFJTyxDQUFDLENBSlIsRUFJVyxDQUpYLEVBSWMsQ0FKZCxFQUlpQixDQUFDLENBSmxCLEVBSXFCLENBSnJCLEVBS2hCLENBTGdCLEVBS2IsQ0FMYSxFQUtWLENBQUMsQ0FMUyxFQUtOLENBTE0sRUFLSCxDQUxHLEVBS0EsQ0FBQyxDQUxELEVBS0ksQ0FMSixFQUtPLENBTFAsRUFLVSxDQUFDLENBTFgsRUFLYyxDQUxkLEVBS2lCLENBTGpCLEVBS29CLENBQUMsQ0FMckIsQ0FBcEI7RUFNQSxJQUFNQyxXQUFXLEdBQUcsQ0FBQyxDQUFELEVBQUksQ0FBSixFQUFPLENBQVAsRUFBVSxDQUFWLEVBQWEsQ0FBYixFQUFnQixDQUFoQixFQUNoQixDQURnQixFQUNiLENBRGEsRUFDVixDQURVLEVBQ1AsQ0FETyxFQUNKLENBREksRUFDRCxDQURDLEVBRWhCLENBRmdCLEVBRWIsQ0FGYSxFQUVWLEVBRlUsRUFFTixDQUZNLEVBRUgsRUFGRyxFQUVDLEVBRkQsRUFHaEIsRUFIZ0IsRUFHWixFQUhZLEVBR1IsRUFIUSxFQUdKLEVBSEksRUFHQSxFQUhBLEVBR0ksRUFISixFQUloQixFQUpnQixFQUlaLEVBSlksRUFJUixFQUpRLEVBSUosRUFKSSxFQUlBLEVBSkEsRUFJSSxFQUpKLEVBS2hCLEVBTGdCLEVBS1osRUFMWSxFQUtSLEVBTFEsRUFLSixFQUxJLEVBS0EsRUFMQSxFQUtJLEVBTEosQ0FBcEI7O0VBUUEsU0FBU0MsY0FBVCxDQUF3QkMsTUFBeEIsRUFBZ0NDLGFBQWhDLEVBQStDQyxjQUEvQyxFQUErREMsUUFBL0QsRUFBeUVDLFNBQXpFLEVBQW9GQyxVQUFwRixFQUFnR0MsV0FBaEcsRUFBNkc7RUFDekdOLEVBQUFBLE1BQU0sR0FBR0EsTUFBTSxJQUFJLENBQW5CO0VBQ0FDLEVBQUFBLGFBQWEsR0FBR3gyQixJQUFJLENBQUMwVCxHQUFMLENBQVMsQ0FBVCxFQUFZMVQsSUFBSSxDQUFDODJCLEtBQUwsQ0FBV04sYUFBWCxLQUE2QixDQUF6QyxDQUFoQjtFQUNBQyxFQUFBQSxjQUFjLEdBQUd6MkIsSUFBSSxDQUFDMFQsR0FBTCxDQUFTLENBQVQsRUFBWTFULElBQUksQ0FBQzgyQixLQUFMLENBQVdMLGNBQVgsS0FBOEIsQ0FBMUMsQ0FBakI7RUFDQUMsRUFBQUEsUUFBUSxHQUFHQSxRQUFRLEtBQUs3TixTQUFiLEdBQXlCNk4sUUFBekIsR0FBb0MsQ0FBL0M7RUFDQUMsRUFBQUEsU0FBUyxHQUFHQSxTQUFTLEtBQUs5TixTQUFkLEdBQTBCOE4sU0FBMUIsR0FBc0MzMkIsSUFBSSxDQUFDeUYsRUFBTCxHQUFVLENBQTVEO0VBQ0FteEIsRUFBQUEsVUFBVSxHQUFHQSxVQUFVLEtBQUsvTixTQUFmLEdBQTJCK04sVUFBM0IsR0FBd0MsQ0FBckQ7RUFDQUMsRUFBQUEsV0FBVyxHQUFHQSxXQUFXLEtBQUtoTyxTQUFoQixHQUE0QmdPLFdBQTVCLEdBQTBDNzJCLElBQUksQ0FBQ3lGLEVBQTdEO0VBQ0EsTUFBTXN4QixRQUFRLEdBQUdILFVBQVUsR0FBR0MsV0FBOUI7RUFDQSxNQUFJRyxFQUFKLEVBQVFDLEVBQVI7RUFDQSxNQUFJaG5CLEtBQUssR0FBRyxDQUFaO0VBQ0EsTUFBTWluQixJQUFJLEdBQUcsRUFBYjtFQUNBLE1BQU1DLE1BQU0sR0FBRyxFQUFmO0VBQ0EsTUFBTUMsTUFBTSxHQUFHLEVBQWY7RUFFQSxNQUFNcmhCLE9BQU8sR0FBRyxFQUFoQjtFQUNBLE1BQU1zaEIsUUFBUSxHQUFHLEVBQWpCO0VBQ0EsTUFBTUMsT0FBTyxHQUFHLEVBQWhCO0VBQ0EsTUFBTUMsR0FBRyxHQUFHLEVBQVo7O0VBRUEsT0FBS04sRUFBRSxHQUFHLENBQVYsRUFBYUEsRUFBRSxJQUFJUixjQUFuQixFQUFtQ1EsRUFBRSxFQUFyQyxFQUF5QztFQUNyQyxRQUFNTyxXQUFXLEdBQUcsRUFBcEI7RUFDQSxRQUFNMTRCLENBQUMsR0FBR200QixFQUFFLEdBQUdSLGNBQWY7RUFFQSxRQUFNZ0IsT0FBTyxHQUFJUixFQUFFLEtBQUssQ0FBUixHQUFhLE1BQU1ULGFBQW5CLEdBQXFDUyxFQUFFLEtBQUtSLGNBQVIsR0FBMEIsQ0FBQyxHQUFELEdBQU9ELGFBQWpDLEdBQWlELENBQXJHOztFQUNBLFNBQUtRLEVBQUUsR0FBRyxDQUFWLEVBQWFBLEVBQUUsSUFBSVIsYUFBbkIsRUFBa0NRLEVBQUUsRUFBcEMsRUFBd0M7RUFDcEMsVUFBTXgwQixDQUFDLEdBQUd3MEIsRUFBRSxHQUFHUixhQUFmO0VBRUFXLE1BQUFBLE1BQU0sQ0FBQyxDQUFELENBQU4sR0FBWSxDQUFDWixNQUFELEdBQVV2MkIsSUFBSSxDQUFDcUksR0FBTCxDQUFTcXVCLFFBQVEsR0FBR2wwQixDQUFDLEdBQUdtMEIsU0FBeEIsQ0FBVixHQUErQzMyQixJQUFJLENBQUNvSSxHQUFMLENBQVN3dUIsVUFBVSxHQUFHOTNCLENBQUMsR0FBRyszQixXQUExQixDQUEzRDtFQUNBTSxNQUFBQSxNQUFNLENBQUMsQ0FBRCxDQUFOLEdBQVlaLE1BQU0sR0FBR3YyQixJQUFJLENBQUNxSSxHQUFMLENBQVN1dUIsVUFBVSxHQUFHOTNCLENBQUMsR0FBRyszQixXQUExQixDQUFyQjtFQUNBTSxNQUFBQSxNQUFNLENBQUMsQ0FBRCxDQUFOLEdBQVlaLE1BQU0sR0FBR3YyQixJQUFJLENBQUNvSSxHQUFMLENBQVNzdUIsUUFBUSxHQUFHbDBCLENBQUMsR0FBR20wQixTQUF4QixDQUFULEdBQThDMzJCLElBQUksQ0FBQ29JLEdBQUwsQ0FBU3d1QixVQUFVLEdBQUc5M0IsQ0FBQyxHQUFHKzNCLFdBQTFCLENBQTFEO0VBQ0FRLE1BQUFBLFFBQVEsQ0FBQ3Y1QixJQUFULENBQWNxNUIsTUFBTSxDQUFDLENBQUQsQ0FBcEIsRUFBeUJBLE1BQU0sQ0FBQyxDQUFELENBQS9CLEVBQW9DQSxNQUFNLENBQUMsQ0FBRCxDQUExQztFQUVBN3RCLE1BQUFBLE9BQUksQ0FBQ29YLEdBQUwsQ0FBUzBXLE1BQVQsRUFBaUJELE1BQU0sQ0FBQyxDQUFELENBQXZCLEVBQTRCQSxNQUFNLENBQUMsQ0FBRCxDQUFsQyxFQUF1Q0EsTUFBTSxDQUFDLENBQUQsQ0FBN0M7RUFDQTd0QixNQUFBQSxPQUFJLENBQUN2QyxTQUFMLENBQWVxd0IsTUFBZixFQUF1QkEsTUFBdkI7RUFDQUUsTUFBQUEsT0FBTyxDQUFDeDVCLElBQVIsQ0FBYXM1QixNQUFNLENBQUMsQ0FBRCxDQUFuQixFQUF3QkEsTUFBTSxDQUFDLENBQUQsQ0FBOUIsRUFBbUNBLE1BQU0sQ0FBQyxDQUFELENBQXpDO0VBRUFHLE1BQUFBLEdBQUcsQ0FBQ3o1QixJQUFKLENBQVMwRSxDQUFDLEdBQUdpMUIsT0FBYixFQUFzQixJQUFJMzRCLENBQTFCO0VBQ0EwNEIsTUFBQUEsV0FBVyxDQUFDMTVCLElBQVosQ0FBaUJtUyxLQUFLLEVBQXRCO0VBQ0g7O0VBQ0RpbkIsSUFBQUEsSUFBSSxDQUFDcDVCLElBQUwsQ0FBVTA1QixXQUFWO0VBQ0g7O0VBRUQsT0FBS1AsRUFBRSxHQUFHLENBQVYsRUFBYUEsRUFBRSxHQUFHUixjQUFsQixFQUFrQ1EsRUFBRSxFQUFwQyxFQUF3QztFQUNwQyxTQUFLRCxFQUFFLEdBQUcsQ0FBVixFQUFhQSxFQUFFLEdBQUdSLGFBQWxCLEVBQWlDUSxFQUFFLEVBQW5DLEVBQXVDO0VBQ25DLFVBQU0xNUIsQ0FBQyxHQUFHNDVCLElBQUksQ0FBQ0QsRUFBRCxDQUFKLENBQVNELEVBQUUsR0FBRyxDQUFkLENBQVY7RUFDQSxVQUFNejVCLENBQUMsR0FBRzI1QixJQUFJLENBQUNELEVBQUQsQ0FBSixDQUFTRCxFQUFULENBQVY7RUFDQSxVQUFNejBCLENBQUMsR0FBRzIwQixJQUFJLENBQUNELEVBQUUsR0FBRyxDQUFOLENBQUosQ0FBYUQsRUFBYixDQUFWO0VBQ0EsVUFBTXB0QixDQUFDLEdBQUdzdEIsSUFBSSxDQUFDRCxFQUFFLEdBQUcsQ0FBTixDQUFKLENBQWFELEVBQUUsR0FBRyxDQUFsQixDQUFWO0VBQ0EsVUFBSUMsRUFBRSxLQUFLLENBQVAsSUFBWUwsVUFBVSxHQUFHLENBQTdCLEVBQWdDN2dCLE9BQU8sQ0FBQ2pZLElBQVIsQ0FBYVIsQ0FBYixFQUFnQkMsQ0FBaEIsRUFBbUJxTSxDQUFuQjtFQUNoQyxVQUFJcXRCLEVBQUUsS0FBS1IsY0FBYyxHQUFHLENBQXhCLElBQTZCTSxRQUFRLEdBQUcvMkIsSUFBSSxDQUFDeUYsRUFBakQsRUFBcURzUSxPQUFPLENBQUNqWSxJQUFSLENBQWFQLENBQWIsRUFBZ0JnRixDQUFoQixFQUFtQnFILENBQW5CO0VBQ3hEO0VBQ0o7O0VBRUQsU0FBTztFQUNIeXRCLElBQUFBLFFBQVEsRUFBUkEsUUFERztFQUVIdHFCLElBQUFBLFFBQVEsRUFBR3dxQixHQUZSO0VBR0hELElBQUFBLE9BQU8sRUFBUEEsT0FIRztFQUlIdmhCLElBQUFBLE9BQU8sRUFBUEE7RUFKRyxHQUFQO0VBTUg7O0VBRUQsSUFBTTJoQixNQUFNLEdBQUdwQixjQUFjLENBQUMsQ0FBRCxFQUFJLEdBQUosRUFBUyxHQUFULENBQTdCO0FBQ0EsRUFBZSxTQUFTcUIsUUFBVCxDQUFrQjFFLEtBQWxCLEVBQXlCO0VBQ3BDLE1BQUlBLEtBQUssS0FBSyxNQUFkLEVBQXNCO0VBQ2xCLFdBQU87RUFDSHp2QixNQUFBQSxVQUFVLEVBQUc7RUFDVG8wQixRQUFBQSxRQUFRLEVBQUc7RUFDUHpwQixVQUFBQSxLQUFLLEVBQUcsSUFBSVMsU0FBSixDQUFjdW5CLFlBQWQ7RUFERCxTQURGO0VBSVQwQixRQUFBQSxNQUFNLEVBQUU7RUFDSjFwQixVQUFBQSxLQUFLLEVBQUcsSUFBSVMsU0FBSixDQUFjd25CLFVBQWQ7RUFESjtFQUpDLE9BRFY7RUFTSHJnQixNQUFBQSxPQUFPLEVBQUcsSUFBSWhILFdBQUosQ0FBZ0JzbkIsV0FBaEIsQ0FUUDtFQVVIbGdCLE1BQUFBLElBQUksRUFBRztFQVZKLEtBQVA7RUFZSCxHQWJELE1BYU8sSUFBSThjLEtBQUssS0FBSyxRQUFkLEVBQXdCO0VBQzNCLFdBQU87RUFDSHp2QixNQUFBQSxVQUFVLEVBQUc7RUFDVG8wQixRQUFBQSxRQUFRLEVBQUc7RUFDUHpwQixVQUFBQSxLQUFLLEVBQUd1cEIsTUFBTSxDQUFDTDtFQURSLFNBREY7RUFJVFEsUUFBQUEsTUFBTSxFQUFHO0VBQ0wxcEIsVUFBQUEsS0FBSyxFQUFHdXBCLE1BQU0sQ0FBQ0o7RUFEVixTQUpBO0VBT1RRLFFBQUFBLFVBQVUsRUFBRztFQUNUM3BCLFVBQUFBLEtBQUssRUFBR3VwQixNQUFNLENBQUMzcUI7RUFETjtFQVBKLE9BRFY7RUFZSGdKLE1BQUFBLE9BQU8sRUFBRzJoQixNQUFNLENBQUMzaEIsT0FaZDtFQWFISSxNQUFBQSxJQUFJLEVBQUc7RUFiSixLQUFQO0VBZUg7O0VBQ0QsU0FBTyxJQUFQO0VBQ0g7O0VDckhjLFNBQVM0aEIsdUJBQVQsR0FBbUM7RUFDOUMsTUFBTUMsa0JBQWtCLEdBQUc7RUFDdkJDLElBQUFBLFNBQVMsRUFBRztFQUNSN3JCLE1BQUFBLElBQUksRUFBRSxPQURFO0VBRVIwcEIsTUFBQUEsTUFBTSxFQUFFLENBQ0o7RUFDSTFwQixRQUFBQSxJQUFJLEVBQUUsV0FEVjtFQUVJQyxRQUFBQSxRQUFRLEVBQUUsQ0FDTjtFQUFFRCxVQUFBQSxJQUFJLEVBQUU7RUFBUixTQURNLEVBRU47RUFBRUEsVUFBQUEsSUFBSSxFQUFFO0VBQVIsU0FGTSxFQUdOO0VBQUVBLFVBQUFBLElBQUksRUFBRTtFQUFSLFNBSE0sRUFJTjtFQUFFQSxVQUFBQSxJQUFJLEVBQUU7RUFBUixTQUpNO0VBRmQsT0FESSxFQVVKO0VBQ0lBLFFBQUFBLElBQUksRUFBRSxTQURWO0VBRUlDLFFBQUFBLFFBQVEsRUFBRSxDQUNOO0VBQUVELFVBQUFBLElBQUksRUFBRTtFQUFSLFNBRE0sRUFFTjtFQUFFQSxVQUFBQSxJQUFJLEVBQUU7RUFBUixTQUZNLEVBR047RUFBRUEsVUFBQUEsSUFBSSxFQUFFO0VBQVIsU0FITTtFQUZkLE9BVkksRUFrQko7RUFDSUEsUUFBQUEsSUFBSSxFQUFFLFNBRFY7RUFFSUMsUUFBQUEsUUFBUSxFQUFFLENBQUM7RUFBRUQsVUFBQUEsSUFBSSxFQUFFO0VBQVIsU0FBRDtFQUZkLE9BbEJJO0VBRkEsS0FEVztFQTJCdkIycEIsSUFBQUEsTUFBTSxFQUFFO0VBQ0ozcEIsTUFBQUEsSUFBSSxFQUFFLE9BREY7RUFFSjhyQixNQUFBQSxPQUFPLEVBQUUsQ0FDTDtFQUNJOXJCLFFBQUFBLElBQUksRUFBRSxTQURWO0VBRUkxUCxRQUFBQSxLQUFLLEVBQUU7RUFDSDAyQixVQUFBQSxhQUFhLEVBQUUsQ0FBQyxDQUFELEVBQUksQ0FBSixFQUFPLENBQVAsQ0FEWjtFQUVIQyxVQUFBQSxZQUFZLEVBQUUsQ0FBQyxDQUFELEVBQUksQ0FBSixFQUFPLENBQVAsRUFBVSxDQUFWLENBRlg7RUFHSEMsVUFBQUEsWUFBWSxFQUFFLENBQUMsR0FBRCxFQUFNLEdBQU4sRUFBVyxHQUFYLEVBQWdCLENBQWhCLENBSFg7RUFJSEMsVUFBQUEsYUFBYSxFQUFFLENBQUMsR0FBRCxFQUFNLEdBQU4sRUFBVyxHQUFYLEVBQWdCLENBQWhCLENBSlo7RUFLSEUsVUFBQUEsZ0JBQWdCLEVBQUUsR0FMZjtFQU1IRCxVQUFBQSxlQUFlLEVBQUUsR0FOZDtFQU9IRSxVQUFBQSxpQkFBaUIsRUFBRSxFQVBoQjtFQVFIQyxVQUFBQSxPQUFPLEVBQUU7RUFSTjtFQUZYLE9BREssRUFjTDtFQUNJdm5CLFFBQUFBLElBQUksRUFBRSxXQURWO0VBRUkxUCxRQUFBQSxLQUFLLEVBQUU7RUFDSDAyQixVQUFBQSxhQUFhLEVBQUUsQ0FBQyxDQUFELEVBQUksQ0FBSixFQUFPLENBQVAsQ0FEWjtFQUVIQyxVQUFBQSxZQUFZLEVBQUUsQ0FBQyxHQUFELEVBQU0sQ0FBTixFQUFTLENBQVQsRUFBWSxDQUFaLENBRlg7RUFHSEMsVUFBQUEsWUFBWSxFQUFFLENBQUMsR0FBRCxFQUFNLEdBQU4sRUFBVyxHQUFYLEVBQWdCLENBQWhCLENBSFg7RUFJSEMsVUFBQUEsYUFBYSxFQUFFLENBQUMsR0FBRCxFQUFNLEdBQU4sRUFBVyxHQUFYLEVBQWdCLENBQWhCLENBSlo7RUFLSEUsVUFBQUEsZ0JBQWdCLEVBQUUsR0FMZjtFQU1IRCxVQUFBQSxlQUFlLEVBQUUsR0FOZDtFQU9IRSxVQUFBQSxpQkFBaUIsRUFBRSxFQVBoQjtFQVFIQyxVQUFBQSxPQUFPLEVBQUU7RUFSTjtFQUZYLE9BZEssQ0FGTDtFQThCSnZRLE1BQUFBLFVBQVUsRUFBRTtFQUNSZ1EsUUFBQUEsYUFBYSxFQUFFO0VBQ1hobUIsVUFBQUEsSUFBSSxFQUFFLE9BREs7RUFFWGhCLFVBQUFBLElBQUksRUFBRSxlQUZLO0VBR1gxUCxVQUFBQSxLQUFLLEVBQUUsQ0FBQyxDQUFELEVBQUksQ0FBSixFQUFPLENBQVAsQ0FISTtFQUlYdTVCLFVBQUFBLEtBQUssRUFBRSxDQUNIO0VBQ0k3b0IsWUFBQUEsSUFBSSxFQUFFLE9BRFY7RUFFSWhCLFlBQUFBLElBQUksRUFBRSxZQUZWO0VBR0k2SCxZQUFBQSxPQUFPLEVBQUUsQ0FBQyxHQUFELEVBQU0sRUFBTixFQUFVLEdBQVY7RUFIYixXQURHLEVBTUg7RUFDSTdHLFlBQUFBLElBQUksRUFBRSxPQURWO0VBRUloQixZQUFBQSxJQUFJLEVBQUUsWUFGVjtFQUdJNkgsWUFBQUEsT0FBTyxFQUFFLENBQUMsR0FBRCxFQUFNLEVBQU4sRUFBVSxHQUFWO0VBSGIsV0FORyxFQVdIO0VBQ0k3RyxZQUFBQSxJQUFJLEVBQUUsT0FEVjtFQUVJaEIsWUFBQUEsSUFBSSxFQUFFLFlBRlY7RUFHSTZILFlBQUFBLE9BQU8sRUFBRSxDQUFDLEdBQUQsRUFBTSxFQUFOLEVBQVUsR0FBVjtFQUhiLFdBWEc7RUFKSSxTQURQO0VBdUJSb2YsUUFBQUEsWUFBWSxFQUFFO0VBQ1ZqbUIsVUFBQUEsSUFBSSxFQUFFLE9BREk7RUFFVmhCLFVBQUFBLElBQUksRUFBRSxjQUZJO0VBR1YxUCxVQUFBQSxLQUFLLEVBQUUsQ0FBQyxHQUFELEVBQU0sR0FBTixFQUFXLEdBQVgsRUFBZ0IsR0FBaEI7RUFIRyxTQXZCTjtFQTRCUjQyQixRQUFBQSxZQUFZLEVBQUU7RUFDVmxtQixVQUFBQSxJQUFJLEVBQUUsT0FESTtFQUVWaEIsVUFBQUEsSUFBSSxFQUFFLGNBRkk7RUFHVjFQLFVBQUFBLEtBQUssRUFBRSxDQUFDLEdBQUQsRUFBTSxHQUFOLEVBQVcsR0FBWCxFQUFnQixHQUFoQjtFQUhHLFNBNUJOO0VBaUNSNjJCLFFBQUFBLGFBQWEsRUFBRTtFQUNYbm1CLFVBQUFBLElBQUksRUFBRSxPQURLO0VBRVhoQixVQUFBQSxJQUFJLEVBQUUsZUFGSztFQUdYMVAsVUFBQUEsS0FBSyxFQUFFLENBQUMsR0FBRCxFQUFNLEdBQU4sRUFBVyxHQUFYLEVBQWdCLEdBQWhCO0VBSEksU0FqQ1A7RUFzQ1I4MkIsUUFBQUEsZUFBZSxFQUFFO0VBQ2JwbUIsVUFBQUEsSUFBSSxFQUFFLE9BRE87RUFFYmhCLFVBQUFBLElBQUksRUFBRSxpQkFGTztFQUdiNkgsVUFBQUEsT0FBTyxFQUFFLENBQUMsR0FBRCxFQUFNLENBQU4sRUFBUyxHQUFULENBSEk7RUFJYnZYLFVBQUFBLEtBQUssRUFBRTtFQUpNLFNBdENUO0VBNENSKzJCLFFBQUFBLGdCQUFnQixFQUFFO0VBQ2RybUIsVUFBQUEsSUFBSSxFQUFFLE9BRFE7RUFFZGhCLFVBQUFBLElBQUksRUFBRSxrQkFGUTtFQUdkNkgsVUFBQUEsT0FBTyxFQUFFLENBQUMsR0FBRCxFQUFNLENBQU4sRUFBUyxHQUFULENBSEs7RUFJZHZYLFVBQUFBLEtBQUssRUFBRTtFQUpPLFNBNUNWO0VBa0RSZzNCLFFBQUFBLGlCQUFpQixFQUFFO0VBQ2Z0bUIsVUFBQUEsSUFBSSxFQUFFLE9BRFM7RUFFZmhCLFVBQUFBLElBQUksRUFBRSxtQkFGUztFQUdmNkgsVUFBQUEsT0FBTyxFQUFFLENBQUMsR0FBRCxFQUFNLElBQU4sRUFBWSxHQUFaLENBSE07RUFJZnZYLFVBQUFBLEtBQUssRUFBRTtFQUpRLFNBbERYO0VBd0RSaTNCLFFBQUFBLE9BQU8sRUFBRTtFQUNMdm1CLFVBQUFBLElBQUksRUFBRSxPQUREO0VBRUxoQixVQUFBQSxJQUFJLEVBQUUsU0FGRDtFQUdMNkgsVUFBQUEsT0FBTyxFQUFFLENBQUMsQ0FBRCxFQUFJLENBQUosRUFBTyxJQUFQLENBSEo7RUFJTHZYLFVBQUFBLEtBQUssRUFBRTtFQUpGO0VBeEREO0VBOUJSO0VBM0JlLEdBQTNCO0VBMEhBLE1BQU15N0Isc0JBQXNCLEdBQUc7RUFDM0JGLElBQUFBLFNBQVMsRUFBRztFQUNSN3JCLE1BQUFBLElBQUksRUFBRSxXQURFO0VBRVIwcEIsTUFBQUEsTUFBTSxFQUFFLENBQ0o7RUFDSTFwQixRQUFBQSxJQUFJLEVBQUUsT0FEVjtFQUVJQyxRQUFBQSxRQUFRLEVBQUUsQ0FDTjtFQUFFRCxVQUFBQSxJQUFJLEVBQUU7RUFBUixTQURNLEVBRU47RUFBRUEsVUFBQUEsSUFBSSxFQUFFO0VBQVIsU0FGTTtFQUZkLE9BREksRUFRSjtFQUNJQSxRQUFBQSxJQUFJLEVBQUUsTUFEVjtFQUVJQyxRQUFBQSxRQUFRLEVBQUUsQ0FDTjtFQUFFRCxVQUFBQSxJQUFJLEVBQUU7RUFBUixTQURNLEVBRU47RUFBRUEsVUFBQUEsSUFBSSxFQUFFO0VBQVIsU0FGTSxFQUdOO0VBQUVBLFVBQUFBLElBQUksRUFBRTtFQUFSLFNBSE0sRUFJTjtFQUFFQSxVQUFBQSxJQUFJLEVBQUU7RUFBUixTQUpNLEVBS047RUFBRUEsVUFBQUEsSUFBSSxFQUFFO0VBQVIsU0FMTTtFQUZkLE9BUkksRUFrQko7RUFBSUEsUUFBQUEsSUFBSSxFQUFFLFNBQVY7RUFDSUMsUUFBQUEsUUFBUSxFQUFFLENBQ047RUFBRUQsVUFBQUEsSUFBSSxFQUFFO0VBQVIsU0FETSxFQUVOO0VBQUVBLFVBQUFBLElBQUksRUFBRTtFQUFSLFNBRk0sRUFHTjtFQUFFQSxVQUFBQSxJQUFJLEVBQUU7RUFBUixTQUhNLEVBSU47RUFBRUEsVUFBQUEsSUFBSSxFQUFFO0VBQVIsU0FKTSxFQUtOO0VBQUVBLFVBQUFBLElBQUksRUFBRTtFQUFSLFNBTE07RUFEZCxPQWxCSSxFQTJCSjtFQUNJQSxRQUFBQSxJQUFJLEVBQUUsU0FEVjtFQUVJQyxRQUFBQSxRQUFRLEVBQUUsQ0FBQztFQUFFRCxVQUFBQSxJQUFJLEVBQUU7RUFBUixTQUFEO0VBRmQsT0EzQkk7RUFGQSxLQURlO0VBb0MzQjJwQixJQUFBQSxNQUFNLEVBQUc7RUFDTDNwQixNQUFBQSxJQUFJLEVBQUUsV0FERDtFQUVMOHJCLE1BQUFBLE9BQU8sRUFBRSxDQUNMO0VBQ0k5ckIsUUFBQUEsSUFBSSxFQUFHLE9BRFg7RUFFSTFQLFFBQUFBLEtBQUssRUFBRTtFQUNILHdCQUFjLElBRFg7RUFFSCx1QkFBYSxJQUZWO0VBR0gsa0JBQVEsQ0FBQyxNQUFELEVBQVMsTUFBVCxFQUFpQixNQUFqQixFQUF5QixHQUF6QixDQUhMO0VBSUgsb0JBQVUsQ0FBQyxNQUFELEVBQVMsTUFBVCxFQUFpQixNQUFqQixFQUF5QixDQUF6QixDQUpQO0VBS0gseUJBQWUsSUFMWjtFQU1ILHlCQUFlLEtBTlo7RUFPSCx5QkFBZSxDQVBaO0VBUUgsd0JBQWMsR0FSWDtFQVNILHlCQUFlLElBVFo7RUFVSCxvQkFBVSxLQVZQO0VBV0gsb0JBQVUsS0FYUDtFQVlILDRCQUFrQixJQVpmO0VBYUgscUJBQVcsSUFiUjtFQWNILHdCQUFjLEdBZFg7RUFlSCx3QkFBYyxDQWZYO0VBZ0JILHdCQUFjLEtBaEJYO0VBaUJILDZCQUFtQjtFQWpCaEI7RUFGWCxPQURLLEVBdUJMO0VBQ0kwUCxRQUFBQSxJQUFJLEVBQUcsWUFEWDtFQUVJMVAsUUFBQUEsS0FBSyxFQUFFO0VBQ0gsd0JBQWMsS0FEWDtFQUVILHVCQUFhLElBRlY7RUFHSCxrQkFBUSxDQUFDLE1BQUQsRUFBUyxNQUFULEVBQWlCLE1BQWpCLEVBQXlCLEdBQXpCLENBSEw7RUFJSCxvQkFBVSxDQUFDLE1BQUQsRUFBUyxNQUFULEVBQWlCLE1BQWpCLEVBQXlCLEdBQXpCLENBSlA7RUFLSCx5QkFBZSxLQUxaO0VBTUgseUJBQWUsS0FOWjtFQU9ILHlCQUFlLENBUFo7RUFRSCx3QkFBYyxHQVJYO0VBU0gseUJBQWUsSUFUWjtFQVVILG9CQUFVLEtBVlA7RUFXSCxvQkFBVSxLQVhQO0VBWUgsNEJBQWtCLElBWmY7RUFhSCxxQkFBVyxJQWJSO0VBY0gsd0JBQWMsQ0FkWDtFQWVILHdCQUFjLENBZlg7RUFnQkgsd0JBQWMsSUFoQlg7RUFpQkgsNkJBQW1CO0VBakJoQjtFQUZYLE9BdkJLLEVBNkNMO0VBQ0kwUCxRQUFBQSxJQUFJLEVBQUcsWUFEWDtFQUVJMVAsUUFBQUEsS0FBSyxFQUFFO0VBQ0gsd0JBQWMsSUFEWDtFQUVILHVCQUFhLElBRlY7RUFHSCxrQkFBUSxDQUFDLEtBQUQsRUFBUSxNQUFSLEVBQWdCLE1BQWhCLEVBQXdCLEdBQXhCLENBSEw7RUFJSCxvQkFBVSxDQUFDLE1BQUQsRUFBUyxNQUFULEVBQWlCLE1BQWpCLEVBQXlCLEdBQXpCLENBSlA7RUFLSCx5QkFBZSxLQUxaO0VBTUgseUJBQWUsS0FOWjtFQU9ILHlCQUFlLENBUFo7RUFRSCx3QkFBYyxHQVJYO0VBU0gseUJBQWUsSUFUWjtFQVVILG9CQUFVLElBVlA7RUFXSCxvQkFBVSxLQVhQO0VBWUgsNEJBQWtCLElBWmY7RUFhSCxxQkFBVyxJQWJSO0VBY0gsd0JBQWMsR0FkWDtFQWVILHdCQUFjLENBZlg7RUFnQkgsd0JBQWMsS0FoQlg7RUFpQkgsNkJBQW1CO0VBakJoQjtFQUZYLE9BN0NLLEVBbUVMO0VBQ0kwUCxRQUFBQSxJQUFJLEVBQUcsWUFEWDtFQUVJMVAsUUFBQUEsS0FBSyxFQUFHO0VBQ0osd0JBQWMsSUFEVjtFQUVKLHVCQUFhLElBRlQ7RUFHSixrQkFBUSxDQUFDLE1BQUQsRUFBUyxNQUFULEVBQWlCLE1BQWpCLEVBQXlCLEdBQXpCLENBSEo7RUFJSixvQkFBVSxDQUFDLEtBQUQsRUFBUSxNQUFSLEVBQWdCLE1BQWhCLEVBQXdCLEdBQXhCLENBSk47RUFLSix5QkFBZSxLQUxYO0VBTUoseUJBQWUsS0FOWDtFQU9KLHlCQUFlLENBUFg7RUFRSix3QkFBYyxHQVJWO0VBU0oseUJBQWUsSUFUWDtFQVVKLG9CQUFVLEtBVk47RUFXSixvQkFBVSxLQVhOO0VBWUosNEJBQWtCLEtBWmQ7RUFhSixxQkFBVyxLQWJQO0VBY0osd0JBQWMsR0FkVjtFQWVKLHdCQUFjLENBZlY7RUFnQkosd0JBQWMsS0FoQlY7RUFpQkosNkJBQW1CO0VBakJmO0VBRlosT0FuRUssRUF5Rkw7RUFDSTBQLFFBQUFBLElBQUksRUFBRyxXQURYO0VBRUkxUCxRQUFBQSxLQUFLLEVBQUU7RUFDSCx3QkFBYyxJQURYO0VBRUgsdUJBQWEsSUFGVjtFQUdILGtCQUFRLENBQUMsTUFBRCxFQUFTLE1BQVQsRUFBaUIsTUFBakIsRUFBeUIsR0FBekIsQ0FITDtFQUlILG9CQUFVLENBQUMsS0FBRCxFQUFRLEtBQVIsRUFBZSxLQUFmLEVBQXNCLEdBQXRCLENBSlA7RUFLSCx5QkFBZSxLQUxaO0VBTUgseUJBQWUsS0FOWjtFQU9ILHlCQUFlLENBUFo7RUFRSCx3QkFBYyxHQVJYO0VBU0gseUJBQWUsSUFUWjtFQVVILG9CQUFVLEtBVlA7RUFXSCxvQkFBVSxLQVhQO0VBWUgsNEJBQWtCLElBWmY7RUFhSCxxQkFBVyxJQWJSO0VBY0gsd0JBQWMsR0FkWDtFQWVILHdCQUFjLENBZlg7RUFnQkgsd0JBQWMsS0FoQlg7RUFpQkgsNkJBQW1CO0VBakJoQjtFQUZYLE9BekZLLEVBK0dMO0VBQ0kwUCxRQUFBQSxJQUFJLEVBQUcsVUFEWDtFQUVJMVAsUUFBQUEsS0FBSyxFQUFFO0VBQ0gsd0JBQWMsS0FEWDtFQUVILHVCQUFhLElBRlY7RUFHSCxrQkFBUSxDQUFDLE1BQUQsRUFBUyxNQUFULEVBQWlCLE1BQWpCLEVBQXlCLEdBQXpCLENBSEw7RUFJSCxvQkFBVSxDQUFDLEtBQUQsRUFBUSxLQUFSLEVBQWUsTUFBZixFQUF1QixHQUF2QixDQUpQO0VBS0gseUJBQWUsSUFMWjtFQU1ILHlCQUFlLElBTlo7RUFPSCx5QkFBZSxDQVBaO0VBUUgsd0JBQWMsR0FSWDtFQVNILHlCQUFlLElBVFo7RUFVSCxvQkFBVSxLQVZQO0VBV0gsb0JBQVUsS0FYUDtFQVlILDRCQUFrQixLQVpmO0VBYUgscUJBQVcsSUFiUjtFQWNILHdCQUFjLEdBZFg7RUFlSCx3QkFBYyxDQWZYO0VBZ0JILHdCQUFjLEtBaEJYO0VBaUJILDZCQUFtQjtFQWpCaEI7RUFGWCxPQS9HSyxFQXFJTDtFQUNJMFAsUUFBQUEsSUFBSSxFQUFHLFNBRFg7RUFFSTFQLFFBQUFBLEtBQUssRUFBRTtFQUNILHdCQUFjLElBRFg7RUFFSCx1QkFBYSxJQUZWO0VBR0gsa0JBQVEsQ0FBQyxNQUFELEVBQVMsTUFBVCxFQUFpQixNQUFqQixFQUF5QixHQUF6QixDQUhMO0VBSUgsb0JBQVUsQ0FBQyxNQUFELEVBQVMsTUFBVCxFQUFpQixHQUFqQixFQUFzQixHQUF0QixDQUpQO0VBS0gseUJBQWUsS0FMWjtFQU1ILHlCQUFlLEtBTlo7RUFPSCx5QkFBZSxDQVBaO0VBUUgsd0JBQWMsR0FSWDtFQVNILHlCQUFlLElBVFo7RUFVSCxvQkFBVSxJQVZQO0VBV0gsb0JBQVUsSUFYUDtFQVlILDRCQUFrQixJQVpmO0VBYUgscUJBQVcsSUFiUjtFQWNILHdCQUFjLEdBZFg7RUFlSCx3QkFBYyxDQWZYO0VBZ0JILHdCQUFjLEtBaEJYO0VBaUJILDZCQUFtQjtFQWpCaEI7RUFGWCxPQXJJSyxFQTJKTDtFQUNJMFAsUUFBQUEsSUFBSSxFQUFHLFFBRFg7RUFFSTFQLFFBQUFBLEtBQUssRUFBRTtFQUNILHdCQUFjLElBRFg7RUFFSCx1QkFBYSxJQUZWO0VBR0gsa0JBQVEsQ0FBQyxNQUFELEVBQVMsS0FBVCxFQUFnQixNQUFoQixFQUF3QixHQUF4QixDQUhMO0VBSUgsb0JBQVUsQ0FBQyxNQUFELEVBQVMsR0FBVCxFQUFjLEdBQWQsRUFBbUIsR0FBbkIsQ0FKUDtFQUtILHlCQUFlLElBTFo7RUFNSCx5QkFBZSxLQU5aO0VBT0gseUJBQWUsQ0FQWjtFQVFILHdCQUFjLEdBUlg7RUFTSCx5QkFBZSxJQVRaO0VBVUgsb0JBQVUsS0FWUDtFQVdILG9CQUFVLEtBWFA7RUFZSCw0QkFBa0IsSUFaZjtFQWFILHFCQUFXLElBYlI7RUFjSCx3QkFBYyxHQWRYO0VBZUgsd0JBQWMsQ0FmWDtFQWdCSCx3QkFBYyxLQWhCWDtFQWlCSCw2QkFBbUI7RUFqQmhCO0VBRlgsT0EzSkssRUFpTEw7RUFDSTBQLFFBQUFBLElBQUksRUFBRyxRQURYO0VBRUkxUCxRQUFBQSxLQUFLLEVBQUU7RUFDSCx3QkFBYyxJQURYO0VBRUgsdUJBQWEsSUFGVjtFQUdILGtCQUFPLENBQUMsTUFBRCxFQUFTLE1BQVQsRUFBaUIsTUFBakIsRUFBeUIsR0FBekIsQ0FISjtFQUlILG9CQUFVLENBQUMsTUFBRCxFQUFTLE1BQVQsRUFBaUIsTUFBakIsRUFBeUIsR0FBekIsQ0FKUDtFQUtILHlCQUFlLElBTFo7RUFNSCx5QkFBZSxLQU5aO0VBT0gseUJBQWUsQ0FQWjtFQVFILHdCQUFjLEdBUlg7RUFTSCx5QkFBZSxLQVRaO0VBVUgsb0JBQVUsS0FWUDtFQVdILG9CQUFVLEtBWFA7RUFZSCw0QkFBa0IsSUFaZjtFQWFILHFCQUFXLElBYlI7RUFjSCx3QkFBYyxHQWRYO0VBZUgsd0JBQWMsQ0FmWDtFQWdCSCx3QkFBYyxLQWhCWDtFQWlCSCw2QkFBbUI7RUFqQmhCO0VBRlgsT0FqTEssRUF1TUw7RUFDSTBQLFFBQUFBLElBQUksRUFBRyxTQURYO0VBRUkxUCxRQUFBQSxLQUFLLEVBQUU7RUFDSCx3QkFBYyxLQURYO0VBRUgsdUJBQWEsS0FGVjtFQUdILGtCQUFRLENBQUMsS0FBRCxFQUFRLE1BQVIsRUFBZ0IsTUFBaEIsRUFBd0IsR0FBeEIsQ0FITDtFQUlILG9CQUFVLENBQUMsTUFBRCxFQUFTLE1BQVQsRUFBaUIsS0FBakIsRUFBd0IsR0FBeEIsQ0FKUDtFQUtILHlCQUFlLElBTFo7RUFNSCx5QkFBZSxLQU5aO0VBT0gseUJBQWUsQ0FQWjtFQVFILHdCQUFjLEdBUlg7RUFTSCx5QkFBZSxJQVRaO0VBVUgsb0JBQVUsS0FWUDtFQVdILG9CQUFVLEtBWFA7RUFZSCw0QkFBa0IsSUFaZjtFQWFILHFCQUFXLElBYlI7RUFjSCx3QkFBYyxDQWRYO0VBZUgsd0JBQWMsSUFmWDtFQWdCSCx3QkFBYyxLQWhCWDtFQWlCSCw2QkFBbUI7RUFqQmhCO0VBRlgsT0F2TUssQ0FGSjtFQWdPTDBtQixNQUFBQSxVQUFVLEVBQUU7RUFDUmdWLFFBQUFBLElBQUksRUFBRztFQUNIaHNCLFVBQUFBLElBQUksRUFBRyxNQURKO0VBRUhnQixVQUFBQSxJQUFJLEVBQUcsT0FGSjtFQUdIMVEsVUFBQUEsS0FBSyxFQUFHO0VBSEwsU0FEQztFQU1SMjNCLFFBQUFBLFVBQVUsRUFBRztFQUNUam9CLFVBQUFBLElBQUksRUFBRyxZQURFO0VBRVRnQixVQUFBQSxJQUFJLEVBQUcsUUFGRTtFQUdUMVEsVUFBQUEsS0FBSyxFQUFHO0VBSEMsU0FOTDtFQVdScTNCLFFBQUFBLElBQUksRUFBRztFQUNIM25CLFVBQUFBLElBQUksRUFBRyxNQURKO0VBRUhnQixVQUFBQSxJQUFJLEVBQUcsT0FGSjtFQUdIMVEsVUFBQUEsS0FBSyxFQUFJLENBQUMsR0FBRCxFQUFNLE1BQU4sRUFBYyxJQUFkLEVBQW9CLEdBQXBCO0VBSE4sU0FYQztFQWdCUnMzQixRQUFBQSxNQUFNLEVBQUc7RUFDTDVuQixVQUFBQSxJQUFJLEVBQUcsUUFERjtFQUVMZ0IsVUFBQUEsSUFBSSxFQUFHLE9BRkY7RUFHTDFRLFVBQUFBLEtBQUssRUFBRyxDQUFDLE1BQUQsRUFBUyxNQUFULEVBQWlCLE1BQWpCLEVBQXlCLEdBQXpCO0VBSEgsU0FoQkQ7RUFxQlI2M0IsUUFBQUEsV0FBVyxFQUFHO0VBQ1Zub0IsVUFBQUEsSUFBSSxFQUFHLGFBREc7RUFFVmdCLFVBQUFBLElBQUksRUFBRyxRQUZHO0VBR1YxUSxVQUFBQSxLQUFLLEVBQUc7RUFIRSxTQXJCTjtFQTBCUjgzQixRQUFBQSxXQUFXLEVBQUc7RUFDVnBvQixVQUFBQSxJQUFJLEVBQUcsYUFERztFQUVWZ0IsVUFBQUEsSUFBSSxFQUFHLFFBRkc7RUFHVjFRLFVBQUFBLEtBQUssRUFBRztFQUhFLFNBMUJOO0VBK0JSKzNCLFFBQUFBLFdBQVcsRUFBRztFQUNWcm9CLFVBQUFBLElBQUksRUFBRyxhQURHO0VBRVZnQixVQUFBQSxJQUFJLEVBQUcsUUFGRztFQUdWMVEsVUFBQUEsS0FBSyxFQUFHO0VBSEUsU0EvQk47RUFvQ1JnNEIsUUFBQUEsV0FBVyxFQUFHO0VBQ1Z0b0IsVUFBQUEsSUFBSSxFQUFHLGFBREc7RUFFVmdCLFVBQUFBLElBQUksRUFBRyxPQUZHO0VBR1Y2RyxVQUFBQSxPQUFPLEVBQUcsQ0FBQyxHQUFELEVBQU0sSUFBTixFQUFZLEdBQVosQ0FIQTtFQUlWdlgsVUFBQUEsS0FBSyxFQUFHO0VBSkUsU0FwQ047RUEwQ1JpNEIsUUFBQUEsVUFBVSxFQUFHO0VBQ1R2b0IsVUFBQUEsSUFBSSxFQUFHLFlBREU7RUFFVGdCLFVBQUFBLElBQUksRUFBRyxPQUZFO0VBR1Q2RyxVQUFBQSxPQUFPLEVBQUcsQ0FBQyxHQUFELEVBQU0sSUFBTixFQUFZLEdBQVosQ0FIRDtFQUlUdlgsVUFBQUEsS0FBSyxFQUFHO0VBSkMsU0ExQ0w7RUFnRFIyN0IsUUFBQUEsU0FBUyxFQUFHO0VBQ1Jqc0IsVUFBQUEsSUFBSSxFQUFHLFdBREM7RUFFUmdCLFVBQUFBLElBQUksRUFBRyxPQUZDO0VBR1I2RyxVQUFBQSxPQUFPLEVBQUcsQ0FBQyxJQUFELEVBQU8sR0FBUCxFQUFZLElBQVosQ0FIRjtFQUlSdlgsVUFBQUEsS0FBSyxFQUFHO0VBSkEsU0FoREo7RUFzRFI0N0IsUUFBQUEsZUFBZSxFQUFHO0VBQ2Rsc0IsVUFBQUEsSUFBSSxFQUFHLGlCQURPO0VBRWRnQixVQUFBQSxJQUFJLEVBQUcsT0FGTztFQUdkNkcsVUFBQUEsT0FBTyxFQUFHLENBQUMsSUFBRCxFQUFPLEdBQVAsRUFBWSxJQUFaLENBSEk7RUFJZHZYLFVBQUFBLEtBQUssRUFBRztFQUpNLFNBdERWO0VBNERSbTRCLFFBQUFBLGNBQWMsRUFBRztFQUNiem9CLFVBQUFBLElBQUksRUFBRyxnQkFETTtFQUViZ0IsVUFBQUEsSUFBSSxFQUFHLFFBRk07RUFHYjFRLFVBQUFBLEtBQUssRUFBRztFQUhLLFNBNURUO0VBaUVSazRCLFFBQUFBLE9BQU8sRUFBRztFQUNOeG9CLFVBQUFBLElBQUksRUFBRyxTQUREO0VBRU5nQixVQUFBQSxJQUFJLEVBQUcsUUFGRDtFQUdOMVEsVUFBQUEsS0FBSyxFQUFHO0VBSEYsU0FqRUY7RUFzRVJvNEIsUUFBQUEsVUFBVSxFQUFHO0VBQ1Qxb0IsVUFBQUEsSUFBSSxFQUFHLFlBREU7RUFFVGdCLFVBQUFBLElBQUksRUFBRyxRQUZFO0VBR1QxUSxVQUFBQSxLQUFLLEVBQUc7RUFIQyxTQXRFTDtFQTJFUnE0QixRQUFBQSxVQUFVLEVBQUc7RUFDVDNvQixVQUFBQSxJQUFJLEVBQUcsWUFERTtFQUVUZ0IsVUFBQUEsSUFBSSxFQUFHLE9BRkU7RUFHVDZHLFVBQUFBLE9BQU8sRUFBRyxDQUFDLEdBQUQsRUFBTSxHQUFOLEVBQVcsR0FBWCxDQUhEO0VBSVR2WCxVQUFBQSxLQUFLLEVBQUc7RUFKQyxTQTNFTDtFQWlGUnM0QixRQUFBQSxVQUFVLEVBQUc7RUFDVDVvQixVQUFBQSxJQUFJLEVBQUcsWUFERTtFQUVUZ0IsVUFBQUEsSUFBSSxFQUFHLE9BRkU7RUFHVDZHLFVBQUFBLE9BQU8sRUFBRyxDQUFDLEdBQUQsRUFBTSxHQUFOLEVBQVcsR0FBWCxDQUhEO0VBSVR2WCxVQUFBQSxLQUFLLEVBQUc7RUFKQyxTQWpGTDtFQXVGUmkzQixRQUFBQSxPQUFPLEVBQUU7RUFDTHZtQixVQUFBQSxJQUFJLEVBQUUsT0FERDtFQUVMaEIsVUFBQUEsSUFBSSxFQUFFLFNBRkQ7RUFHTDZILFVBQUFBLE9BQU8sRUFBRSxDQUFDLENBQUQsRUFBSSxDQUFKLEVBQU8sSUFBUCxDQUhKO0VBSUx2WCxVQUFBQSxLQUFLLEVBQUU7RUFKRjtFQXZGRDtFQWhPUDtFQXBDa0IsR0FBL0I7RUFvV0EsU0FBTztFQUFFczdCLElBQUFBLGtCQUFrQixFQUFsQkEsa0JBQUY7RUFBc0JHLElBQUFBLHNCQUFzQixFQUF0QkE7RUFBdEIsR0FBUDtFQUNIOztFQ3BkRCxJQUFNbGtCLFNBQU8sR0FBRztFQUNaLGNBQVksSUFEQTtFQUVaLGtCQUFnQixLQUZKO0VBR1osZUFBYSxJQUhEO0VBSVosa0JBQWdCLElBSko7RUFLWnNrQixFQUFBQSxvQkFBb0IsRUFBRSxJQUxWO0VBTVpDLEVBQUFBLG1CQUFtQixFQUFFLElBTlQ7RUFPWkMsRUFBQUEscUJBQXFCLEVBQUU7RUFQWCxDQUFoQjtFQVVBLElBQUkxZCxHQUFHLEdBQUcsQ0FBVjtFQUVBLElBQU0yZCxVQUFVLEdBQUcsQ0FBQyxXQUFELEVBQWMsU0FBZCxFQUF5QixXQUF6QixFQUFzQyxPQUF0QyxFQUErQyxTQUEvQyxFQUEwRCxZQUExRCxFQUF3RSxXQUF4RSxFQUFxRixVQUFyRixDQUFuQjtFQUNBLElBQU16ZSxxQkFBbUIsR0FBRyxHQUE1Qjs7TUFFcUIwZTs7O0VBT2pCLHFCQUFZdkssRUFBWixFQUFnQm5hLE9BQWhCLEVBQXlCO0VBQUE7O0VBQ3JCLHVDQUFNbWEsRUFBTixFQUFVbmEsT0FBVjtFQUNBLFVBQUsrRyxVQUFMLEdBQWtCLEVBQWxCO0VBQ0EsVUFBS3VFLFdBQUwsR0FBbUIsRUFBbkI7RUFDQSxVQUFLNVIsUUFBTCxHQUFnQixFQUFoQjtFQUNBLFVBQUtpckIsU0FBTCxHQUFpQixFQUFqQjtFQUNBLFVBQUtDLE9BQUwsR0FBZSxFQUFmO0VBQ0EsVUFBS0MsU0FBTCxHQUFpQixFQUFqQjs7RUFFQSxRQUFJN2tCLE9BQU8sSUFBSUEsT0FBTyxDQUFDOUksSUFBdkIsRUFBNkI7RUFDekIsWUFBS3NpQixTQUFMLENBQWV4WixPQUFPLENBQUM5SSxJQUF2QjtFQUNIOztFQVhvQjtFQVl4Qjs7Y0FFTTR0QixpQkFBUCx3QkFBc0Izc0IsSUFBdEIsRUFBNEJnQixJQUE1QixFQUFrQ2tRLE1BQWxDLEVBQTBDTCxRQUExQyxFQUFvRCtiLGFBQXBELEVBQW1FO0VBQy9EQyxJQUFBQSxZQUFZLENBQUNoYyxRQUFELEVBQVcrYixhQUFYLENBQVo7RUFDQXZnQixJQUFBQSxVQUFVLENBQUNyTSxJQUFELENBQVYsR0FBbUI7RUFBRUEsTUFBQUEsSUFBSSxFQUFKQSxJQUFGO0VBQVFnQixNQUFBQSxJQUFJLEVBQUpBLElBQVI7RUFBY2tRLE1BQUFBLE1BQU0sRUFBTkEsTUFBZDtFQUFzQkwsTUFBQUEsUUFBUSxFQUFSQSxRQUF0QjtFQUFnQytiLE1BQUFBLGFBQWEsRUFBYkE7RUFBaEMsS0FBbkI7RUFDSDs7Y0FFTUUsZUFBUCxzQkFBb0I5c0IsSUFBcEIsRUFBMEI7RUFDdEIsV0FBT3FNLFVBQVUsQ0FBQ3JNLElBQUQsQ0FBakI7RUFDSDs7Y0FFTStzQixhQUFQLHNCQUFvQjtFQUNoQixRQUFNQyxPQUFPLEdBQUcsRUFBaEI7O0VBQ0EsU0FBSyxJQUFNaHRCLElBQVgsSUFBbUJxTSxVQUFuQixFQUErQjtFQUMzQjJnQixNQUFBQSxPQUFPLENBQUN0N0IsSUFBUixDQUFhO0VBQ1RzZixRQUFBQSxNQUFNLEVBQUVoUixJQURDO0VBRVQ2USxRQUFBQSxRQUFRLEVBQUV4RSxVQUFVLENBQUNyTSxJQUFELENBQVYsQ0FBaUI2USxRQUZsQjtFQUdUK2IsUUFBQUEsYUFBYSxFQUFFdmdCLFVBQVUsQ0FBQ3JNLElBQUQsQ0FBVixDQUFpQjRzQjtFQUh2QixPQUFiO0VBS0g7O0VBQ0QsV0FBT0ksT0FBUDtFQUNIOztjQUVNQyxlQUFQLHdCQUFzQjtFQUNsQixXQUFPNWdCLFVBQVA7RUFDSDs7Y0FFTTZnQixvQkFBUCw2QkFBMkI7RUFDdkIsUUFBTUMsb0JBQW9CLEdBQUd4Qix1QkFBdUIsRUFBcEQ7RUFDQSxRQUFNeUIsV0FBVyxHQUFHQyxjQUFjLEVBQWxDO0VBQ0FkLElBQUFBLFNBQVMsQ0FBQ0ksY0FBVixDQUF5QixPQUF6QixFQUFrQyxhQUFsQyxFQUFpRFMsV0FBVyxDQUFDcGMsTUFBN0QsRUFBcUVvYyxXQUFXLENBQUMxcEIsUUFBWixDQUFxQjBRLFdBQXJCLEVBQXJFLEVBQXlHK1ksb0JBQW9CLENBQUN2QixrQkFBOUg7RUFDQSxRQUFNMEIsZUFBZSxHQUFHQyxrQkFBa0IsRUFBMUM7RUFDQWhCLElBQUFBLFNBQVMsQ0FBQ0ksY0FBVixDQUF5QixXQUF6QixFQUFzQyxpQkFBdEMsRUFBeURXLGVBQWUsQ0FBQ3RjLE1BQXpFLEVBQWlGc2MsZUFBZSxDQUFDNXBCLFFBQWhCLENBQXlCMFEsV0FBekIsRUFBakYsRUFBeUgrWSxvQkFBb0IsQ0FBQ3BCLHNCQUE5STtFQUNBLFFBQU15QixTQUFTLEdBQUdDLFlBQVksRUFBOUI7RUFDQWxCLElBQUFBLFNBQVMsQ0FBQ0ksY0FBVixDQUF5QixLQUF6QixFQUFnQyxlQUFoQyxFQUFpRGEsU0FBUyxDQUFDeGMsTUFBM0QsRUFBbUV3YyxTQUFTLENBQUM5cEIsUUFBN0U7RUFDQSxRQUFNZ3FCLGVBQWUsR0FBR0MsbUJBQW1CLEVBQTNDO0VBQ0FwQixJQUFBQSxTQUFTLENBQUNJLGNBQVYsQ0FBeUIsWUFBekIsRUFBdUMsc0JBQXZDLEVBQStEZSxlQUFlLENBQUMxYyxNQUEvRSxFQUF1RjBjLGVBQWUsQ0FBQ2hxQixRQUF2RztFQUNBLFFBQU1rcUIsV0FBVyxHQUFHQyxjQUFjLEVBQWxDO0VBQ0F0QixJQUFBQSxTQUFTLENBQUNJLGNBQVYsQ0FBeUIsT0FBekIsRUFBa0MsaUJBQWxDLEVBQXFEaUIsV0FBVyxDQUFDNWMsTUFBakUsRUFBeUU0YyxXQUFXLENBQUNscUIsUUFBckY7RUFDSDs7Y0FFTTZsQixtQkFBUCwrQkFBMEI7RUFDdEIsUUFBTXVFLGFBQWEsR0FBR3ZFLGdCQUFnQixFQUF0Qzs7RUFDQSxRQUFNcUQsYUFBYSxHQUFHTCxTQUFTLENBQUNRLFVBQVYsR0FBdUJuOEIsR0FBdkIsQ0FBMkIsVUFBQW9nQixNQUFNLEVBQUk7RUFDdkQsYUFBT0EsTUFBTSxDQUFDNGIsYUFBZDtFQUNILEtBRnFCLENBQXRCOztFQUdBLFNBQUssSUFBSW43QixDQUFDLEdBQUcsQ0FBYixFQUFnQkEsQ0FBQyxHQUFHbTdCLGFBQWEsQ0FBQ245QixNQUFsQyxFQUEwQ2dDLENBQUMsRUFBM0MsRUFBK0M7RUFDM0MsVUFBTXM4QixZQUFZLEdBQUduQixhQUFhLENBQUNuN0IsQ0FBRCxDQUFsQzs7RUFDQSxVQUFJczhCLFlBQUosRUFBa0I7RUFDZCxZQUFNQyxnQkFBZ0IsR0FBR0YsYUFBYSxDQUFDbkUsTUFBZCxDQUFxQkUsS0FBckIsQ0FBMkIsQ0FBM0IsRUFBOEI3UyxVQUE5QixDQUF5Q29KLE1BQXpDLENBQWdEcEosVUFBekU7RUFDQThXLFFBQUFBLGFBQWEsQ0FBQ3BFLE1BQWQsQ0FBcUIsQ0FBckIsRUFBd0J6cEIsUUFBeEIsQ0FBaUN2TyxJQUFqQyxDQUFzQ3E4QixZQUFZLENBQUNsQyxTQUFuRDtFQUNBbUMsUUFBQUEsZ0JBQWdCLENBQUNoZCxNQUFqQixDQUF3Qm5KLE9BQXhCLENBQWdDblcsSUFBaEMsQ0FBcUNxOEIsWUFBWSxDQUFDcEUsTUFBYixDQUFvQjNwQixJQUF6RDtFQUNBZ3VCLFFBQUFBLGdCQUFnQixDQUFDbmQsUUFBakIsQ0FBMEJpWixLQUExQixDQUFnQ3A0QixJQUFoQyxDQUFxQ3E4QixZQUFZLENBQUNwRSxNQUFsRDtFQUNIO0VBQ0o7O0VBQ0QsV0FBT21FLGFBQVA7RUFDSDs7Y0FFTXBPLFdBQVAsa0JBQWdCMVosSUFBaEIsRUFBc0I7RUFDbEIsUUFBSSxDQUFDQSxJQUFELElBQVNBLElBQUksQ0FBQyxNQUFELENBQUosS0FBaUIsV0FBOUIsRUFBMkM7RUFDdkMsYUFBTyxJQUFQO0VBQ0g7O0VBQ0QsUUFBTStILEtBQUssR0FBRyxJQUFJd2UsU0FBSixDQUFjdm1CLElBQUksQ0FBQyxJQUFELENBQWxCLEVBQTBCQSxJQUFJLENBQUMsU0FBRCxDQUE5QixDQUFkO0VBQ0EsUUFBTWlvQixRQUFRLEdBQUdqb0IsSUFBSSxDQUFDLFlBQUQsQ0FBckI7RUFDQSxRQUFNNkwsVUFBVSxHQUFHLEVBQW5COztFQUNBLFNBQUssSUFBSXBnQixDQUFDLEdBQUcsQ0FBYixFQUFnQkEsQ0FBQyxHQUFHdzhCLFFBQVEsQ0FBQ3grQixNQUE3QixFQUFxQ2dDLENBQUMsRUFBdEMsRUFBMEM7RUFDdEMsVUFBTTYwQixHQUFHLEdBQUdsSCxVQUFVLENBQUNNLFFBQVgsQ0FBb0J1TyxRQUFRLENBQUN4OEIsQ0FBRCxDQUE1QixDQUFaOztFQUNBLFVBQUk2MEIsR0FBSixFQUFTO0VBQ0x6VSxRQUFBQSxVQUFVLENBQUNuZ0IsSUFBWCxDQUFnQjQwQixHQUFoQjtFQUNIO0VBQ0o7O0VBQ0R2WSxJQUFBQSxLQUFLLENBQUNzVCxTQUFOLENBQWdCeFAsVUFBaEI7O0VBQ0EsUUFBSTdMLElBQUksQ0FBQyxPQUFELENBQVIsRUFBbUI7RUFDZitILE1BQUFBLEtBQUssQ0FBQ21nQixRQUFOLENBQWVsb0IsSUFBSSxDQUFDLE9BQUQsQ0FBbkI7RUFDSDs7RUFDRCxXQUFPK0gsS0FBUDtFQUNIOzs7O1dBRURzVCxZQUFBLG1CQUFVMU4sT0FBVixFQUFtQjtFQUFBOztFQUlmLFFBQUlxUyxPQUFPLENBQUNZLFNBQVIsQ0FBa0JqVCxPQUFsQixDQUFKLEVBQWdDO0VBQzVCLGFBQU8sS0FBSzBOLFNBQUwsQ0FBZTJFLE9BQU8sQ0FBQ0MsVUFBUixDQUFtQnRTLE9BQW5CLENBQWYsQ0FBUDtFQUNIOztFQUNELFFBQUlyaUIsS0FBSyxDQUFDQyxPQUFOLENBQWNvaUIsT0FBZCxDQUFKLEVBQTRCO0VBQ3hCQSxNQUFBQSxPQUFPLENBQUN0WSxPQUFSLENBQWdCLFVBQUF3VCxNQUFNLEVBQUk7RUFDdEIsUUFBQSxNQUFJLENBQUN3UyxTQUFMLENBQWV4UyxNQUFmO0VBQ0gsT0FGRDtFQUdILEtBSkQsTUFJTztFQUNILFVBQU1BLE1BQU0sR0FBRzhFLE9BQWY7RUFDQTlFLE1BQUFBLE1BQU0sQ0FBQytFLElBQVAsR0FBY2pGLEdBQWQ7RUFDQSxXQUFLQyxVQUFMLENBQWdCRCxHQUFoQixJQUF1QkUsTUFBdkI7O0VBQ0EsV0FBS3NFLFdBQUwsQ0FBaUJ6aEIsSUFBakIsQ0FBc0JtZCxNQUF0Qjs7RUFDQUEsTUFBQUEsTUFBTSxDQUFDK1IsTUFBUCxHQUFnQixJQUFoQjs7RUFDQSxXQUFLc0UsVUFBTCxDQUFnQnJXLE1BQU0sQ0FBQ3NmLGtCQUFQLEVBQWhCOztFQUNBLFVBQU1uTSxFQUFFLEdBQUduVCxNQUFNLENBQUNvVCxLQUFQLEVBQVg7O0VBQ0EsVUFBSUQsRUFBSixFQUFRO0VBQ0osYUFBS3lLLE9BQUwsQ0FBYXpLLEVBQWIsSUFBbUJuVCxNQUFuQjtFQUNIOztFQUNELFdBQUt1ZixVQUFMLENBQWdCdmYsTUFBaEI7O0VBQ0FBLE1BQUFBLE1BQU0sQ0FBQ2dCLElBQVAsQ0FBWSxLQUFaLEVBQW1CO0VBQUU3TyxRQUFBQSxJQUFJLEVBQUcsS0FBVDtFQUFnQnNGLFFBQUFBLE1BQU0sRUFBR3VJLE1BQXpCO0VBQWlDZCxRQUFBQSxLQUFLLEVBQUc7RUFBekMsT0FBbkI7O0VBQ0EsVUFBSWMsTUFBTSxDQUFDd0csT0FBUCxPQUFxQixpQkFBekIsRUFBNEM7RUFDeEMxRyxRQUFBQSxHQUFHLElBQUlFLE1BQU0sQ0FBQzhILFFBQVAsS0FBb0IsQ0FBM0I7RUFDSCxPQUZELE1BRU87RUFDSGhJLFFBQUFBLEdBQUc7RUFDTjtFQUNKOztFQUNELFdBQU8sSUFBUDtFQUNIOztXQUdEMGYsWUFBQSxxQkFBWTtFQUNSLFNBQUs3QixTQUFMLENBQWUsUUFBZixJQUEyQjhCLFFBQVcsQ0FBQyxRQUFELENBQXRDO0VBQ0EsV0FBTyxLQUFLOUIsU0FBWjtFQUNIOztXQUdEMUssU0FBQSxnQkFBT2phLE9BQVAsRUFBZ0I7RUFDWixRQUFJLENBQUNBLE9BQUwsRUFBYztFQUNWQSxNQUFBQSxPQUFPLEdBQUcsRUFBVjtFQUNIOztFQUNELFFBQU0wbUIsT0FBTyxHQUFHO0VBQ1osY0FBUSxLQUFLQyxXQUFMLEVBREk7RUFFWixZQUFNLEtBQUt2TSxLQUFMLEVBRk07RUFHWixpQkFBVyxLQUFLL1EsTUFBTDtFQUhDLEtBQWhCOztFQUtBLFFBQUlsZixLQUFLLENBQUM2VixPQUFPLENBQUMsT0FBRCxDQUFSLENBQUwsSUFBMkJBLE9BQU8sQ0FBQyxPQUFELENBQXRDLEVBQWlEO0VBQzdDMG1CLE1BQUFBLE9BQU8sQ0FBQyxPQUFELENBQVAsR0FBbUIsS0FBS0UsUUFBTCxFQUFuQjtFQUNIOztFQUNELFFBQUl6OEIsS0FBSyxDQUFDNlYsT0FBTyxDQUFDLFlBQUQsQ0FBUixDQUFMLElBQWdDQSxPQUFPLENBQUMsWUFBRCxDQUEzQyxFQUEyRDtFQUN2RCxVQUFNb21CLFFBQVEsR0FBRyxFQUFqQjtFQUNBLFVBQU10YSxPQUFPLEdBQUcsS0FBSythLFVBQUwsRUFBaEI7O0VBQ0EsV0FBSyxJQUFJajlCLENBQUMsR0FBRyxDQUFiLEVBQWdCQSxDQUFDLEdBQUdraUIsT0FBTyxDQUFDbGtCLE1BQTVCLEVBQW9DZ0MsQ0FBQyxFQUFyQyxFQUF5QztFQUNyQyxZQUFNb2QsTUFBTSxHQUFHOEUsT0FBTyxDQUFDbGlCLENBQUQsQ0FBdEI7RUFDQSxZQUFNdVUsSUFBSSxHQUFHNkksTUFBTSxDQUFDaVQsTUFBUCxFQUFiO0VBQ0FtTSxRQUFBQSxRQUFRLENBQUN2OEIsSUFBVCxDQUFjc1UsSUFBZDtFQUNIOztFQUNEdW9CLE1BQUFBLE9BQU8sQ0FBQyxZQUFELENBQVAsR0FBd0JOLFFBQXhCO0VBQ0g7O0VBQ0QsV0FBT00sT0FBUDtFQUNIOztXQUVESCxhQUFBLG9CQUFXdmYsTUFBWCxFQUFtQjtFQUNmLFFBQU00SSxHQUFHLEdBQUc1SSxNQUFNLENBQUMrQyxNQUFQLEVBQVo7O0VBQ0EsUUFBSTZGLEdBQUcsS0FBSyxRQUFaLEVBQXNCO0VBQ2xCLFdBQUtrWCxnQkFBTCxDQUFzQjlmLE1BQXRCO0VBQ0gsS0FGRCxNQUVPO0VBQ0gsV0FBS21TLGFBQUwsQ0FBbUJuUyxNQUFuQjtFQUNIO0VBQ0o7O1dBRURtUyxnQkFBQSx1QkFBY25TLE1BQWQsRUFBc0I7RUFBQTs7RUFDbEIsUUFBTW1CLFFBQVEsR0FBRyxLQUFLNGUsV0FBTCxFQUFqQjs7RUFDQSxRQUFJNWUsUUFBSixFQUFjO0VBQ1YsYUFBTyxLQUFLNmUsZ0JBQUwsQ0FBc0JoZ0IsTUFBdEIsQ0FBUDtFQUNILEtBRkQsTUFFTztFQUNILFdBQUtpSSxFQUFMLENBQVEsZ0JBQVIsRUFBMEIsWUFBTTtFQUM1QixRQUFBLE1BQUksQ0FBQytYLGdCQUFMLENBQXNCaGdCLE1BQXRCO0VBQ0gsT0FGRDtFQUdIOztFQUNELFdBQU8sSUFBUDtFQUNIOztXQUVEZ2dCLG1CQUFBLDBCQUFpQmhnQixNQUFqQixFQUF5QjtFQUFBOztFQUNyQixRQUFNNEksR0FBRyxHQUFHNUksTUFBTSxDQUFDK0MsTUFBUCxFQUFaO0VBQ0EsUUFBTTVCLFFBQVEsR0FBRyxLQUFLNGUsV0FBTCxFQUFqQjs7RUFDQSxRQUFJLENBQUMsS0FBS3J0QixRQUFMLENBQWNrVyxHQUFkLENBQUwsRUFBeUI7RUFDckIsV0FBS2xXLFFBQUwsQ0FBY2tXLEdBQWQsSUFBcUI1SSxNQUFNLENBQUM4USxTQUFQLEVBQXJCO0VBQ0EsV0FBS3BlLFFBQUwsQ0FBY2tXLEdBQWQsRUFBbUJoYyxLQUFuQixHQUEyQixDQUEzQjtFQUNIOztFQUNELFdBQU8sS0FBSzhGLFFBQUwsQ0FBY2tXLEdBQWQsRUFBbUJ6ZixJQUFuQixDQUF3QixVQUFDK0csSUFBRCxFQUFVO0VBRXJDLFVBQUksQ0FBQyxNQUFJLENBQUM2UCxVQUFMLENBQWdCQyxNQUFNLENBQUMrRSxJQUF2QixDQUFELElBQWlDLENBQUMsTUFBSSxDQUFDclMsUUFBTCxDQUFja1csR0FBZCxDQUF0QyxFQUEwRDtFQUN0RDtFQUNIOztFQUNELFVBQU15SSxRQUFRLEdBQUdyUixNQUFNLENBQUM4SSxZQUFQLEVBQWpCOztFQUNBLFVBQUksQ0FBQ3VJLFFBQUwsRUFBZTtFQUNYclIsUUFBQUEsTUFBTSxDQUFDc1IsWUFBUCxDQUFvQnBoQixJQUFwQjtFQUNIOztFQUNELE1BQUEsTUFBSSxDQUFDd0MsUUFBTCxDQUFja1csR0FBZCxFQUFtQnFYLFFBQW5CLEdBQThCamdCLE1BQU0sQ0FBQzJSLFlBQVAsRUFBOUI7RUFDQSxNQUFBLE1BQUksQ0FBQ2dNLFNBQUwsQ0FBZS9VLEdBQWYsSUFBc0IxWSxJQUF0Qjs7RUFDQWlSLE1BQUFBLFFBQVEsQ0FBQ3dILFlBQVQsQ0FBc0IzSSxNQUF0Qjs7RUFDQW1CLE1BQUFBLFFBQVEsQ0FBQ3lCLGlCQUFULENBQTJCNUMsTUFBM0I7O0VBQ0EsTUFBQSxNQUFJLENBQUN0TixRQUFMLENBQWNrVyxHQUFkLEVBQW1CaGMsS0FBbkIsSUFBNEIsQ0FBNUI7RUFFQSxNQUFBLE1BQUksQ0FBQzhGLFFBQUwsQ0FBY2tXLEdBQWQsRUFBbUJzWCxRQUFuQixHQUE4QixJQUE5Qjs7RUFDQWxnQixNQUFBQSxNQUFNLENBQUN3VyxhQUFQLENBQXFCLElBQXJCOztFQUNBeFcsTUFBQUEsTUFBTSxDQUFDZ0IsSUFBUCxDQUFZLE1BQVosRUFBb0I7RUFBRTlRLFFBQUFBLElBQUksRUFBRW1oQjtFQUFSLE9BQXBCOztFQUNBLFVBQUksTUFBSSxDQUFDOE8scUJBQUwsRUFBSixFQUFrQztFQUM5QixRQUFBLE1BQUksQ0FBQ25mLElBQUwsQ0FBVSxXQUFWLEVBQXVCO0VBQUVvZixVQUFBQSxNQUFNLEVBQUUsTUFBSSxDQUFDWixTQUFMO0VBQVYsU0FBdkI7RUFDSDtFQUNKLEtBckJNLENBQVA7RUFzQkg7O1dBR0RhLHNCQUFBLCtCQUFzQjtFQUNsQixTQUFLLElBQU16OUIsQ0FBWCxJQUFnQixLQUFLOFAsUUFBckIsRUFBK0I7RUFDM0IsVUFBSSxDQUFDLEtBQUtBLFFBQUwsQ0FBYzlQLENBQWQsRUFBaUJzOUIsUUFBdEIsRUFBZ0M7RUFDNUIsZUFBTyxLQUFQO0VBQ0g7RUFDSjs7RUFDRCxXQUFPLElBQVA7RUFDSDs7V0FHREMsd0JBQUEsaUNBQXdCO0VBQ3BCLFNBQUssSUFBSXY5QixDQUFDLEdBQUcsQ0FBYixFQUFnQkEsQ0FBQyxHQUFHLEtBQUswaEIsV0FBTCxDQUFpQjFqQixNQUFyQyxFQUE2Q2dDLENBQUMsRUFBOUMsRUFBa0Q7RUFDOUMsVUFBSSxDQUFDLEtBQUswaEIsV0FBTCxDQUFpQjFoQixDQUFqQixFQUFvQjZ6QixRQUFwQixFQUFMLEVBQXFDO0VBQ2pDLGVBQU8sS0FBUDtFQUNIO0VBQ0o7O0VBQ0QsV0FBTyxJQUFQO0VBQ0g7O1dBRURxSixtQkFBQSwwQkFBaUI5ZixNQUFqQixFQUF5QjtFQUNyQixRQUFNNEksR0FBRyxHQUFHNUksTUFBTSxDQUFDK0MsTUFBUCxFQUFaO0VBQ0EvQyxJQUFBQSxNQUFNLENBQUMwUixTQUFQLEdBQW1CLEtBQUtpTSxTQUFMLENBQWUvVSxHQUFmLElBQXNCNlcsUUFBVyxDQUFDN1csR0FBRCxDQUFwRDtFQUNBLFFBQU16SCxRQUFRLEdBQUcsS0FBSzRlLFdBQUwsRUFBakI7O0VBQ0EsUUFBSTVlLFFBQUosRUFBYztFQUNWQSxNQUFBQSxRQUFRLENBQUN3SCxZQUFULENBQXNCM0ksTUFBdEI7RUFDSCxLQUZELE1BRU87RUFDSCxXQUFLaUksRUFBTCxDQUFRLGdCQUFSLEVBQTBCLFVBQUMxa0IsQ0FBRCxFQUFPO0VBQzdCQSxRQUFBQSxDQUFDLENBQUM0ZCxRQUFGLENBQVd3SCxZQUFYLENBQXdCM0ksTUFBeEI7RUFDSCxPQUZEO0VBR0g7O0VBQ0RBLElBQUFBLE1BQU0sQ0FBQ3dXLGFBQVAsQ0FBcUIsSUFBckI7O0VBQ0F4VyxJQUFBQSxNQUFNLENBQUNnQixJQUFQLENBQVksTUFBWixFQUFvQjtFQUFFOVEsTUFBQUEsSUFBSSxFQUFFOFAsTUFBTSxDQUFDMFI7RUFBZixLQUFwQjtFQUNIOztXQW1CRDJOLFdBQUEsa0JBQVNpQixVQUFULEVBQXFCO0VBRWpCLFFBQUksQ0FBQ0EsVUFBTCxFQUFpQjtFQUNiLGFBQU8sS0FBS0MsV0FBWjtFQUNBLGFBQU8sSUFBUDtFQUNIOztFQUNELFNBQUtBLFdBQUwsR0FBbUJoL0IsSUFBSSxDQUFDdVAsS0FBTCxDQUFXdlAsSUFBSSxDQUFDQyxTQUFMLENBQWU4K0IsVUFBZixDQUFYLENBQW5COztFQUNBLFNBQUtFLGdCQUFMOztFQUNBLFdBQU8sSUFBUDtFQUNIOztXQUVEWixXQUFBLG9CQUFXO0VBQ1AsUUFBSSxLQUFLVyxXQUFULEVBQXNCO0VBQ2xCLGFBQU8sS0FBS0EsV0FBTCxDQUFpQkUsS0FBakIsR0FBeUIsS0FBS0YsV0FBTCxDQUFpQkcsS0FBMUMsR0FBa0QsS0FBS0gsV0FBOUQ7RUFDSDs7RUFDRCxXQUFPLEtBQUtBLFdBQVo7RUFDSDs7V0FFRDlLLGVBQUEsc0JBQWFrTCxHQUFiLEVBQWtCeEIsZ0JBQWxCLEVBQW9DO0VBQ2hDLFFBQU11QixLQUFLLEdBQUcsS0FBS2QsUUFBTCxFQUFkOztFQUNBLFFBQUksQ0FBQ2MsS0FBTCxFQUFZO0VBQ1I7RUFDSDs7RUFDRCxRQUFNblAsTUFBTSxHQUFHbVAsS0FBSyxDQUFDQyxHQUFELENBQUwsQ0FBV3BQLE1BQVgsSUFBcUIsRUFBcEM7O0VBQ0EsU0FBSyxJQUFNdm9CLENBQVgsSUFBZ0JtMkIsZ0JBQWhCLEVBQWtDO0VBQzlCNU4sTUFBQUEsTUFBTSxDQUFDdm9CLENBQUQsQ0FBTixHQUFZbTJCLGdCQUFnQixDQUFDbjJCLENBQUQsQ0FBNUI7RUFDSDs7RUFDRCxTQUFLdzNCLGdCQUFMO0VBQ0g7O1dBRURBLG1CQUFBLDRCQUFtQjtFQUNmLFNBQUtJLGVBQUwsQ0FBcUIsS0FBS0wsV0FBMUI7O0VBQ0EsUUFBTU0sVUFBVSxHQUFHLEtBQUtOLFdBQUwsQ0FBaUJFLEtBQWpCLEdBQXlCLEtBQUtGLFdBQUwsQ0FBaUJHLEtBQTFDLEdBQWtELEtBQUtILFdBQTFFO0VBQ0EsU0FBS08sYUFBTCxHQUFxQnYrQixZQUFZLENBQUNzK0IsVUFBRCxDQUFqQzs7RUFDQSxTQUFLdmMsV0FBTCxDQUFpQjlYLE9BQWpCLENBQXlCLFVBQVV3VCxNQUFWLEVBQWtCO0VBQ3ZDLFdBQUsrZ0IsWUFBTCxDQUFrQi9nQixNQUFsQjtFQUNILEtBRkQsRUFFRyxJQUZIO0VBR0g7O1dBRURnaEIsY0FBQSx1QkFBYztFQUNWLFdBQU8zbEIsTUFBTSxDQUFDQyxJQUFQLENBQVksS0FBSzVJLFFBQWpCLENBQVA7RUFDSDs7V0FHRGt1QixrQkFBQSx5QkFBZ0JOLFVBQWhCLEVBQTRCO0VBQ3hCLFFBQUkvYyxhQUFBLENBQWMrVCxRQUFkLENBQXVCZ0osVUFBVSxDQUFDRyxLQUFsQyxDQUFKLEVBQThDO0VBQzFDLFVBQU1RLEtBQUssR0FBRyxpQkFBZDtFQUNBWCxNQUFBQSxVQUFVLENBQUNJLEtBQVgsQ0FBaUJsMEIsT0FBakIsQ0FBeUIsVUFBQTAwQixHQUFHLEVBQUk7RUFDNUIsWUFBTXRZLEdBQUcsR0FBR3NZLEdBQUcsQ0FBQzNQLE1BQUosQ0FBVzNJLEdBQXZCOztFQUNBLFlBQUlBLEdBQUcsSUFBSUEsR0FBRyxDQUFDL21CLE9BQUosQ0FBWSxTQUFaLElBQXlCLENBQUMsQ0FBckMsRUFBd0M7RUFDcENxL0IsVUFBQUEsR0FBRyxDQUFDM1AsTUFBSixDQUFXM0ksR0FBWCxHQUFpQkEsR0FBRyxDQUFDdVksT0FBSixDQUFZRixLQUFaLEVBQW1CWCxVQUFVLENBQUNHLEtBQTlCLENBQWpCO0VBQ0g7RUFDSixPQUxEO0VBTUg7RUFDSjs7V0FFRE0sZUFBQSxzQkFBYS9nQixNQUFiLEVBQXFCO0VBQUE7O0VBQ2pCLFFBQUksQ0FBQyxLQUFLOGdCLGFBQVYsRUFBeUI7RUFDckIsYUFBTyxLQUFQO0VBQ0g7O0VBQ0QsU0FBSyxJQUFJbCtCLENBQUMsR0FBRyxDQUFSLEVBQVdtSixHQUFHLEdBQUcsS0FBSyswQixhQUFMLENBQW1CbGdDLE1BQXpDLEVBQWlEZ0MsQ0FBQyxHQUFHbUosR0FBckQsRUFBMERuSixDQUFDLEVBQTNELEVBQStEO0VBQzNELFVBQUksS0FBS2srQixhQUFMLENBQW1CbCtCLENBQW5CLEVBQXNCLFFBQXRCLEVBQWdDO0VBQUV1bEIsUUFBQUEsVUFBVSxFQUFFbkksTUFBTSxDQUFDaVcsYUFBUDtFQUFkLE9BQWhDLE1BQTRFLElBQWhGLEVBQXNGO0VBQUE7RUFDbEYsY0FBTTFFLE1BQU0sR0FBRyxNQUFJLENBQUN1UCxhQUFMLENBQW1CbCtCLENBQW5CLEVBQXNCLFFBQXRCLENBQWY7RUFDQSxjQUFNOHlCLE1BQU0sR0FBR25FLE1BQU0sQ0FBQzNJLEdBQXRCO0VBQ0EsY0FBTXNKLE1BQU0sR0FBR2xTLE1BQU0sQ0FBQytDLE1BQVAsRUFBZjs7RUFDQS9DLFVBQUFBLE1BQU0sQ0FBQzhSLHNCQUFQLENBQThCLEtBQTlCLEVBQXFDNEQsTUFBckM7O0VBQ0EsY0FBSUEsTUFBTSxJQUFJQSxNQUFNLEtBQUt4RCxNQUF6QixFQUFpQztFQUM3QixZQUFBLE1BQUksQ0FBQ0MsYUFBTCxDQUFtQm5TLE1BQW5CLEVBQTJCN1csSUFBM0IsQ0FBZ0MsWUFBTTtFQUNsQyxjQUFBLE1BQUksQ0FBQ2lwQixtQkFBTCxDQUF5QkYsTUFBekI7O0VBQ0FsUyxjQUFBQSxNQUFNLENBQUNtVixnQkFBUCxDQUF3QjVELE1BQXhCO0VBQ0gsYUFIRDtFQUlILFdBTEQsTUFLTztFQUNIdlIsWUFBQUEsTUFBTSxDQUFDbVYsZ0JBQVAsQ0FBd0I1RCxNQUF4QjtFQUNIOztFQUNEO0VBQUEsZUFBTztFQUFQO0VBYmtGOztFQUFBO0VBY3JGO0VBQ0o7O0VBQ0QsV0FBTyxLQUFQO0VBQ0g7O1dBRUQzTyxvQkFBQSwyQkFBa0I1QyxNQUFsQixFQUEwQjtFQUN0QixRQUFNbUIsUUFBUSxHQUFHLEtBQUs0ZSxXQUFMLEVBQWpCOztFQUNBLFFBQUk1ZSxRQUFKLEVBQWM7RUFDVkEsTUFBQUEsUUFBUSxDQUFDeUIsaUJBQVQsQ0FBMkI1QyxNQUEzQjtFQUNIO0VBQ0o7O1dBRURxVyxhQUFBLG9CQUFXRixNQUFYLEVBQW1CO0VBQUE7O0VBQ2YsUUFBTWlMLFdBQVcsR0FBRzdkLGFBQUEsQ0FBYytULFFBQWQsQ0FBdUJuQixNQUF2QixJQUFpQ0EsTUFBTSxDQUFDelMsS0FBUCxDQUFhLEtBQWIsRUFBb0IzaEIsR0FBcEIsQ0FBd0IsVUFBQXdCLENBQUMsRUFBSTtFQUU5RSxhQUFRQSxDQUFDLEtBQUssWUFBTixJQUFzQkEsQ0FBQyxLQUFLLFlBQTVCLElBQTRDQSxDQUFDLEtBQUssVUFBbkQsR0FBaUUsV0FBakUsR0FBK0VBLENBQXRGO0VBQ0gsS0FIb0QsQ0FBakMsR0FHZjR5QixNQUhMO0VBSUEsUUFBTWtMLGFBQWEsR0FBRyxLQUFLeEQsU0FBM0I7RUFDQSxRQUFNeUQsU0FBUyxHQUFHNzlCLGNBQWMsQ0FBQzI5QixXQUFELEVBQWMzRCxVQUFkLENBQWQsQ0FBd0NqOUIsTUFBeEMsQ0FBK0MsVUFBQStDLENBQUMsRUFBSTtFQUNsRSxhQUFPLE1BQUksQ0FBQ3M2QixTQUFMLENBQWVoOEIsT0FBZixDQUF1QjBCLENBQXZCLElBQTRCLENBQW5DO0VBQ0gsS0FGaUIsQ0FBbEI7RUFHQSxTQUFLczZCLFNBQUwsSUFBa0IsTUFBTXlELFNBQVMsQ0FBQ3QvQixJQUFWLENBQWUsR0FBZixDQUF4QjtFQUNBLFNBQUs2N0IsU0FBTCxHQUFpQixLQUFLQSxTQUFMLENBQWUwRCxJQUFmLEVBQWpCO0VBQ0EsUUFBTXgvQixHQUFHLEdBQUcsS0FBS21mLE1BQUwsRUFBWjs7RUFDQSxRQUFJbmYsR0FBSixFQUFTO0VBQ0xBLE1BQUFBLEdBQUcsQ0FBQ3UwQixHQUFKLENBQVErSyxhQUFSLEVBQXVCLEtBQUtHLGdCQUE1QixFQUE4QyxJQUE5QztFQUNBei9CLE1BQUFBLEdBQUcsQ0FBQ2ttQixFQUFKLENBQU8sS0FBSzRWLFNBQVosRUFBdUIsS0FBSzJELGdCQUE1QixFQUE4QyxJQUE5QztFQUNIO0VBQ0o7O1dBRURqTCxnQkFBQSx5QkFBZ0I7RUFDWixRQUFNK0ssU0FBUyxHQUFHLEVBQWxCO0VBQ0EsUUFBTUQsYUFBYSxHQUFHLEtBQUt4RCxTQUEzQjs7RUFDQSxTQUFLLElBQUlqN0IsQ0FBQyxHQUFHLENBQWIsRUFBZ0JBLENBQUMsR0FBRyxLQUFLMGhCLFdBQUwsQ0FBaUIxakIsTUFBckMsRUFBNkNnQyxDQUFDLEVBQTlDLEVBQWtEO0VBQzlDLFVBQU1vZCxNQUFNLEdBQUcsS0FBS3NFLFdBQUwsQ0FBaUIxaEIsQ0FBakIsQ0FBZjtFQUVBLFVBQU02K0IsWUFBWSxHQUFHemhCLE1BQU0sQ0FBQ3NmLGtCQUFQLEdBQTRCdjlCLEdBQTVCLENBQWdDLFVBQUF3QixDQUFDLEVBQUk7RUFDdEQsZUFBUUEsQ0FBQyxLQUFLLFlBQU4sSUFBc0JBLENBQUMsS0FBSyxZQUE1QixJQUE0Q0EsQ0FBQyxLQUFLLFVBQW5ELEdBQWlFLFdBQWpFLEdBQStFQSxDQUF0RjtFQUNILE9BRm9CLENBQXJCOztFQUlBLFdBQUssSUFBSStoQixFQUFFLEdBQUcsQ0FBZCxFQUFpQkEsRUFBRSxHQUFHbWMsWUFBWSxDQUFDN2dDLE1BQW5DLEVBQTJDMGtCLEVBQUUsRUFBN0MsRUFBaUQ7RUFFN0NnYyxRQUFBQSxTQUFTLENBQUNHLFlBQVksQ0FBQ25jLEVBQUQsQ0FBYixDQUFULEdBQThCLENBQTlCO0VBQ0g7RUFDSjs7RUFDRCxTQUFLdVksU0FBTCxHQUFpQnA2QixjQUFjLENBQUM0WCxNQUFNLENBQUNDLElBQVAsQ0FBWWdtQixTQUFaLENBQUQsRUFBeUI3RCxVQUF6QixDQUFkLENBQW1EejdCLElBQW5ELENBQXdELEdBQXhELENBQWpCO0VBQ0EsUUFBTUQsR0FBRyxHQUFHLEtBQUttZixNQUFMLEVBQVo7O0VBQ0EsUUFBSW5mLEdBQUosRUFBUztFQUNMQSxNQUFBQSxHQUFHLENBQUN1MEIsR0FBSixDQUFRK0ssYUFBUixFQUF1QixLQUFLRyxnQkFBNUIsRUFBOEMsSUFBOUM7RUFDQXovQixNQUFBQSxHQUFHLENBQUNrbUIsRUFBSixDQUFPLEtBQUs0VixTQUFaLEVBQXVCLEtBQUsyRCxnQkFBNUIsRUFBOEMsSUFBOUM7RUFDSDtFQUNKOztXQUVEOU8sZUFBQSxzQkFBYTVOLE9BQWIsRUFBc0I7RUFBQTs7RUFDbEIsUUFBSXJpQixLQUFLLENBQUNDLE9BQU4sQ0FBY29pQixPQUFkLENBQUosRUFBNEI7RUFDeEJBLE1BQUFBLE9BQU8sQ0FBQ3RZLE9BQVIsQ0FBZ0IsVUFBQXdULE1BQU0sRUFBSTtFQUN0QixRQUFBLE1BQUksQ0FBQzBTLFlBQUwsQ0FBa0IxUyxNQUFsQjtFQUNILE9BRkQ7RUFHSCxLQUpELE1BSU87RUFDSCxXQUFLMGhCLGFBQUwsQ0FBbUI1YyxPQUFuQjs7RUFDQSxXQUFLeVIsYUFBTDtFQUNIO0VBQ0o7O1dBRUQ5RCxTQUFBLGtCQUFTO0VBQ0wsUUFBTTF3QixHQUFHLEdBQUcsS0FBS21mLE1BQUwsRUFBWjs7RUFDQSxRQUFJLENBQUNuZixHQUFMLEVBQVU7RUFDTjtFQUNIOztFQUNEQSxJQUFBQSxHQUFHLENBQUN1MEIsR0FBSixDQUFRLEtBQUt1SCxTQUFiLEVBQXdCLEtBQUsyRCxnQkFBN0I7O0VBQ0EsOEJBQU0vTyxNQUFOO0VBQ0g7O1dBRURrUCxXQUFBLGtCQUFTNzJCLENBQVQsRUFBWWhDLENBQVosRUFBZWtRLE9BQWYsRUFBd0I7RUFDcEIsUUFBTW1JLFFBQVEsR0FBRyxLQUFLNGUsV0FBTCxFQUFqQjs7RUFDQSxRQUFJNWUsUUFBSixFQUFjO0VBQ1YsYUFBT0EsUUFBUSxDQUFDa0wsU0FBVCxDQUFtQnZoQixDQUFuQixFQUFzQmhDLENBQXRCLEVBQXlCa1EsT0FBekIsQ0FBUDtFQUNIOztFQUNELFdBQU8sSUFBUDtFQUNIOztXQUVEMG9CLGdCQUFBLHVCQUFjMWhCLE1BQWQsRUFBc0I7RUFDbEIsUUFBTTRJLEdBQUcsR0FBRzVJLE1BQU0sQ0FBQytDLE1BQVAsRUFBWjtFQUNBLFFBQU1vUSxFQUFFLEdBQUc1UCxhQUFBLENBQWMrVCxRQUFkLENBQXVCdFgsTUFBdkIsSUFBaUMsS0FBSzRkLE9BQUwsQ0FBYTVkLE1BQWIsRUFBcUIrRSxJQUF0RCxHQUE2RC9FLE1BQU0sQ0FBQytFLElBQS9FOztFQUNBLFNBQUtULFdBQUwsQ0FBaUJ6YyxNQUFqQixDQUF3QixLQUFLeWMsV0FBTCxDQUFpQnppQixPQUFqQixDQUF5QixLQUFLa2UsVUFBTCxDQUFnQm9ULEVBQWhCLENBQXpCLENBQXhCLEVBQXVFLENBQXZFOztFQUNBLFFBQUksS0FBS3pnQixRQUFMLENBQWNrVyxHQUFkLENBQUosRUFBd0I7RUFDcEIsV0FBS2xXLFFBQUwsQ0FBY2tXLEdBQWQsRUFBbUJoYyxLQUFuQixJQUE0QixDQUE1QjtFQUNIOztFQUNELFFBQUksS0FBSzhGLFFBQUwsQ0FBY2tXLEdBQWQsRUFBbUJoYyxLQUFuQixJQUE0QixDQUFoQyxFQUFtQztFQUMvQixhQUFPLEtBQUs4RixRQUFMLENBQWNrVyxHQUFkLENBQVA7RUFDSDs7RUFDRCxRQUFNekgsUUFBUSxHQUFHLEtBQUs0ZSxXQUFMLEVBQWpCOztFQUNBLFFBQUk1ZSxRQUFKLEVBQWM7RUFDVkEsTUFBQUEsUUFBUSxDQUFDNEssWUFBVCxDQUFzQm9ILEVBQXRCO0VBQ0g7O0VBQ0QsV0FBTyxLQUFLcFQsVUFBTCxDQUFnQm9ULEVBQWhCLENBQVA7RUFDQSxXQUFPLEtBQUt5SyxPQUFMLENBQWE1ZCxNQUFiLENBQVA7RUFDSDs7V0FFRG9TLHNCQUFBLDZCQUFvQnhKLEdBQXBCLEVBQXlCO0VBQ3JCLFFBQUksQ0FBQyxLQUFLbFcsUUFBTCxDQUFja1csR0FBZCxDQUFMLEVBQXlCO0VBQ3JCO0VBQ0g7O0VBQ0QsU0FBS2xXLFFBQUwsQ0FBY2tXLEdBQWQsRUFBbUJoYyxLQUFuQixJQUE0QixDQUE1Qjs7RUFDQSxRQUFJLEtBQUs4RixRQUFMLENBQWNrVyxHQUFkLEVBQW1CaGMsS0FBbkIsSUFBNEIsQ0FBaEMsRUFBbUM7RUFDL0IsYUFBTyxLQUFLOEYsUUFBTCxDQUFja1csR0FBZCxDQUFQO0VBQ0EsYUFBTyxLQUFLK1UsU0FBTCxDQUFlL1UsR0FBZixDQUFQO0VBQ0g7O0VBQ0QsUUFBTXpILFFBQVEsR0FBRyxLQUFLNGUsV0FBTCxFQUFqQjs7RUFDQSxRQUFJNWUsUUFBSixFQUFjO0VBQ1ZBLE1BQUFBLFFBQVEsQ0FBQ2dMLGVBQVQsQ0FBeUJ2RCxHQUF6QjtFQUNIO0VBQ0o7O1dBRURpWCxhQUFBLHNCQUFhO0VBQ1QsV0FBTyxLQUFLdmIsV0FBWjtFQUNIOztXQUVEc2QsVUFBQSxpQkFBUXpPLEVBQVIsRUFBWTtFQUNSLFdBQU8sS0FBS3lLLE9BQUwsQ0FBYXpLLEVBQWIsQ0FBUDtFQUNIOztXQUVEckwsV0FBQSxvQkFBVztFQUNQLFdBQU8sS0FBS3hELFdBQUwsQ0FBaUIxakIsTUFBeEI7RUFDSDs7V0FFRGloQyxTQUFBLGtCQUFTO0VBQ0wsV0FBTyxLQUFLdmQsV0FBTCxDQUFpQnRqQixLQUFqQixDQUF1QixDQUF2QixDQUFQO0VBQ0g7O1dBRUQ4aUIsUUFBQSxpQkFBUTtFQUNKLFFBQU0zQyxRQUFRLEdBQUcsS0FBSzRlLFdBQUwsRUFBakI7O0VBQ0EsUUFBSTVlLFFBQUosRUFBYztFQUNWQSxNQUFBQSxRQUFRLENBQUM4SyxVQUFUO0VBQ0g7O0VBQ0QsU0FBS2xNLFVBQUwsR0FBa0IsRUFBbEI7RUFDQSxTQUFLdUUsV0FBTCxHQUFtQixFQUFuQjtFQUNBLFNBQUs1UixRQUFMLEdBQWdCLEVBQWhCO0VBQ0EsU0FBS2tyQixPQUFMLEdBQWUsRUFBZjtFQUNBLFdBQU8sSUFBUDtFQUNIOztXQUVENEQsbUJBQUEsMEJBQWlCaitCLENBQWpCLEVBQW9CO0VBQ2hCLFFBQUksQ0FBQyxLQUFLeVYsT0FBTCxDQUFheW9CLFlBQWxCLEVBQWdDO0VBQzVCO0VBQ0g7O0VBQ0QsUUFBTTEvQixHQUFHLEdBQUcsS0FBS21mLE1BQUwsRUFBWjs7RUFDQSxRQUFJLENBQUNuZixHQUFMLEVBQVU7RUFDTjtFQUNIOztFQUNELFNBQUsrL0IsYUFBTCxHQUFxQixLQUFLQyxnQkFBMUI7RUFDQSxTQUFLQyxVQUFMLEdBQWtCLEtBQUtDLGFBQXZCO0VBQ0EsU0FBS0MsV0FBTCxHQUFtQixLQUFLQyxjQUF4QjtFQUNBLFNBQUtDLGNBQUwsR0FBc0IsS0FBS0MsaUJBQTNCO0VBQ0EsUUFBTUMsY0FBYyxHQUFHdmdDLEdBQUcsQ0FBQ3dnQywwQkFBSixDQUErQmgvQixDQUFDLENBQUMwd0IsVUFBakMsRUFBNkNseUIsR0FBRyxDQUFDazFCLFNBQUosRUFBN0MsQ0FBdkI7RUFDQSxRQUFNbnNCLENBQUMsR0FBRy9GLElBQUksQ0FBQ3k5QixLQUFMLENBQVdGLGNBQWMsQ0FBQ3gzQixDQUExQixDQUFWO0VBQUEsUUFBd0NoQyxDQUFDLEdBQUcvRCxJQUFJLENBQUN5OUIsS0FBTCxDQUFXRixjQUFjLENBQUN4NUIsQ0FBMUIsQ0FBNUM7O0VBQ0EsUUFBSWdDLENBQUMsSUFBSSxDQUFMLElBQVVBLENBQUMsSUFBSS9JLEdBQUcsQ0FBQ3NULEtBQW5CLElBQTRCdk0sQ0FBQyxJQUFJLENBQWpDLElBQXNDQSxDQUFDLElBQUkvRyxHQUFHLENBQUN1VCxNQUFuRCxFQUEyRDtFQUN2RCxXQUFLeXNCLGdCQUFMLEdBQXdCLElBQXhCO0VBQ0EsV0FBS0ksY0FBTCxHQUFzQixJQUF0QjtFQUNBLFdBQUtGLGFBQUwsR0FBcUIsSUFBckI7RUFDQTtFQUNIOztFQUNELFFBQU1sUyxNQUFNLEdBQUcsS0FBSzRSLFFBQUwsQ0FBYzcyQixDQUFkLEVBQWlCaEMsQ0FBakIsQ0FBZjs7RUFDQSxRQUFJLENBQUNpbkIsTUFBTCxFQUFhO0VBQ1Q7RUFDSDs7RUFDRCxTQUFLZ1MsZ0JBQUwsR0FBd0JoUyxNQUFNLENBQUN0WSxNQUFQLEdBQWdCc1ksTUFBTSxDQUFDdFksTUFBUCxDQUFjc04sSUFBOUIsR0FBcUMsSUFBN0Q7RUFDQSxTQUFLb2QsY0FBTCxHQUFzQnBTLE1BQU0sQ0FBQ3JELE1BQTdCO0VBQ0EsU0FBS3VWLGFBQUwsR0FBcUIxZ0MsSUFBSSxDQUFDQyxTQUFMLENBQWV1dUIsTUFBTSxDQUFDbkQsS0FBdEIsQ0FBckI7RUFDQSxTQUFLeVYsaUJBQUwsR0FBeUJ0UyxNQUFNLENBQUNwRCxTQUFoQzs7RUFDQSxRQUFJcHBCLENBQUMsQ0FBQzRPLElBQUYsS0FBVyxXQUFmLEVBQTRCO0VBQ3hCLFVBQU1zd0IsZ0JBQWdCLEdBQUcsS0FBS0Msb0JBQUwsRUFBekI7O0VBQ0FELE1BQUFBLGdCQUFnQixDQUFDajJCLE9BQWpCLENBQXlCLFVBQUFqSixDQUFDLEVBQUk7RUFDMUJBLFFBQUFBLENBQUMsQ0FBQ2tVLE1BQUYsQ0FBU3VKLElBQVQsQ0FBY3pkLENBQUMsQ0FBQzRPLElBQWhCLEVBQXNCNU8sQ0FBdEI7RUFDSCxPQUZEO0VBR0gsS0FMRCxNQUtPLElBQUl3c0IsTUFBTSxDQUFDdFksTUFBWCxFQUFtQjtFQUN0QnNZLE1BQUFBLE1BQU0sQ0FBQ3RZLE1BQVAsQ0FBY3VKLElBQWQsQ0FBbUJ6ZCxDQUFDLENBQUM0TyxJQUFyQixFQUEyQjtFQUN2QkEsUUFBQUEsSUFBSSxFQUFFNU8sQ0FBQyxDQUFDNE8sSUFEZTtFQUV2QnNGLFFBQUFBLE1BQU0sRUFBRXNZLE1BQU0sQ0FBQ3RZLE1BRlE7RUFHdkJpVixRQUFBQSxNQUFNLEVBQUVxRCxNQUFNLENBQUNyRCxNQUhRO0VBSXZCQyxRQUFBQSxTQUFTLEVBQUdvRCxNQUFNLENBQUNwRCxTQUpJO0VBS3ZCQyxRQUFBQSxLQUFLLEVBQUVtRCxNQUFNLENBQUNuRDtFQUxTLE9BQTNCO0VBT0g7RUFDSjs7V0FFRDhWLHVCQUFBLGdDQUF1QjtFQUNuQixRQUFNQyxZQUFZLEdBQUcsRUFBckI7O0VBQ0EsUUFBSXQvQixPQUFPLENBQUMsS0FBSzArQixnQkFBTixDQUFQLElBQWtDLENBQUMxK0IsT0FBTyxDQUFDLEtBQUt5K0IsYUFBTixDQUE5QyxFQUFvRTtFQUNoRWEsTUFBQUEsWUFBWSxDQUFDOS9CLElBQWIsQ0FBa0I7RUFDZHNQLFFBQUFBLElBQUksRUFBRSxZQURRO0VBRWRzRixRQUFBQSxNQUFNLEVBQUUsS0FBS3NJLFVBQUwsQ0FBZ0IsS0FBS2dpQixnQkFBckIsQ0FGTTtFQUdkclYsUUFBQUEsTUFBTSxFQUFFLEtBQUt5VixjQUhDO0VBSWR4VixRQUFBQSxTQUFTLEVBQUcsS0FBSzBWLGlCQUpIO0VBS2R6VixRQUFBQSxLQUFLLEVBQUVyckIsSUFBSSxDQUFDdVAsS0FBTCxDQUFXLEtBQUtteEIsYUFBaEI7RUFMTyxPQUFsQjtFQU9ILEtBUkQsTUFRTyxJQUFJLENBQUM1K0IsT0FBTyxDQUFDLEtBQUswK0IsZ0JBQU4sQ0FBUixJQUFtQzErQixPQUFPLENBQUMsS0FBS3krQixhQUFOLENBQTlDLEVBQW9FO0VBQ3ZFYSxNQUFBQSxZQUFZLENBQUM5L0IsSUFBYixDQUFrQjtFQUNkc1AsUUFBQUEsSUFBSSxFQUFFLFVBRFE7RUFFZHNGLFFBQUFBLE1BQU0sRUFBRSxLQUFLc0ksVUFBTCxDQUFnQixLQUFLK2hCLGFBQXJCLENBRk07RUFHZHBWLFFBQUFBLE1BQU0sRUFBRSxLQUFLd1YsV0FIQztFQUlkdlYsUUFBQUEsU0FBUyxFQUFHLEtBQUt5VixjQUpIO0VBS2R4VixRQUFBQSxLQUFLLEVBQUVyckIsSUFBSSxDQUFDdVAsS0FBTCxDQUFXLEtBQUtreEIsVUFBaEI7RUFMTyxPQUFsQixFQU9BO0VBQ0k3dkIsUUFBQUEsSUFBSSxFQUFFLFlBRFY7RUFFSXNGLFFBQUFBLE1BQU0sRUFBRSxLQUFLc0ksVUFBTCxDQUFnQixLQUFLK2hCLGFBQXJCLENBRlo7RUFHSXBWLFFBQUFBLE1BQU0sRUFBRSxLQUFLd1YsV0FIakI7RUFJSXZWLFFBQUFBLFNBQVMsRUFBRyxLQUFLeVYsY0FKckI7RUFLSXhWLFFBQUFBLEtBQUssRUFBRXJyQixJQUFJLENBQUN1UCxLQUFMLENBQVcsS0FBS2t4QixVQUFoQjtFQUxYLE9BUEE7RUFjSCxLQWZNLE1BZUEsSUFBSTMrQixPQUFPLENBQUMsS0FBSzArQixnQkFBTixDQUFQLElBQWtDMStCLE9BQU8sQ0FBQyxLQUFLeStCLGFBQU4sQ0FBN0MsRUFBbUU7RUFDdEUsVUFBSSxLQUFLQyxnQkFBTCxLQUEwQixLQUFLRCxhQUFuQyxFQUFrRDtFQUM5Q2EsUUFBQUEsWUFBWSxDQUFDOS9CLElBQWIsQ0FBa0I7RUFDZHNQLFVBQUFBLElBQUksRUFBRSxXQURRO0VBRWRzRixVQUFBQSxNQUFNLEVBQUUsS0FBS3NJLFVBQUwsQ0FBZ0IsS0FBS2dpQixnQkFBckIsQ0FGTTtFQUdkclYsVUFBQUEsTUFBTSxFQUFFLEtBQUt5VixjQUhDO0VBSWR4VixVQUFBQSxTQUFTLEVBQUcsS0FBSzBWLGlCQUpIO0VBS2R6VixVQUFBQSxLQUFLLEVBQUVyckIsSUFBSSxDQUFDdVAsS0FBTCxDQUFXLEtBQUtteEIsYUFBaEI7RUFMTyxTQUFsQjtFQU9ILE9BUkQsTUFRTztFQUNIVSxRQUFBQSxZQUFZLENBQUM5L0IsSUFBYixDQUFrQjtFQUNkc1AsVUFBQUEsSUFBSSxFQUFFLFlBRFE7RUFFZHNGLFVBQUFBLE1BQU0sRUFBRSxLQUFLc0ksVUFBTCxDQUFnQixLQUFLZ2lCLGdCQUFyQixDQUZNO0VBR2RyVixVQUFBQSxNQUFNLEVBQUUsS0FBS3lWLGNBSEM7RUFJZHhWLFVBQUFBLFNBQVMsRUFBRyxLQUFLMFYsaUJBSkg7RUFLZHpWLFVBQUFBLEtBQUssRUFBRXJyQixJQUFJLENBQUN1UCxLQUFMLENBQVcsS0FBS214QixhQUFoQjtFQUxPLFNBQWxCLEVBT0E7RUFDSTl2QixVQUFBQSxJQUFJLEVBQUUsVUFEVjtFQUVJc0YsVUFBQUEsTUFBTSxFQUFFLEtBQUtzSSxVQUFMLENBQWdCLEtBQUsraEIsYUFBckIsQ0FGWjtFQUdJcFYsVUFBQUEsTUFBTSxFQUFFLEtBQUt3VixXQUhqQjtFQUlJdlYsVUFBQUEsU0FBUyxFQUFHLEtBQUt5VixjQUpyQjtFQUtJeFYsVUFBQUEsS0FBSyxFQUFFcnJCLElBQUksQ0FBQ3VQLEtBQUwsQ0FBVyxLQUFLa3hCLFVBQWhCO0VBTFgsU0FQQSxFQWNBO0VBQ0k3dkIsVUFBQUEsSUFBSSxFQUFFLFlBRFY7RUFFSXNGLFVBQUFBLE1BQU0sRUFBRSxLQUFLc0ksVUFBTCxDQUFnQixLQUFLK2hCLGFBQXJCLENBRlo7RUFHSXBWLFVBQUFBLE1BQU0sRUFBRSxLQUFLd1YsV0FIakI7RUFJSXZWLFVBQUFBLFNBQVMsRUFBRyxLQUFLeVYsY0FKckI7RUFLSXhWLFVBQUFBLEtBQUssRUFBRXJyQixJQUFJLENBQUN1UCxLQUFMLENBQVcsS0FBS2t4QixVQUFoQjtFQUxYLFNBZEE7RUFxQkg7RUFDSjs7RUFDRCxXQUFPVyxZQUFQO0VBQ0g7O1dBRURDLG1CQUFBLDBCQUFpQkMsRUFBakIsRUFBcUI7RUFBQTs7RUFDakIsUUFBSSxDQUFDQSxFQUFMLEVBQVM7RUFDTDtFQUNIOztFQUNELFFBQUksS0FBSzFDLHFCQUFMLEVBQUosRUFBa0M7RUFDOUIwQyxNQUFBQSxFQUFFLENBQUMsS0FBS0MsY0FBTCxFQUFELENBQUY7RUFDSCxLQUZELE1BRU87RUFDSCxXQUFLN2EsRUFBTCxDQUFRLFdBQVIsRUFBcUIsWUFBTTtFQUN2QjRhLFFBQUFBLEVBQUUsQ0FBQyxNQUFJLENBQUNDLGNBQUwsRUFBRCxDQUFGO0VBQ0gsT0FGRDtFQUdIO0VBQ0o7O1dBRURBLGlCQUFBLDBCQUFpQjtFQUNiLFFBQU1DLFNBQVMsR0FBRyxFQUFsQjs7RUFDQSxTQUFLLElBQU1uWCxHQUFYLElBQWtCLEtBQUtsWixRQUF2QixFQUFpQztFQUM3QixVQUFNeUUsSUFBSSxHQUFHLEtBQUt6RSxRQUFMLENBQWNrWixHQUFkLEVBQW1CcVUsUUFBaEM7RUFDQSxVQUFNK0MsS0FBSyxHQUFHQyxtQkFBbUIsQ0FBQzlyQixJQUFELENBQWpDO0VBQ0E0ckIsTUFBQUEsU0FBUyxDQUFDblgsR0FBRCxDQUFULEdBQWlCb1gsS0FBakI7RUFDSDs7RUFDRCxXQUFPRCxTQUFQO0VBQ0g7O1dBRURHLGVBQUEsc0JBQWFDLGNBQWIsRUFBNkI7RUFBQTs7RUFDekIsUUFBTUMsUUFBUSxHQUFHRCxjQUFjLENBQUNwaEMsR0FBZixDQUFtQixVQUFBNm1CLEdBQUc7RUFBQSxhQUFJLElBQUkzWixPQUFKLENBQVksVUFBVXRHLE9BQVYsRUFBbUI7RUFDdEUsWUFBTTA2QixHQUFHLEdBQUcsSUFBSTluQixLQUFKLEVBQVo7O0VBQ0E4bkIsUUFBQUEsR0FBRyxDQUFDN25CLE1BQUosR0FBYSxZQUFZO0VBQ3JCN1MsVUFBQUEsT0FBTyxDQUFDMDZCLEdBQUQsQ0FBUDtFQUNILFNBRkQ7O0VBR0FBLFFBQUFBLEdBQUcsQ0FBQ3BnQyxHQUFKLEdBQVUybEIsR0FBVjtFQUNILE9BTjBDLENBQUo7RUFBQSxLQUF0QixDQUFqQjtFQU9BM1osSUFBQUEsT0FBTyxDQUFDckYsR0FBUixDQUFZdzVCLFFBQVosRUFBc0JqNkIsSUFBdEIsQ0FBMkIsVUFBQWtKLE1BQU0sRUFBSTtFQUNqQyxVQUFNOE8sUUFBUSxHQUFHLE1BQUksQ0FBQzRlLFdBQUwsRUFBakI7O0VBQ0EsVUFBSTVlLFFBQUosRUFBYztFQUNWLFFBQUEsTUFBSSxDQUFDbWlCLGNBQUwsQ0FBb0JqeEIsTUFBcEIsRUFBNEI4TyxRQUE1QjtFQUNILE9BRkQsTUFFTztFQUNILFFBQUEsTUFBSSxDQUFDOEcsRUFBTCxDQUFRLGdCQUFSLEVBQTBCLFVBQUMxa0IsQ0FBRCxFQUFPO0VBQzdCLFVBQUEsTUFBSSxDQUFDKy9CLGNBQUwsQ0FBb0JqeEIsTUFBcEIsRUFBNEI5TyxDQUFDLENBQUM0ZCxRQUE5QjtFQUNILFNBRkQ7RUFHSDtFQUNKLEtBVEQ7RUFVSDs7V0FFRG1pQixpQkFBQSx3QkFBZWp4QixNQUFmLEVBQXVCOE8sUUFBdkIsRUFBaUM7RUFDN0IsUUFBTXBmLEdBQUcsR0FBRyxLQUFLbWYsTUFBTCxFQUFaO0VBQ0EsUUFBTXFpQixPQUFPLEdBQUdDLFVBQVUsQ0FBQ3JpQixRQUFRLENBQUNQLElBQVYsRUFBZ0J2TyxNQUFNLENBQUNyUixLQUFQLENBQWEsQ0FBYixFQUFnQixDQUFoQixDQUFoQixDQUExQjtFQUVBbWdCLElBQUFBLFFBQVEsQ0FBQ2lELFlBQVQsR0FBd0I7RUFDcEIsc0JBQWdCbWYsT0FBTyxDQUFDRSxNQURKO0VBRXBCLDJCQUFxQkYsT0FBTyxDQUFDRyxZQUZUO0VBR3BCLG9CQUFjLENBQUN2aUIsUUFBUSxDQUFDZixNQUFULENBQWdCL0ssS0FBakIsRUFBd0I4TCxRQUFRLENBQUNmLE1BQVQsQ0FBZ0I5SyxNQUF4QyxFQUFnRCxJQUFJNkwsUUFBUSxDQUFDZixNQUFULENBQWdCL0ssS0FBcEUsRUFBMkUsSUFBSThMLFFBQVEsQ0FBQ2YsTUFBVCxDQUFnQjlLLE1BQS9GLENBSE07RUFJcEIsd0JBQWtCdlQsR0FBRyxDQUFDMmYsY0FKRjtFQUtwQixlQUFTNmhCLE9BQU8sQ0FBQ0k7RUFMRyxLQUF4QjtFQU9BeGlCLElBQUFBLFFBQVEsQ0FBQ0csU0FBVCxHQUFxQmlDLGFBQUEsQ0FBY3pnQixNQUFkLENBQXFCLEVBQXJCLEVBQXlCcWUsUUFBUSxDQUFDaUQsWUFBbEMsRUFBZ0RqRCxRQUFRLENBQUNHLFNBQXpELENBQXJCO0VBQ0g7OztJQW5vQmtDaUM7RUFzb0J2Q21hLFNBQVMsQ0FBQ1csaUJBQVY7RUFFQVgsU0FBUyxDQUFDNUcsWUFBVixDQUF1QjlkLFNBQXZCO0VBQ0Ewa0IsU0FBUyxDQUFDa0csZ0JBQVYsQ0FBMkIsV0FBM0I7RUFFQWxHLFNBQVMsQ0FBQ21HLGdCQUFWLENBQTJCLElBQTNCLEVBQWlDNWtCLGlCQUFqQzs7RUFFQSxTQUFTK2UsWUFBVCxDQUFzQmhjLFFBQXRCLEVBQWdDaWQsYUFBaEMsRUFBK0M7RUFDM0MsTUFBSSxDQUFDQSxhQUFMLEVBQW9CO0VBQ2hCO0VBQ0g7O0VBQ0QsTUFBTTdTLEtBQUssR0FBRy9RLE1BQU0sQ0FBQ0MsSUFBUCxDQUFZMEcsUUFBWixDQUFkO0VBQ0EsTUFBTThoQixlQUFlLEdBQUd6b0IsTUFBTSxDQUFDQyxJQUFQLENBQVkyakIsYUFBYSxDQUFDbkUsTUFBZCxDQUFxQjNTLFVBQWpDLENBQXhCO0VBRUEsTUFBTTRiLFNBQVMsR0FBR3RnQyxjQUFjLENBQUMyb0IsS0FBRCxFQUFRMFgsZUFBUixDQUFoQzs7RUFDQSxNQUFJQyxTQUFTLENBQUNuakMsTUFBVixHQUFtQndyQixLQUFLLENBQUN4ckIsTUFBN0IsRUFBcUM7RUFDakMsVUFBTSxJQUFJK0ksS0FBSixDQUFVLDZEQUFWLENBQU47RUFDSDtFQUNKOztFQUVELFNBQVM2MEIsY0FBVCxHQUEwQjtFQUN0QixNQUFNcmMsTUFBTSxHQUFHO0VBQ1h5SCxJQUFBQSxpQkFBaUIsRUFBRTtFQURSLEdBQWY7RUFHQSxNQUFNL1UsUUFBUSxHQUFHLElBQUl1TSxXQUFRLENBQUM0aUIsYUFBYixFQUFqQjtFQUNBLFNBQU87RUFBRTdoQixJQUFBQSxNQUFNLEVBQU5BLE1BQUY7RUFBVXROLElBQUFBLFFBQVEsRUFBUkE7RUFBVixHQUFQO0VBQ0g7O0VBRUQsU0FBUzZwQixrQkFBVCxHQUE4QjtFQUMxQixNQUFNdmMsTUFBTSxHQUFHO0VBQ1h5SCxJQUFBQSxpQkFBaUIsRUFBRSxVQURSO0VBRVhqSCxJQUFBQSxpQkFBaUIsRUFBRTtFQUNmc2hCLE1BQUFBLElBQUksRUFBRTtFQUNGQyxRQUFBQSxNQUFNLEVBQUUsS0FETjtFQUVGQyxRQUFBQSxJQUFJLEVBQUU7RUFGSixPQURTO0VBS2ZDLE1BQUFBLFNBQVMsRUFBRTtFQUxJO0VBRlIsR0FBZjtFQVVBLE1BQU12dkIsUUFBUSxHQUFHLElBQUl1TSxXQUFRLENBQUNpakIsaUJBQWIsRUFBakI7RUFDQSxTQUFPO0VBQUVsaUIsSUFBQUEsTUFBTSxFQUFOQSxNQUFGO0VBQVV0TixJQUFBQSxRQUFRLEVBQVJBO0VBQVYsR0FBUDtFQUNIOztFQUVELFNBQVMrcEIsWUFBVCxHQUF3QjtFQUNwQixNQUFNemMsTUFBTSxHQUFHO0VBQ1h5SCxJQUFBQSxpQkFBaUIsRUFBRyxVQURUO0VBRVhDLElBQUFBLGVBQWUsRUFBRyxRQUZQO0VBR1h5YSxJQUFBQSxnQkFBZ0IsRUFBRyxTQUhSO0VBSVhDLElBQUFBLGNBQWMsRUFBRyxTQUpOO0VBS1h6YSxJQUFBQSxZQUFZLEVBQUcsWUFMSjtFQU1YMGEsSUFBQUEsWUFBWSxFQUFHLFlBTko7RUFRWDdoQixJQUFBQSxpQkFBaUIsRUFBRTtFQUNmc2hCLE1BQUFBLElBQUksRUFBRTtFQUNGQyxRQUFBQSxNQUFNLEVBQUUsS0FETjtFQUVGQyxRQUFBQSxJQUFJLEVBQUU7RUFGSjtFQURTO0VBUlIsR0FBZjtFQWVBLE1BQU10dkIsUUFBUSxHQUFHLElBQUl1TSxXQUFRLENBQUNpRyxHQUFULENBQWFvZCxXQUFqQixDQUE2QjtFQUMxQyx1QkFBbUIsQ0FBQyxHQUFELEVBQU0sR0FBTixFQUFXLEdBQVgsRUFBZ0IsR0FBaEIsQ0FEdUI7RUFFMUMsc0JBQW1CLEdBRnVCO0VBRzFDLHVCQUFvQixHQUhzQjtFQUkxQyxtQkFBZSxHQUoyQjtFQUsxQyxpQkFBYSxDQUw2QjtFQU0xQywwQkFBc0IsR0FOb0I7RUFPMUMsa0JBQWM7RUFQNEIsR0FBN0IsQ0FBakI7RUFTQSxTQUFPO0VBQUV0aUIsSUFBQUEsTUFBTSxFQUFOQSxNQUFGO0VBQVV0TixJQUFBQSxRQUFRLEVBQVJBO0VBQVYsR0FBUDtFQUNIOztFQUVELFNBQVNpcUIsbUJBQVQsR0FBK0I7RUFDM0IsTUFBTTNjLE1BQU0sR0FBRztFQUNYeUgsSUFBQUEsaUJBQWlCLEVBQUcsVUFEVDtFQUVYQyxJQUFBQSxlQUFlLEVBQUcsUUFGUDtFQUdYeWEsSUFBQUEsZ0JBQWdCLEVBQUcsU0FIUjtFQUlYQyxJQUFBQSxjQUFjLEVBQUcsU0FKTjtFQUtYemEsSUFBQUEsWUFBWSxFQUFHLFlBTEo7RUFNWDBhLElBQUFBLFlBQVksRUFBRztFQU5KLEdBQWY7RUFRQSxNQUFNM3ZCLFFBQVEsR0FBRyxJQUFJdU0sV0FBUSxDQUFDaUcsR0FBVCxDQUFhcWQsa0JBQWpCLEVBQWpCO0VBQ0EsU0FBTztFQUFFdmlCLElBQUFBLE1BQU0sRUFBTkEsTUFBRjtFQUFVdE4sSUFBQUEsUUFBUSxFQUFSQTtFQUFWLEdBQVA7RUFDSDs7RUFFRCxTQUFTbXFCLGNBQVQsR0FBMEI7RUFDdEIsTUFBTTdjLE1BQU0sR0FBRztFQUNYeUgsSUFBQUEsaUJBQWlCLEVBQUcsVUFEVDtFQUVYQyxJQUFBQSxlQUFlLEVBQUcsUUFGUDtFQUdYeWEsSUFBQUEsZ0JBQWdCLEVBQUcsU0FIUjtFQUlYQyxJQUFBQSxjQUFjLEVBQUcsU0FKTjtFQUtYemEsSUFBQUEsWUFBWSxFQUFHLFlBTEo7RUFNWDBhLElBQUFBLFlBQVksRUFBRztFQU5KLEdBQWY7RUFRQSxNQUFNM3ZCLFFBQVEsR0FBRyxJQUFJdU0sV0FBUSxDQUFDaUcsR0FBVCxDQUFhc2QsYUFBakIsRUFBakI7RUFDQSxTQUFPO0VBQUV4aUIsSUFBQUEsTUFBTSxFQUFOQSxNQUFGO0VBQVV0TixJQUFBQSxRQUFRLEVBQVJBO0VBQVYsR0FBUDtFQUNIOztFQUVELFNBQVNvdUIsbUJBQVQsQ0FBNkJqeUIsSUFBN0IsRUFBbUM7RUFDL0IsTUFBSSt4QixTQUFTLEdBQUcsRUFBaEI7O0VBQ0EsTUFBTTZCLE1BQU0sR0FBRyxTQUFUQSxNQUFTLENBQVVDLEdBQVYsRUFBZTtFQUMxQixRQUFNN3hCLEdBQUcsR0FBRyxFQUFaOztFQUNBLFFBQUk2eEIsR0FBSixFQUFTO0VBQ0wsV0FBSyxJQUFJamlDLENBQUMsR0FBRyxDQUFiLEVBQWdCQSxDQUFDLEdBQUdpaUMsR0FBRyxDQUFDamtDLE1BQXhCLEVBQWdDZ0MsQ0FBQyxFQUFqQyxFQUFxQztFQUNqQyxZQUFNa0YsQ0FBQyxHQUFHKzhCLEdBQUcsQ0FBQ2ppQyxDQUFELENBQWI7O0VBQ0EsWUFBSWtGLENBQUMsSUFBSSxPQUFPQSxDQUFDLENBQUNrTCxHQUFULEtBQWlCLFFBQTFCLEVBQW9DO0VBQ2hDQSxVQUFBQSxHQUFHLENBQUNuUSxJQUFKLENBQVNpRixDQUFDLENBQUNrTCxHQUFYO0VBQ0g7RUFDSjtFQUNKOztFQUNELFdBQU9BLEdBQVA7RUFDSCxHQVhEOztFQVlBK3ZCLEVBQUFBLFNBQVMsR0FBR0EsU0FBUyxDQUFDcm9CLE1BQVYsQ0FBaUJrcUIsTUFBTSxDQUFDNXpCLElBQUksQ0FBQ3lCLE9BQU4sQ0FBdkIsQ0FBWjtFQUNBc3dCLEVBQUFBLFNBQVMsR0FBR0EsU0FBUyxDQUFDcm9CLE1BQVYsQ0FBaUJrcUIsTUFBTSxDQUFDNXpCLElBQUksQ0FBQ3FCLE1BQU4sQ0FBdkIsQ0FBWjtFQUNBLFNBQU8wd0IsU0FBUDtFQUNIOztFQUVELFNBQVNTLFVBQVQsQ0FBb0I1aUIsSUFBcEIsRUFBMEJra0IsR0FBMUIsRUFBK0I7RUFDM0IsU0FBTzFqQixXQUFRLENBQUNpRyxHQUFULENBQWEwZCxTQUFiLENBQXVCQyxhQUF2QixDQUFxQ3BrQixJQUFyQyxFQUEyQztFQUM5Q3FrQixJQUFBQSxVQUFVLEVBQUdILEdBRGlDO0VBRTlDSSxJQUFBQSxXQUFXLEVBQUVsbUIscUJBRmlDO0VBRzlDbW1CLElBQUFBLGlCQUFpQixFQUFFO0VBSDJCLEdBQTNDLENBQVA7RUFLSDs7Ozs7Ozs7Ozs7Ozs7Ozs7In0=
