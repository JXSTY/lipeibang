(function () {
    //IE 8
    if (!Object.create) {
        Object.create = function (proto, props) {
            if (typeof props !== "undefined") {
                throw "The multiple-argument version of Object.create is not provided by this browser and cannot be shimmed.";
            }
            function ctor() {
            }

            ctor.prototype = proto;
            return new ctor();
        };
    }
    var pkg = function () {
        return {};
    };

    var Type = function () {
    };

    var RootType;

    var label = function (inName, inTarget) {
        var handler = window;
        var last;
        if (inName) {
            var names = inName.split('.');
            last = names.pop();
            $.each(names, function (inIndex, inName) {
                var temp = handler[inName];
                if (temp) {
                    handler = temp;
                    return;
                }
                handler = handler[inName] = new pkg();
            });
        }
        if (last) {
            handler[last] = inTarget;
        }
        return inTarget;
    };

    var get = function(inName,inTarget){
        var target = inTarget || window;
        var result = target;
        if(inName){
            var names = inName.split('.');
            $.each(names,function(inIndex,inName){
                result = target = target[inName];
                if(!result){
                    return false;
                }
            });
        }
        return result;
    };


    var define = function (inDef) {
        var name = inDef.name;
        var view = inDef.view;
        var parent = inDef.parent;
        if (parent) {
            if (typeof parent === 'string') {
                parent = get(parent);
            }
        } else {
            if (view) {
                parent = nb.View;
            }
        }

        var type = extend(parent || RootType, inDef);
        if (name) {
            return label(name, type);
        } else {
            return type;
        }
    };

    var extend = function (inSuper, inDef) {
        var superPrototype = inSuper.prototype;
        var prototype = Object.create(superPrototype);

        var Type = function () {
            var init = this.init;
            if (init) {
                init.apply(this, arguments);
            }
        };

        $.each(inDef, function (inName, inProp) {
            if (inName == 'method') {
                extendMethods(prototype, inProp);
            } else {
                prototype[inName] = inProp;
            }
        });

        Type.prototype = prototype;
        return Type;
    };


    var extendMethods = function (inPrototype, inMethods) {
        var methods = inMethods || {};
        $.each(methods, function (inName, inMethod) {
            var prop = inPrototype[inName];
            if (prop !== undefined && typeof prop == "function") {
                //overwrite or override
                inPrototype[inName] = (function (superFn, fn) {
                    return function () {
                        this.parent = superFn;
                        return fn.apply(this, arguments);
                    };
                })(prop, inMethod);
            } else {
                inPrototype[inName] = inMethod;
            }
        });
    };


    RootType = extend(Type, {
        /**
         *  name:,
         *  scope:
         *  fn:function
         * @param inOpts
         */
        on: function (inOpts) {
            var eventMap = this.__eventMap;
            var name = inOpts.name;
            var scope = inOpts.scope;
            var fn = inOpts.fn;
            var array;
            if (!eventMap) {
                eventMap = this.__eventMap = {};
            }
            array = eventMap[name];
            if (!array) {
                array = eventMap[name] = [];
            }
            array.push({
                scope: scope,
                fn: fn
            });
        },
        fire: function (inName, inData) {
            var eventMap = this.__eventMap;
            var eventArray = (eventMap ? eventMap[inName] : []) || [];
            $.each(eventArray, function (inIndex, inOpts) {
                var scope = inOpts.scope;
                var fn = inOpts.fn;
                fn.call(scope, inData);
            });
        }
    });

    var nb = window.nb = {};
    nb.name = label;
    nb.define = define;
    nb.extend = extend;
})();
(function () {
    var loadImage = function (inUrl, inImgMeta) {
        var loader = function (deferred) {
            var image = new Image();
            image.onload = loaded;
            image.onerror = errored;
            image.onabort = errored;
            image.src = inUrl;
            function loaded() {
                if (inImgMeta) {
                    inImgMeta.width = this.width;
                    inImgMeta.height = this.height;
                    inImgMeta.url = inUrl;
                    inImgMeta.image = image;
                }
                unbindEvents();
                deferred.resolve(image);
            }

            function errored() {
                unbindEvents();
                deferred.reject(image);
            }

            function unbindEvents() {
                image.onload = null;
                image.onerror = null;
                image.onabort = null;
            }
        };
        return $.Deferred(loader).promise();
    };

    var loadImageList = function (inUrlList, inMetaList) {
        var deferreds = [];
        $.each(inUrlList, function (index, url) {
            var meta = null;
            if (inMetaList) {
                meta = {};
                inMetaList.push(meta);
            }
            deferreds.push(loadImage(url, meta));
        });
        return $.when.apply($, deferreds);
    };

    var imgLoader = function (in$img) {
        var loader = function (deferred) {
            in$img.ready(function () {
                deferred.resolve(in$img);
            });

            in$img.error(function () {
                deferred.reject(in$img);
            });
        };
        return $.Deferred(loader).promise();
    };

    var getUrlParameters = function () {
        var sPageURL = decodeURIComponent(window.location.search.substring(1));
        var paramsArray = sPageURL.split('&');
        var params = {};
        var keyValue;
        var i = 0, length = paramsArray.length;
        for (; i < length; i++) {
            keyValue = paramsArray[i].split('=');
            params[keyValue[0]] = keyValue[1]
        }
        return params;
    };

    var util = {
        loadImage: loadImage,
        loadImageList: loadImageList,
        imgLoader: imgLoader,
        getUrlParameters:getUrlParameters
    };
    nb.name('nb.util', util);
})();
(function () {
    var Model = nb.define({
        name: 'nb.Model',
        method: {
            init: function () {
                this.__model = {};
                this.__eventMap = {};
            },
            set: function (inName, inData, inNoBefore) {
                var model = this.__model;
                var origin = model[inName];
                var map = this.__eventMap;
                var events = map[inName];
                var eventArray = (events ? events.before : []) || [];
                var data = {
                    name: inName,
                    origin: origin,
                    data: inData
                };
                if (!inNoBefore) {
                    $.each(eventArray, function (inIndex, inOpts) {
                        var scope = inOpts.scope;
                        var fn = inOpts.fn;
                        fn.call(scope, data);
                    });
                }
                model[inName] = inData;
                eventArray = (events ? events.after : []) || [];
                $.each(eventArray, function (inIndex, inOpts) {
                    if(!inOpts){
                        return;
                    }
                    var scope = inOpts.scope;
                    var fn = inOpts.fn;
                    var once = inOpts.once;
                    fn.call(scope, data);
                    if(once){
                        delete eventArray[inIndex];
                    }
                });
            },
            get: function (inName) {
                return this.__model[inName];
            },
            /**
             * {
             *  name:model name,
             *  type:before/after(default),
             *  scope:
             *  fn:function
             * }
             * @param inOpts
             */
            onChange: function (inOpts) {
                var map = this.__eventMap;
                var name = inOpts.name;
                var type = inOpts.type || 'after';
                var once = inOpts.once;
                var scope = inOpts.scope;
                var fn = inOpts.fn;
                var events = map[name];
                var typeArray;

                if (!events) {
                    events = {};
                    map[name] = events;
                }
                typeArray = events[type];
                if (!typeArray) {
                    typeArray = [];
                    events[type] = typeArray;
                }
                typeArray.push({scope: scope, fn: fn, once: once});
            }
        }
    });
})();
(function () {
    var Application = nb.define({
        method: {
            init:function(){
                this.model = new nb.Model();
            }
        }
    });
    nb.name("nb.app",new Application());
})();
/**
 * Created by 编程即菩提 on 01/01/15.
 */
(function () {
    var Template = nb.define({
        method: {
            init: function () {

            }
        }
    });
    var contentHandlerMap = {
        'string': function (inOpts) {
            var $el = inOpts.container.$();
            var tag = $el.prop('tagName').toLowerCase();
            var content = inOpts.content;
            if (tag == 'input') {
                $el.val(content);
            } else {
                $el.text(content);
            }
        },
        'object': function (inOpts) {
            var content = inOpts.content;
            var root = inOpts.root;
            var child = define(content, root);
            var name = content.$name;
            var $el = child.$();
            inOpts.container.$().append($el);
            if (name) {
                var key = '$' + name;
                var temp = root[key];
                if (temp) {
                    if ($.type(temp) != 'array') {
                        var array = [temp];
                        temp = root[key] = array;
                    }
                    temp.push(child);
                } else {
                    root[key] = child;
                }
            }
        },
        'array': function (inOpts) {
            $.each(inOpts.content, function (inIndex, inContent) {
                content({
                    container: inOpts.container,
                    root: inOpts.root,
                    content: inContent
                });
            });
        },
        'undefined': function () {
            //do nothing
        }
    };
    var content = function (inOpts) {
        var content = inOpts.content;
        var type = $.type(content);
        contentHandlerMap[type](inOpts);
    };
    var attrHandlerMap = {
        'class': function (inObj, inJson, inRoot) {
            var cls = inJson.class;
            if (cls) {
                inObj.$().addClass(cls);
            }
        },
        'style': function (inObj, inJson, inRoot) {
            var style = inJson.style;
            if (style) {
                inObj.$().css(style);
            }
        },
        'content': function (inObj, inJson, inRoot) {
            content({
                container: inObj,
                root: inRoot || inObj,
                content: inJson.content
            });
        }
    };
    var find = function (inName, inType) {
        var obj;
        if (inName !== undefined) {
            obj = this['$' + inName];
        } else {
            obj = this;
        }
        if (!inType) {
            if ($.isArray(obj)) {
                var list = [];
                $.each(obj, function (inIndex, inObj) {
                    list.push(inObj.$root || inObj.__viewInstance.$root);
                });
                obj = list;
            } else {
                obj = obj.$root || obj.__viewInstance.$root;
            }
        }
        return obj;
    };
    var define = function (inJson, inRoot) {
        var obj;
        if (inJson.$type) {
            obj = define4Type(inJson, inRoot);
        } else if (inJson.$template) {
            obj = define4Template(inJson, inRoot);
        } else {
            obj = define4JSON(inJson, inRoot);
        }
        return obj;
    };
    var define4Template = function (inJson, inRoot) {

    };
    var define4Type = function (inJson, inRoot) {
        var Type = inJson.$type;
        var obj = new Type();
        return obj;
    };
    var define4JSON = function (inJson, inRoot) {
        var tag = inJson.tag || 'div';
        var $el = $('<' + tag + '>');
        var obj = {
            $root: $el,
            $: find
        };
        $.each(inJson, function (inName, inValue) {
            var name = inName.toLowerCase();
            if (name == 'tag') {
                return true;
            }
            var fn = attrHandlerMap[inName];
            if (fn) {
                fn(obj, inJson, inRoot);
            } else {
                if (name.indexOf('$') === 0) {
                    $el.attr('data-nb-' + name.substring(1), inValue);
                } else {
                    $el.attr(name, inValue);
                }
            }
        });
        return obj;
    };
    nb.define({
        name: 'nb.View',
        method: {
            init: function () {
                var view = this.view;
                if (view) {
                    this.__viewInstance = define(view);
                }
            },
            $: function (inName, inType) {
                return this.__viewInstance.$(inName, inType);
            }
        }
    });
})();