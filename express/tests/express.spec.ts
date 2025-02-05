const APP_HOME = 'http://127.0.0.1:3000/'
const MOCKIN = 'http://127.0.0.1:3333/'
const APP_API = APP_HOME + 'api/hellocoop'

import { test, expect } from '@playwright/test';
import config from '../app/hello.config';

const loggedOut = { isLoggedIn: false }
const loggedIn = {
    isLoggedIn: true,
    sub: "00000000-0000-0000-0000-00000000",
    name: "John Smith",
    email: "john.smith@example.com",
    picture: "https://pictures.hello.coop/mock/portrait-of-john-smith.jpeg",
    email_verified: true
}
const usrDanBrown = {
    isLoggedIn: true,
    sub: "sub_wdfp66OC0Me43YW9q6sisnP6_h2q",
    name: 'Dan Brown',
    email: 'dan.brown@example.net',
    picture: 'https://pictures.hello.coop/mock/john-smith-facebook.jpeg',
    email_verified: true
}
const usrLewisCarroll = {
    isLoggedIn: true,
    sub: "sub_PrHrJvaaszcdyltTt52v3UcH_dbf",
    name: 'Lewis Carroll',
    picture: "https://pictures.hello.coop/mock/john-smith-yahoo.jpeg",
    email: "lewis.carroll@example.org",
    email_verified: true
}

/* 
* used for debugging
*
const trace = (page) => {
    page.on('request', async request => {
        console.log('Request:', request.method(), request.url());
        console.log('\theaders:', request.headers());
      });
      
    page.on('response', async response => {
        console.log('Response:', response.status(), response.url());
        console.log('\tresponse headers:', response.headers());
    });
    
    page.on('requestfailed', request => {
        console.log('Request failed:', request.method(), request.url(), request?.failure()?.errorText);
        console.log('\theaders:', request.headers());
    });
}
*/

test.describe(`Testing ${APP_HOME}`, () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(APP_API + '?op=logout')
    })
    test('logged out', async ({ page }) => {
        await page.goto(APP_HOME);
        const body = await page.textContent('body');
        try {
            const json = JSON.parse(body as string);
            delete json.iat
            expect(json).toEqual(loggedOut)
        }
        catch (e) {
            expect(e).toBeNull()
        }
    })
    test('logged in', async ({ page }) => {
        await page.goto(APP_API + '?op=login')
        const body = await page.textContent('body');
        try {
            const json = JSON.parse(body as string);
            delete json.iat
            expect(json).toEqual(loggedIn)
        }
        catch (e) {
            expect(e).toBeNull()
        }
    })
    test('auth', async ({ page }) => {
        // log in first
        await page.goto(APP_API + '?op=login')

        // check auth
        await page.goto(APP_API + '?op=auth')
        const body = await page.textContent('body');
        try {
            const json = JSON.parse(body as string);
            delete json.iat
            expect(json).toEqual(loggedIn)
        }
        catch (e) {
            expect(e).toBeNull()
        }
    })
    test('IdP initiated login w/ GET login_hint', async ({ page }) => {
        const data = new URLSearchParams({
            op: 'login',
            login_hint: "dan.brown@example.net"
        });
        await page.goto(APP_API + '?' + data.toString())
        const body = await page.textContent('body')
        expect(body).toBeDefined
        const json = JSON.parse(body as string);
        expect(json).toBeDefined
        delete json.iat
        expect(json).toEqual(usrDanBrown)
    })
    test('IdP initiated login w/ POST login_hint', async ({ page }) => {
        const data = new URLSearchParams({
            op: 'login',
            login_hint: "dan.brown@example.net"
        });
        await page.goto(APP_HOME + 'post-test?' + data.toString());
        const body = await page.textContent('body')
        expect(body).toBeDefined
        const json = JSON.parse(body as string);
        expect(json).toBeDefined
        delete json.iat
        expect(json).toEqual(usrDanBrown)
    })
    test('IdP initiated login w/ GET login_hint & iss', async ({ page }) => {
        const data = new URLSearchParams({
            op: 'login',
            login_hint: "dan.brown@example.net",
            iss: 'https://issuer.hello.coop'
        });
        await page.goto(APP_API + '?' + data.toString())
        const body = await page.textContent('body')
        expect(body).toBeDefined
        const json = JSON.parse(body as string);
        expect(json).toBeDefined
        delete json.iat
        expect(json).toEqual(usrDanBrown)
    }) 
    test('IdP initiated login w/ POST login_hint & iss', async ({ page }) => {
        const data = new URLSearchParams({
            op: 'login',
            login_hint: "dan.brown@example.net",
            iss: 'https://issuer.hello.coop'
        });
        await page.goto(APP_HOME + 'post-test?' + data.toString());
        const body = await page.textContent('body')
        expect(body).toBeDefined
        const json = JSON.parse(body as string);
        expect(json).toBeDefined
        delete json.iat
        expect(json).toEqual(usrDanBrown)
    })
    test('IdP initiated login w/ GET login_hint & domain_hint', async ({ page }) => {
        const data = new URLSearchParams({
            op: 'login',
            login_hint: "dan.brown@example.net",
            domain_hint: 'example.net'
        });
        await page.goto(APP_API + '?' + data.toString())
        const body = await page.textContent('body')
        expect(body).toBeDefined
        const json = JSON.parse(body as string);
        expect(json).toBeDefined
        delete json.iat
        expect(json).toEqual(usrDanBrown)
    })
    test('domain_hint', async ({ page }) => {
        const data = new URLSearchParams({
            op: 'login',
            domain_hint: "example.org",
        });
        await page.goto(APP_API + '?' + data.toString())
        const body = await page.textContent('body')
        expect(body).toBeDefined
        const json = JSON.parse(body as string);
        expect(json).toBeDefined
        delete json.iat
        expect(json).toEqual(usrLewisCarroll)
    })
    test('IdP initiated login w/ GET domain_hint', async ({ page }) => {
        const data = new URLSearchParams({
            domain_hint: "example.org",
        });
        await page.goto(APP_API + '?' + data.toString())
        const body = await page.textContent('body')
        expect(body).toBeDefined
        const json = JSON.parse(body as string);
        expect(json).toBeDefined
        delete json.iat
        expect(json).toEqual(usrLewisCarroll)
    })
    test('IdP initiated login w/ POST domain_hint', async ({ page }) => {
        const data = new URLSearchParams({
            op: 'login',
            domain_hint: "example.org"
        });
        await page.goto(APP_HOME + 'post-test?' + data.toString());
        const body = await page.textContent('body')
        expect(body).toBeDefined
        const json = JSON.parse(body as string);
        expect(json).toBeDefined
        delete json.iat
        expect(json).toEqual(usrLewisCarroll)
    })
    test('IdP initiated login w/ GET domain_hint & iss', async ({ page }) => {
        const data = new URLSearchParams({
            op: 'login',
            domain_hint: "example.org",
            iss: 'https://issuer.hello.coop'
        });
        await page.goto(APP_API + '?' + data.toString())
        const body = await page.textContent('body')
        expect(body).toBeDefined
        const json = JSON.parse(body as string);
        expect(json).toBeDefined
        delete json.iat
        expect(json).toEqual(usrLewisCarroll)
    })
    test('IdP initiated login w/ POST domain_hint & iss', async ({ page }) => {
        const data = new URLSearchParams({
            op: 'login',
            domain_hint: "example.org",
            iss: 'https://issuer.hello.coop'
        });
        await page.goto(APP_HOME + 'post-test?' + data.toString());
        const body = await page.textContent('body')
        expect(body).toBeDefined
        const json = JSON.parse(body as string);
        expect(json).toBeDefined
        delete json.iat
        expect(json).toEqual(usrLewisCarroll)
    })
    test('invite', async ({ page }) => {
        // log in first
        await page.goto(APP_API + '?op=login')
        
        // invite
        const appName = 'Test'
        const data = new URLSearchParams({
            op: 'invite',
            app_name: appName
        })
        await page.goto(APP_API + '?' + data.toString())
        const url = page.url()
        const inviteReqUrl = new URL(url)
        const inviteReqUrlParams = new URLSearchParams(inviteReqUrl.search)
        const inviter = inviteReqUrlParams.get('inviter')
        expect(inviter).toEqual(loggedIn.sub)
        const client_id = inviteReqUrlParams.get('client_id')
        expect(client_id).toEqual(config.client_id)
        const initiate_login_uri = inviteReqUrlParams.get('initiate_login_uri')
        expect(initiate_login_uri).toEqual(APP_API)
        const app_name = inviteReqUrlParams.get('app_name')
        expect(app_name).toEqual(appName)
        const prompt = inviteReqUrlParams.get('prompt')
        expect(prompt).toEqual(`${loggedIn.name} has invited you to join ${appName}`)
        const return_uri = inviteReqUrlParams.get('return_uri')
        expect(return_uri).toEqual(APP_HOME)
    })
    test('should get metadata', async ({ page }) => {
        const commandTokenRes = await page.request.get(MOCKIN + 'command/mock?client_id=' + config.client_id)
        const { command_token } = await commandTokenRes.json()
        expect(command_token).toBeDefined
        const data = new URLSearchParams({ command_token });
        await page.goto(APP_HOME + 'post-test?' + data.toString());
        const body = await page.textContent('body')
        expect(body).toBeDefined
        const metadata = JSON.parse(body as string);
        expect(metadata).toBeDefined
        expect(metadata.context).toBeDefined();
        // expect(metadata.context.package_name).toBe();
        expect(metadata.context.package_version).toBeDefined();
        // expect(metadata.context.package_version).toBe('0.0.1');
        expect(metadata.context.iss).toBeDefined();
        expect(metadata.commands_uri).toBeDefined();
        expect(metadata.commands_supported).toBeDefined();
        expect(metadata.commands_supported).toEqual(['metadata']);
        expect(metadata.commands_ttl).toBeDefined();
        expect(metadata.commands_ttl).toEqual(0);
        expect(metadata.client_id).toBeDefined();
        expect(metadata.client_id).toEqual(config.client_id);
    })
});