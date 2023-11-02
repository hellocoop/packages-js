import { Request, Response, NextFunction } from 'express'
import { Auth } from 'lib/auth'
import config from 'lib/config'

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
        res.setHeader('WWW-Authenticate:',`Hello ${config.clientId}`).status(401)
}

export const auth = async ( req: Request, res: Response, next: NextFunction) => {
    await req.getAuth() // sets req.auth
    next()
}