! function(root) {
    // utils
    function isType(type){
        return (v) => {
            return Object.prototype.toString.call(v) === `[object ${type}]`
        }
    }
    const isArray = isType('Array')
    const isString = isType('String')
    const isFunction = isType('Function')
    const log = console.log.bind(console)
    const asynCall = (cb) => {
        setTimeout(()=>{
            cb()
        }, 0)
    }
    const inArray = (e, list) => {
        return ~list.indexOf(e)
    }
    const numbersOfChar = (c, str) => {
        var n = 0
        for (var i = 0; i < str.length; i++) {
            n += c === str[i] ? 1 : 0
        }
        return n
    }

    // global data
    var config = {}
    const $head = document.getElementsByTagName('head')[0]
    const cache = function(){
        // absolutePath -> module
        var dict = {}
        return {
            get: (k)=>{
                return dict[k]
            },
            set: (k, v) => {
                if (k in dict){
                    return
                }
                dict[k] = v
            }
        }
    }()

    // modules
    function Module(path) {
        this.path = path
        this.deps = []
        this.factory = null
        this.status = 'pending'
        this.listeners = {}
        this.setup()
    }
    Module.prototype = {
        construct: Module,
        setup: function() {
            cache.set(this.path, this)
            this.requestScript()
        },
        getExports: function(){
            if (this.status !== 'completed'){
                return new Error('module not load completed yet.')
            }
            if (this._exports){
                return this._exports
            }
            if (!isFunction(this.factory)){
                this._exports = this.factory
            }
            else {
                if (!this.deps){
                    this._exports = this.factory.apply(root)
                }
                else {
                    var deps_exports = this.deps.map((dep) => {
                        var p = document.currentScript.src
                        var m = cache.get(resolveRelativePath(dep, p))
                        if (m){
                            return m.getExports()
                        }
                    })
                    this._exports = this.factory.apply(root, deps_exports)
                }
            }
            return this._exports
        },
        requestScript: function(){
            var self = this
            var node = document.createElement('script')
            node.type = 'text/javascript'
            node.async = 'async'
            node.src = this.path
            node.addEventListener('error', _onError, false)
            $head.appendChild(node)
            this.setStatus('loading')
            function _onError(err) {
                node.removeEventListener('error', _onError, false)
                $head.removeChild(node)
                self.setStatus('error', 'load script failed:' + self.path)
            }
        },
        on: function(ev, cb){
            this.listeners[ev] = this.listeners[ev] || []
            this.listeners[ev].push(cb)
            if (this.status == ev && inArray(this.status, ['completed', 'load'])){
                cb(this)
            }
            if (this.status == ev && ev == 'error') {
                cb(this, this.error)
            }
        },
        _fire: function(ev, ...args){
            (this.listeners[ev] || []).forEach((listener)=>{
                listener.apply(this, args)
            })
        },
        setStatus: function(status, errinfo){
            if (this.status != status){
                this.status = status
                var d = {
                    'loading': () => {this._fire('loading')},
                    'completed': () => {this._fire('completed')},
                    'error': (errinfo) => {this._fire('error', errinfo)},
                }
                var handler = d[status] || function(){}
                handler.call(this, errinfo)
            }
        }
    }

    // partial

    function resolvePath(p){
        /*  resolve(p) -> url or absolutePath, with .js suffix

            relativePath: 'xx', './xx'
            absolutePath: '/xx'
            url: 'http[s]://xx'
        */
        p = config.paths[p] || p
        if (isRelativePath(p)){
            p = p.replace('./', '')
            p = [root.location.origin, config.base , p].join('')
        }
        if (p.slice(-3) !== '.js'){
            p += '.js'
        }
        return p

        function isURL(p){
            return p.indexOf('http') === 0
        }
        function isAbsolutePath(p){
            return p.indexOf('/') === 0
        }
        function isRelativePath(p){
            return !isURL(p) && !isAbsolutePath(p)
        }
    }

    function resolveRelativePath(p, fullPath){
        var protocolString = fullPath.split('//')[0]
        var pathString = fullPath.split('//')[1]
        var pathArray = pathString.split('/')
        var level = calcLevel(p)
        var dirArray = pathArray.slice(0, pathArray.length-level)
        var filenameArray = p.split('/')
        filenameArray = filenameArray.slice(level, filenameArray.length)
        var pathStringCalc = dirArray.concat(filenameArray).join('/')
        var pathCalc = [protocolString, pathStringCalc].join('//')
        if (pathCalc.slice(-3) !== '.js'){
            pathCalc += '.js'
        }
        return pathCalc

        function calcLevel(p){
            // './' -> 1,  '../' -> 2, '../../' -> 3
            var p = p.split('/')
            if (p[0] == '.'){
                return 1
            }
            else if (p[0] == '..') {
                var stop = false
                p.split('/').reduce((sum, current) => {
                    if (stop){
                        return sum
                    }
                    else{
                        if (current == '..'){
                            sum += 1
                        }
                        else {
                            stop = true
                        }
                    }
                    return sum
                }, 1)
            }
        }
    }

    function loadModule(path){
        return new Promise((resolve, reject)=>{
            /* @recode
            if in cache && m.status == 'completed' -> addListener & fire
            else just addListener
            */
            var m = cache.get(path) || new Module(path)
            m.on('completed', () => {
                resolve(m.getExports())
            })
            m.on('error', reject)
        })
    }

    // main
    function require(deps, cb){
        if (cb === undefined){
            cb = deps
            deps = []
        }
        deps = isArray(deps)? deps : [deps]
        cb = isFunction(cb)? cb : function(){}

        Promise.all(deps.map((p) => {
            return loadModule(resolvePath(p))
        })).then( (list) => {
            cb.apply(root, list)
        }).catch( (reason) => {
            throw new Error(reason)
        })
    }

    function define(name, deps, factory){
        var {name, deps, factory} = argsNormalized(name, deps, factory)
        var p = document.currentScript.src
        var m = cache.get(p) || new Module(p)
        m.deps = deps
        m.factory = factory

        if (deps){
            Promise.all(deps.map((dep) => {
                return loadModule(resolveRelativePath(dep, p))
            }))
            .then(() => {
                m.setStatus('completed')
            })
            .catch( (reason) => {
                m.setStatus('error', reason)
            })
        }
        else {
            m.setStatus('completed')
        }

        function argsNormalized(name, deps, factory){
            if (deps == undefined && factory == undefined){
                factory = name
                deps = null
                name = null
            }
            else if (factory == undefined){
                factory = deps
                if ( Array.isArray(name) ){
                    deps = name
                    name = null
                }
                else {
                    deps = null
                    name = name
                }
            }
            return { name, deps, factory }
        }
    }

    function configMerge(options){
        var defaults = {
            base: '/',
            paths: {},
        }
        config = Object.assign({}, defaults, options)
        config.base += config.base.slice(-1) === '/' ? '' : '/'
        return config
    }

    root.require = require
    root.define = define
    require.config = configMerge
    define.amd = true
}(window)
