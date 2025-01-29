

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
        const response = await page.request.get(APP_API + '?op=auth')
        const json = await response.json()
        expect(json).toEqual(loggedOut)
    })

    test('Logged Out', async ({ page }) => {
        const response = await page.request.get(APP_HOME);
        const json = await response.json()
        expect(json).toEqual(loggedOut)
    })
    test('login', async ({ page }) => {
        // this request fails in webkit -- and cookies are not set
        // TBD - figure out why so we can test webkit
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
    test('Logged In', async ({ page }) => {
        await page.goto(APP_API + '?op=login')
        const response = await page.request.get(APP_HOME);
        const json = await response.json()
        delete json.iat
        expect(json).toEqual(loggedIn)
    })
    test('auth', async ({ page }) => {
        await page.goto(APP_API + '?op=login')
        const response = await page.request.get(APP_API + '?op=auth');
        const json = await response.json()
        delete json.iat
        expect(json).toEqual(loggedIn)
    })

    // DEPENDANT ON MOCKIN SUPPORT FOR LOGIN_HINT AND DOMAIN_HINT

    // test('IdP initiated login w/ GET login_hint', async ({ page }) => {
    //     const data = new URLSearchParams({ 
    //         op: 'login',
    //         login_hint: "mailto:Zoya-Alyona@xn--bcher-kva.example.com"
    //     });
    //     await page.goto(APP_API + '?' + data.toString())
    //     const response = await page.request.get(APP_API + '?op=auth')
    //     const json = await response.json()
    //     expect(response.status()).toBe(200)
    //     const json = await response.json()
    //     expect(json).toEqual(loggedIn)
    //     expect(json.email).toEqual(loginHintParam)
    // })
    // test('IdP initiated login w/ POST login_hint', async ({ page }) => {
    //     const loginHintParam = 'mailto:john.smith@me.com'
    //     const data = new URLSearchParams({ login_hint: loginHintParam })
    //     const response = await page.request.post(APP_API, {
    //         maxRedirects: 1,
    //         headers: {
    //             'content-type': 'application/x-www-form-urlencoded'
    //         },
    //         data: data.toString(),
    //     });
    //     const authzReqUrl = new URL(response.headers().location)
    //     const authzReqUrlParams = new URLSearchParams(authzReqUrl.search)
    //     expect(authzReqUrlParams.get('login_hint')).toEqual(loginHintParam)
    // })
    // test('IdP initiated login w/ GET login_hint & iss', async ({ page }) => {
    //     const login_hint = 'mailto:john.smith@me.com'
    //     const iss = 'https://issuer.hello.coop'
    //     const data = new URLSearchParams({ login_hint, iss });
    //     await page.goto(APP_API + '?' + data)
    //     const response = await page.request.get(APP_API + '?' + data, {
    //         maxRedirects: 1,
    //     })
    //     const authzReqUrl = new URL(response.headers().location)
    //     const authzReqUrlParams = new URLSearchParams(authzReqUrl.search)
    //     expect(authzReqUrlParams.get('login_hint')).toEqual(login_hint)
    // })
    // test('IdP initiated login w/ POST login_hint & iss', async ({ page }) => {
    //     const login_hint = 'mailto:john.smith@me.com'
    //     const iss = 'https://issuer.hello.coop'
    //     const data = new URLSearchParams({ login_hint, iss });
    //     const response = await page.request.post(APP_API, {
    //         maxRedirects: 1,
    //         headers: {
    //             'content-type': 'application/x-www-form-urlencoded'
    //         },
    //         data: data.toString(),
    //     });
    //     const authzReqUrl = new URL(response.headers().location)
    //     const authzReqUrlParams = new URLSearchParams(authzReqUrl.search)
    //     expect(authzReqUrlParams.get('login_hint')).toEqual(login_hint)
    // })
    // test('IdP initiated login w/ GET login_hint & domain_hint', async ({ page }) => {
    //     const login_hint = 'mailto:john.smith@me.com'
    //     const domain_hint = 'me.com'
    //     const data = new URLSearchParams({ login_hint, domain_hint });
    //     await page.goto(APP_API + '?' + data)
    //     const response = await page.request.get(APP_API + '?' + data, {
    //         maxRedirects: 1,
    //     })
    //     const authzReqUrl = new URL(response.headers().location)
    //     const authzReqUrlParams = new URLSearchParams(authzReqUrl.search)
    //     expect(authzReqUrlParams.get('login_hint')).toEqual(login_hint)
    //     expect(authzReqUrlParams.get('login_hint')).toBeUndefined
    // })
    // test('domain_hint', async ({ page }) => {
    //     await page.goto(APP_API + '?op=login')
    //     const domainHintParam = 'me.com'
    //     const data = new URLSearchParams({ op: 'login', domain_hint: domainHintParam });
    //     await page.goto(APP_API + '?' + data)
    //     const response = await page.request.get(APP_API + '?' + data, {
    //         maxRedirects: 0 //verify whether domain_hint is included in authz request to mockin server
    //     })
    //     const authzReqUrl = new URL(response.headers().location)
    //     const authzReqUrlParams = new URLSearchParams(authzReqUrl.search)
    //     expect(authzReqUrlParams.get('domain_hint')).toEqual(domainHintParam)
    // })
    // test('IdP initiated login w/ GET domain_hint', async ({ page }) => {
    //     const domain_hint = 'me.com'
    //     const data = new URLSearchParams({ domain_hint });
    //     await page.goto(APP_API + '?' + data)
    //     const response = await page.request.get(APP_API + '?' + data, {
    //         maxRedirects: 0 //verify whether domain_hint is included in authz request to mockin server
    //     })
    //     const authzReqUrl = new URL(response.headers().location)
    //     const authzReqUrlParams = new URLSearchParams(authzReqUrl.search)
    //     expect(authzReqUrlParams.get('domain_hint')).toEqual(domain_hint)
    // })
    // test('IdP initiated login w/ POST domain_hint', async ({ page }) => {
    //     const domainHintParam = 'me.com'
    //     const data = new URLSearchParams({ domain_hint: domainHintParam })
    //     const response = await page.request.post(APP_API, {
    //         maxRedirects: 0, //verify whether domain_hint is included in authz request to mockin server
    //         headers: {
    //             'content-type': 'application/x-www-form-urlencoded'
    //         },
    //         data: data.toString(),
    //     });
    //     const authzReqUrl = new URL(response.headers().location)
    //     const authzReqUrlParams = new URLSearchParams(authzReqUrl.search)
    //     expect(authzReqUrlParams.get('domain_hint')).toEqual(domainHintParam)
    // })
    // test('IdP initiated login w/ GET domain_hint & iss', async ({ page }) => {
    //     const domain_hint = 'me.com'
    //     const iss = 'https://issuer.hello.coop'
    //     const data = new URLSearchParams({ domain_hint, iss });
    //     await page.goto(APP_API + '?' + data)
    //     const response = await page.request.get(APP_API + '?' + data, {
    //         maxRedirects: 0 //verify whether domain_hint is included in authz request to mockin server
    //     })
    //     const authzReqUrl = new URL(response.headers().location)
    //     const authzReqUrlParams = new URLSearchParams(authzReqUrl.search)
    //     expect(authzReqUrlParams.get('domain_hint')).toEqual(domain_hint)
    // })
    // test('IdP initiated login w/ POST domain_hint & iss', async ({ page }) => {
    //     const domain_hint = 'me.com'
    //     const iss = 'https://issuer.hello.coop'
    //     const data = new URLSearchParams({ domain_hint, iss });
    //     const response = await page.request.post(APP_API, {
    //         maxRedirects: 0, //verify whether domain_hint is included in authz request to mockin server
    //         headers: {
    //             'content-type': 'application/x-www-form-urlencoded'
    //         },
    //         data: data.toString(),
    //     });
    //     const authzReqUrl = new URL(response.headers().location)
    //     const authzReqUrlParams = new URLSearchParams(authzReqUrl.search)
    //     expect(authzReqUrlParams.get('domain_hint')).toEqual(domain_hint)
    // })
    // test('invite', async ({ page }) => {
    //     const appName = 'Test'
    //     await page.goto(APP_API + '?op=login')
    //     const response = await page.request.get(APP_API + '?op=invite&app_name=' + appName, {
    //         maxRedirects: 0 //verify whether correct invite params is included in invite request
    //     })
    //     const inviteReqUrl = new URL(response.headers().location)
    //     const inviteReqUrlParams = new URLSearchParams(inviteReqUrl.search)
    //     const inviter = inviteReqUrlParams.get('inviter')
    //     expect(inviter).toEqual(loggedIn.sub)
    //     const client_id = inviteReqUrlParams.get('client_id')
    //     expect(client_id).toEqual(config.client_id)
    //     const initiate_login_uri = inviteReqUrlParams.get('initiate_login_uri')
    //     expect(initiate_login_uri).toEqual(APP_API)
    //     const app_name = inviteReqUrlParams.get('app_name')
    //     expect(app_name).toEqual(appName)
    //     const prompt = inviteReqUrlParams.get('prompt')
    //     expect(prompt).toEqual(`${loggedIn.name} has invited you to join ${appName}`)
    //     const return_uri = inviteReqUrlParams.get('return_uri')
    //     expect(return_uri).toEqual(APP_HOME)
    // })
    // test('provider inititated login', async ({ page }) => {
    //     await page.goto(APP_API + '?op=login')
    //     const loginHintParam = 'mailto:john.smith@me.com'
    //     const issParam = 'https://issuer.hello.coop'
    //     const response = await page.request.get(APP_API + '?iss=' + issParam + '&login_hint=' + loginHintParam, {
    //         maxRedirects: 0 //verify authz redirect url
    //     })
    //     const authzReqUrl = new URL(response.headers().location)
    //     const authzReqUrlParams = new URLSearchParams(authzReqUrl.search)
    //     const client_id = authzReqUrlParams.get('client_id')
    //     expect(client_id).toEqual(config.client_id)
    //     const redirect_uri = authzReqUrlParams.get('redirect_uri')
    //     expect(redirect_uri).toEqual(APP_API)
    //     const scope = authzReqUrlParams.get('scope')
    //     expect(scope).toBeDefined
    //     const response_type = authzReqUrlParams.get('response_type')
    //     expect(response_type).toBeDefined
    //     const response_mode = authzReqUrlParams.get('response_mode')
    //     expect(response_mode).toBeDefined
    //     const nonce = authzReqUrlParams.get('nonce')
    //     expect(nonce).toBeDefined
    //     const code_challenge = authzReqUrlParams.get('code_challenge')
    //     expect(code_challenge).toBeDefined
    //     const code_challenge_method = authzReqUrlParams.get('code_challenge_method')
    //     expect(code_challenge_method).toBeDefined
    //     const login_hint = authzReqUrlParams.get('login_hint')
    //     expect(login_hint).toEqual(loginHintParam)
    // })
    test('should get metadata', async ({ page }) => {
        const commandTokenRes = await page.request.get(MOCKIN + 'command/mock?client_id=' + config.client_id)
        const { command_token } = await commandTokenRes.json()
        expect(command_token).toBeDefined
        const data = new URLSearchParams({ command_token });
        const response = await page.request.post(APP_API, {
            maxRedirects: 0, //verify whether domain_hint is included in authz request to mockin server
            headers: {
                'content-type': 'application/x-www-form-urlencoded'
            },
            data: data.toString(),
        });
        const metadata = await response.json()
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