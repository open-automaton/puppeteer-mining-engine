const should = require('chai').should();
const path = require('path');
const Automaton = require('@open-automaton/automaton');
const fs = require('fs');
const express = require('express');
const bodyParser = require('body-parser');
const AutomatonPuppeteerEngine = require('../src/puppeteer.js');

describe('strip-mine', function(){
    describe('automaton', function(){
        it.skip('loads a canonical definition', function(done){
            fs.readFile(
                path.join(
                    __dirname,
                    './data/bots/whitepages-peoplesearch.xml'
                ), function(err, body){
                    should.not.exist(err);
                    let scraper = new Automaton(body.toString());
                    scraper.root.children.length.should.equal(5);
                    done();
                }
            );
        });

        it.skip('scrapes a static page', function(done){
            let app = express();
            app.get('/', (req, res)=>{
                res.setHeader('content-type', 'text/html')
                res.send(fs.readFileSync(path.join(
                    __dirname, './data/table-scrape.html'
                )));
            });
            let server = app.listen(8080, (err)=>{
                should.not.exist(err);
                fs.readFile(path.join(__dirname, './data/table-scrape-bot.xml'), function(err, body){
                    should.not.exist(err);
                    let scraper = new Automaton(
                        body.toString(),
                        new AutomatonPuppeteerEngine()
                    );
                    scraper.run((err, data)=>{
                        should.not.exist(err);
                        should.exist(data);
                        should.exist(data.matches);
                        data.matches.length.should.equal(3);

                        should.exist(data.matches[0]);
                        should.exist(data.matches[0].name);
                        data.matches[0].name.should.equal('1');
                        should.exist(data.matches[0].age);
                        data.matches[0].age.should.equal('something');
                        should.exist(data.matches[0].location);
                        data.matches[0].location.should.equal('23.4');

                        should.exist(data.matches[1]);
                        should.exist(data.matches[1].name);
                        data.matches[1].name.should.equal('7');
                        should.exist(data.matches[1].age);
                        data.matches[1].age.should.equal('another thing');
                        should.exist(data.matches[1].location);
                        data.matches[1].location.should.equal('23.45');

                        should.exist(data.matches[2]);
                        should.exist(data.matches[2].name);
                        data.matches[2].name.should.equal('9');
                        should.exist(data.matches[2].age);
                        data.matches[2].age.should.equal('nothing');
                        should.exist(data.matches[2].location);
                        data.matches[2].location.should.equal('7.38');

                        server.close();
                        done();
                    });
                });
            });
        });

        it('scrapes a form', function(done){
            let app = express();
            app.use(bodyParser.urlencoded({extended:false}));
            app.get('/', (req, res)=>{
                res.setHeader('content-type', 'text/html')
                res.send(fs.readFileSync(path.join(
                    __dirname, './data/form-search.html'
                )));
            });
            app.post('/submit', (req, res)=>{
                res.setHeader('content-type', 'text/html')
                res.send(fs.readFileSync(path.join(
                    __dirname, './data/form-search-response.html'
                )).toString()
                    .replace( /\[\[name\]\]/g, req.body.name)
                    .replace( /\[\[title\]\]/g, req.body.title)
                );
            });
            let server = app.listen(8080, (err)=>{
                should.not.exist(err);
                fs.readFile(
                    path.join(__dirname, './data/form-search-bot.xml'),
                    (err, body)=>{
                        should.not.exist(err);
                        let scraper = new Automaton({
                            body: body.toString(),
                            environment : {
                                incomingName : 'foo',
                                incomingTitle: 'bar'
                            }
                        }, new AutomatonPuppeteerEngine());
                        scraper.run((err, data)=>{
                            console.log(data)
                            data.matches.length.should.equal(2);

                            should.exist(data.matches[0]);
                            should.exist(data.matches[0].name);
                            data.matches[0].name.should.equal('foo-augmented');
                            should.exist(data.matches[0].title);
                            data.matches[0].title.should.equal('bar-augmented');

                            should.exist(data.matches[1]);
                            should.exist(data.matches[1].name);
                            data.matches[1].name.should.equal('foo-segmented');
                            should.exist(data.matches[1].title);
                            data.matches[1].title.should.equal('bar-segmented');

                            server.close();
                            done();
                        });
                    }
                );
            });
        });
    });
});
