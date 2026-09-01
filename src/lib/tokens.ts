import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'

export interface payload{
    sub: string
    // id : string,
    // email : string,
    // name : string
}

export function signAccessToken(userId: string) {
    return jwt.sign({sub: userId}, env.JWT_SECRET, {expiresIn: '15m'})
}

export function signRefreshToken(userId: string){
    return jwt.sign({sub: userId}, env.REFRESH_SECRET, {expiresIn: '7d'})
}

export function verifyAccessToken(token: string){
    try{
        return jwt.verify(token, env.JWT_SECRET) as {sub : string}
    } catch {
        return null
    }
}

export function verifyRefreshToken(token: string){
    try{
        return jwt.verify(token, env.REFRESH_SECRET) as {sub : string}
    } catch {
        return null
    }
}