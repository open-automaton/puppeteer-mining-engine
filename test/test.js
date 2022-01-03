const should = require('chai').should();
const path = require('path');
const Automaton = require('@open-automaton/automaton');
const fs = require('fs');
const express = require('express');
const bodyParser = require('body-parser');
const AutomatonPuppeteerEngine = require('../src/puppeteer.js');
const canonical = require(
    '@open-automaton/automaton-engine/test/canonical-tests.js'
)(Automaton, should);

let puppeteerEngine = new AutomatonPuppeteerEngine();

describe('strip-mine', function(){
    describe('automaton', function(){
        it('loads a canonical definition', function(done){
            canonical.loadDefinition(puppeteerEngine, done);
        });

        it('scrapes a static page', function(done){
            canonical.staticScrape(puppeteerEngine, done);
        });

        it('scrapes a form', function(done){
            canonical.formScrape(puppeteerEngine, done);
        });
    });
});
