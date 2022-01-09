const AutomatonEngine = require('@open-automaton/automaton-engine/src/automaton-engine.js');
const Emitter = require('extended-emitter');
const Arrays = require('async-arrays');

//const puppeteer = require('puppeteer');
const puppeteer = require('puppeteer-extra')

// add stealth plugin and use defaults (all evasion techniques)
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
puppeteer.use(StealthPlugin())

const puppeteerArgs = [
    '--enable-features=NetworkService',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-web-security',
    '--disable-features=IsolateOrigins,site-per-process',
    '--shm-size=3gb', // this solves the issue
    //'--headless',
    '--disable-gpu',
    '--window-size=1920x1080'
]

//const cheerio = require("cheerio");
//const request = require("postman-request");
const DOM = require("@open-automaton/automaton-engine/src/dom-tool.js").DOM;

var browserInstances = {};
var getBrowser = function(options, browsers, index, name, cb){
    var browser = browsers[index % browsers.length];
    if(browserInstances[browser.name]) return cb(null, browser, browserInstances[browser.name]);
    browser.initialize(options, function(err, instance){
        browserInstances[browser.name] = instance;
        cb(err, browser, instance);
    })
}

const cleanupBrowsers = function(browsers, cb){
    Arrays.forEachEmission(browsers, function(browser, index, done){
        var attempts = 0;
        var maxAttempts = 3;
        var interval = 2000;
        var ensureShutdown = function(cb){
            if(browser && browser.process() != null){
                if(attempts > maxAttempts){
                    //throw new Error('Cannot shut browser down');
                    return cb(new Error('Cannot shut browser down'));
                }
                browser.process().kill('SIGINT');
                attempts++;
                setTimeout(function(){
                    ensureShutdown(cb);
                }, interval);
            }else cb();
        }
        browser.pages().then(function(pages){
            Arrays.forEachEmission(pages, function(page, i, pageDone){
                page.close().then(function(){
                    pageDone();
                });
            }, function(){
                browser.close().then(function(){
                    ensureShutdown(done)
                }).catch(function(ex){
                    console.log('CERR', ex);
                })
            })
        }).catch(function(err){
            cb(err);
        });
    }, function(){
        cb();
    });
}

let Automaton = {};

let PuppeteerBrowser = function(opts){
    let options = opts || {};
    //TODO: support parallelism
    if(options.args) options.args = options.args.concat(puppeteerArgs);
    else options.args = puppeteerArgs;
    this.jobs = [];
    this.browsers = [];
    puppeteer.launch({
        //args : options.args,
        headless: !options.debug
    }).then((instance)=>{
        this.instance = instance;
        this.browsers.push(instance)
        instance.newPage().then((page)=>{
            this.page = page;
            let jobs = this.jobs;
            this.jobs = false;
            jobs.forEach((job) => job());
        }).catch((ex)=>{
            console.log('ERROR', ex);
            cb(ex);
        });
    }).catch((ex)=>{
        throw new Error('Puppeteer failed to launch');
    })
}

PuppeteerBrowser.prototype.xpath = function(selector, cb){
    if(this.instance){
        this.page.evaluate(() => {
            const selected = document
                .evaluate(
                    selector,
                    document,
                    null,
                    XPathResult.FIRST_ORDERED_NODE_TYPE,
                    null
                )
                .singleNodeValue;

            return selected.textContent;
        });
    }else{
        this.jobs.push(()=>{
            this.xpath(selector, cb);
        })
    }
};

PuppeteerBrowser.prototype.select = function(selector, cb){
    if(this.instance){

    }else{
        this.jobs.push(()=>{
            this.xpath(selector, cb);
        })
    }
};

PuppeteerBrowser.prototype.navigateTo = function(opts, cb){
    if(this.page){
        let url = opts.uri || opts.url;
        if(url){
            if(opts.form && opts.data && opts.submit){
                Arrays.forEachEmission(Object.keys(opts.data), (key, i, done)=>{
                    this.page.type(`*[name="${key}"]`, opts.data[key]).then(()=>{
                        done();
                    }).catch((ex)=>{
                        throw ex;
                    });
                }, ()=>{
                    Promise.all([
                       this.page.waitForNavigation(),
                       this.page.click(`input[name="${opts.submit}"]`)
                    ]).then(()=>{
                        this.page.evaluate(
                            ()=> document.documentElement.outerHTML
                        ).then((html)=>{
                            cb(null, html, this.page);
                        }).catch((ex4)=>{
                            cb(ex4);
                        });
                    }).catch((ex3)=>{
                        throw ex3;
                    });
                });
            }else{
                this.page.goto(
                    url,
                    //load, networkidle0
                    { waitUntil: 'load' }
                ).then((result)=>{
                    this.page.evaluate(
                        ()=> document.documentElement.outerHTML
                    ).then((html)=>{
                        cb(null, html, this.page);
                    }).catch((ex)=>{
                        cb(ex);
                    });
                }).catch((err)=>{
                    console.log('ERROR2', err);
                    cb(err)
                });
            }
        }else{
            //handle form navigation
        }
    }else{
        this.jobs.push(()=>{
            this.navigateTo(opts, cb);
        })
    }
}

Automaton.PuppeteerEngine = AutomatonEngine.extend({
    fetch : function(opts, cb){
        this.browser.navigateTo(opts, (err, result, page)=>{
            cb(result);
        });
    },
    cleanup : function(cb){
        let cleanableBrowsers = [];
        if(this.browser && this.browser.instance) cleanableBrowsers.push(
            this.browser.instance
        );
        cleanupBrowsers(cleanableBrowsers, cb);
    },
    xpathText : function(opts, cb){
        this.browser.xpath(opts, (err, result)=>{
            cb(null, result);
        });
    },
    regexText : function(opts, cb){
        this.browser.xpath(opts, (err, result)=>{
            cb(null, result);
        });
    },
    selectText : function(opts, cb){
        this.browser.xpath(opts, (err, result)=>{
            cb(null, result);
        });
    },
}, function(opts){
    this.browser = new PuppeteerBrowser();
    this.options = opts || {};
    this.children = [];
    (new Emitter).onto(this);
});

module.exports = Automaton.PuppeteerEngine;
