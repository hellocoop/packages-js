// testing utilities

export const session = async ( fastify, sessionCookie, log ) => {
    const response = await fastify.inject({
        url: '/api/v1/session',
        cookies: {
            'mock-session': sessionCookie
        },
    })
    // expect(response.statusCode).to.equal(200)
    const json = JSON.parse(response.body)
    // expect(json).to.exist
    if (log)
        console.log('Session:', JSON.stringify(json, null, 2))
    return json
}

export const harvestCookies = ( cookies, response ) => {
    for (const cookie of response.cookies ) {
        if (cookie.value === '')
            delete cookies[cookie.name]
        else
            cookies[cookie.name] = cookie.value
    }
}