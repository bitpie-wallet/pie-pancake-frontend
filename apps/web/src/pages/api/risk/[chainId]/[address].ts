import { NextApiHandler } from 'next'
import { enum as zEnum, string as zString, object as zObject } from 'zod'
import { v4 as uuid } from 'uuid'
import HmacSHA256 from 'crypto-js/hmac-sha256'
import EncodeHex from 'crypto-js/enc-hex'
import axios from 'axios'
import { SocksProxyAgent } from 'socks-proxy-agent'

const host = 'https://avengerdao.org'
const url = '/api/v1/address-security'
const endpoint = host + url

const appId = '0331c8c6a3130f66c01a3ea362ddc7de3612c5f18d65898896a32650553d47aa1e'
const appSecret = process.env.RISK_APP_SECRET

const zChainId = zEnum(['56'])

const zAddress = zString().regex(/^0x[a-fA-F0-9]{40}$/)
const proxy = 'socks5://127.0.0.1:1080';

const zParams = zObject({
  chainId: zChainId,
  address: zAddress,
})

const handler: NextApiHandler = async (req, res) => {
  const parsed = zParams.safeParse(req.query)

  if (parsed.success === false) {
    return res.status(400).json(parsed.error)
  }

  const { chainId, address: address_ } = parsed.data
  const address = address_.toLowerCase()
  const timeStamp = new Date().valueOf().toString()
  const nonce = uuid().replaceAll('-', '')
  const body = JSON.stringify({
    chainId,
    address,
  })
  const method = 'POST'

  const hasSecret = !!appSecret

  let headers: HeadersInit = {
    'Content-Type': 'application/json;charset=UTF-8',
  }

  if (hasSecret) {
    const data = [appId, timeStamp, nonce, method, url, body].join(';')
    const sig = EncodeHex.stringify(HmacSHA256(data, appSecret))
    headers = {
      ...headers,
      'X-Signature-appid': appId,
      'X-Signature-timestamp': timeStamp,
      'X-Signature-nonce': nonce,
      'X-Signature-signature': sig,
    }
  }

  const agent = new SocksProxyAgent(proxy)
  const response = await axios.post(endpoint, body, { headers, httpAgent: agent })

  const json = await response.data()

  res.setHeader('Cache-Control', 's-maxage=86400, max-age=3600')

  return res.status(response.status).json(json)
}

export default handler
