! function(root) {
    function loadScript(path, cb) {
        const script = document.createElement('script')
        script.src = path
        script.onload = function() {
            if (!require._moduelDict[path]){
                let factory = require._factorys.shift()
                let module = typeof factory === 'function' ? factory() : factory
                require._moduelDict[path] = module
            }
            cb()
        }
        document.body.appendChild(script)
    }

    function require(paths, cb) {
        // 1. 遍历每个元素，请个N个脚本
        // 2. 所有脚本都 onload 后，执行一次cb(对应模块)
        var len = paths.length
        paths.forEach((path) => {
            loadScript(path, () => {
                len -= 1
                if (len == 0){
                    let modules = paths.map((p) => require._moduelDict[p])
                    cb.apply(null, modules)
                }
            })
        })
    }

    require._moduelDict = {}
    require._factorys = []

    function define(name, deps, factory) {
        var {name, deps, factory} = defineArgsNormalized(name, deps, factory)
        if (!name){
            require._factorys.push(factory)
        }
        else {
            

            let module = typeof factory === 'function' ? factory() : factory
            require._moduelDict[name] = module
        }
    }

    function defineArgsNormalized(name, deps, factory){
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

    function config(){

    }

    root.require = require
    root.define = define
    require.config = config
    define.amd = true
}(window)
