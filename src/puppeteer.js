let AutomatonEngine = require('@open-automaton/automaton-engine/src/automaton-engine.js');
const Emitter = require('extended-emitter');

const puppeteer = require('puppeteer');

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
    asynk.eachOfLimit(browsers, browsers.length, function(browser, index, done){
        var attempts = 0;
        var maxAttempts = 2;
        var interval = 1000;
        var ensureShutdown = function(cb){
            if(browser && browser.process() != null){
                if(attempts > maxAttempts){
                    setTimeout(function(){
                        process.exit();
                    }, 100);
                    throw new Error('Cannot shut browser down');
                }
                browser.process().kill('SIGINT');
                attempts++;
                setTimeout(function(){
                    ensureShutdown(cb);
                }, interval);
            }else cb();
        }
        browser.pages().then(function(pages){
            asynk.eachOfLimit(pages, pages.length, function(page, i, pageDone){
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
    puppeteer.launch({
        args : options.args,
        headless: false
    }).then((instance)=>{
        this.instance = instance;
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
            console.log('START', url);
            this.page.goto(
                url,
                //load, networkidle0
                { waitUntil: 'load' }
            ).then((result)=>{
                this.page.evaluate(()=> document.documentElement.outerHTML).then((html)=>{
                    console.log('!!!!', html);
                    cb(null, html, this.page);
                }).catch((ex)=>{
                    cb(ex);
                });
            }).catch((err)=>{
                console.log('ERROR2', err);
                cb(err)
            });
        }else{
            //handle form navigation
        }
    }else{
        console.log('BINNED');
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
        cleanupBrowsers([this.browser], cb);
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
