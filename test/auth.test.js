const chai = require('chai');
const expect = chai.expect;
const request = require('supertest');
const app = require('../src/app');

describe('Auth Routes', function () {
    it('GET /login deve restituire 200', function (done) {
        request(app)
            .get('/login')
            .expect(200, done);
    });

    it('POST /login con dati mancanti deve restituire errore di validazione', function (done) {
        request(app)
            .post('/login')
            .send({ username: '', password: '' })
            .expect(302) // redirect per errore di validazione
            .end(function (err, res) {
                if (err) return done(err);
                expect(res.headers['location']).to.exist;
                done();
            });
    });
});
