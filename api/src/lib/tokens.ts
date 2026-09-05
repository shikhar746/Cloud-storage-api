import jwt, { type SignOptions } from 'jsonwebtoken'
import { env } from '../config/env.js'

export interface payload{
    sub: string
}

export function signAccessToken(userId: string) {
    return jwt.sign({sub: userId}, env.JWT_SECRET, {expiresIn: env.ACCESS_TOKEN_TTL.raw as NonNullable<SignOptions['expiresIn']>})
}

export function signRefreshToken(userId: string){
    return jwt.sign({sub: userId}, env.REFRESH_SECRET, {expiresIn: env.REFRESH_TOKEN_TTL.raw as NonNullable<SignOptions['expiresIn']>})
}

export function verifyAccessToken(token: string){
    try{
        return jwt.verify(token, env.JWT_SECRET) as payload
    } catch {
        return null
    }
}

export function verifyRefreshToken(token: string){
    try{
        return jwt.verify(token, env.REFRESH_SECRET) as payload
    } catch {
        return null
    }
}