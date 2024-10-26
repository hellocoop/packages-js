import { Request, Response, NextFunction } from 'express'
import { Auth } from '@hellocoop/definitions'
import { configuration } from '@hellocoop/api'


export const redirect = function ( target:string ) {
    return async ( req: Request, res: Response, next: NextFunction) => {
        const auth: Auth = await req.getAuth()
        if (auth.isLoggedIn)
            next()
        else 
            res.redirect(target)
    }
}

export const unauthorized = async ( req: Request, res: Response, next: NextFunction) => {
    const auth: Auth = await req.getAuth()
    if (auth.isLoggedIn)
        next()
    else 
        res.setHeader('WWW-Authenticate',`Hello ${configuration.clientId}`).status(401).send()
}

export const setAuth = async ( req: Request, res: Response, next: NextFunction) => {
    await req.getAuth() // sets req.auth
    next()
}