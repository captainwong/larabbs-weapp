import wepy from 'wepy'

// 显示服务器错误
const showServerError = (err) => {
    console.log(err)
    wepy.showModal({
        title: '提示',
        content: '服务器错误，请联系管理员或重试\r\n' + err
    })
}

// 服务器接口地址
const host = 'http://larabbs.test/api'

// 普通请求
const request = async(options, showLoading = true) => {
    // 简化开发，如果传入字符串则转换成对象
    if(typeof options === 'string'){
        options = {
            url: options
        }
    }

    // 显示加载中
    if(showLoading){
        wepy.showLoading({title: '加载中'})
    }

    // 拼接url
    options.url = host + '/' + options.url;
    console.log(options)

    // 调用小程序的 request 方法
    let response = await wepy.request(options)
    console.log(response)

    if(showLoading){
        // 隐藏‘加载中’
        wepy.hideLoading()
    }

    // 服务器异常后给予提示
    if(response.statusCode === 500){
        wepy.showModal({
            title: '提示',
            content: '服务器错误，请联系管理员或重试: 500 ' + response.data.message
        })
    }

    return response
}

// 登录
const login = async (params = {}) => {
    // code 只能使用一次，所以每次单独调用
    let loginData = await wepy.login()
    console.log(loginData)

    // 参数中增加 code
    params.code = loginData.code

    // 接口请求 weapp/authorizations
    let authResponse = await request({
        url: 'weapp/authorizations',
        data: params,
        method: 'POST'
    })

    // 登录成功，记录 token 信息
    if(authResponse.statusCode === 201){
        wepy.setStorageSync('access_token', authResponse.data.access_token)
        wepy.setStorageSync('access_token_expired_at', new Date().getTime() + authResponse.data.expires_in * 1000)
    }

    return authResponse
}

// 刷新token
const refreshToken = async (accessToken) => {
    let refreshResponse = await request({
        url: 'authorizations/current',
        method: 'PUT',
        header: {
            'Authorization': 'Bearer ' + accessToken
        }
    })

    if(refreshResponse.statusCode === 200){
        wepy.setStorageSync('access_token', refreshResponse.data.access_token)
        wepy.setStorageSync('access_token_expired_at', new Date().getTime() + refreshResponse.data.expires_in * 1000)
    }

    return refreshResponse
}

// 获取token
const getToken = async (options) => {
    let accessToken = wepy.getStorageSync('access_token')
    let expiredAt = wepy.getStorageSync('access_token_expired_at')

    if(accessToken && new Date().getTime() > expiredAt){
        let refreshResponse = await refreshToken(accessToken)
        if(refreshResponse.statusCode === 200){
            accessToken = refreshResponse.data.access_token
        }else{
            let authResponse = await login()
            if(authResponse.statusCode === 201){
                accessToken = authResponse.data.access_token
            }
        }
    }

    return accessToken
}

// 带身份认证的请求
const authRequest = async (options, showLoading = true) => {
    if(typeof options === 'string'){
        options = {
            url: options
        }
    }

    let accessToken = await getToken()

    let header = options.header || {}
    header.Authorization = 'Bearer ' + accessToken
    options.header = header

    return request(options, showLoading)
}

// 退出登录
const logout = async (params = []) => {
    let accessToken = wepy.getStorageSync('access_token')
    let logoutResponse = await request({
        url: 'authorizations/current',
        method: 'DELETE',
        header: {
            'Authorization' : 'Bearer ' + accessToken
        }
    })

    if(logoutResponse.statusCode === 204){
        wepy.clearStorage()
    }

    return logoutResponse
}

// 上传文件
const uploadFile = async (options = {}) => {
    wepy.showLoading({title: '上传中'})
    let accessToken = await getToken()
    options.url = host + '/' + options.url
    let header = options.header || {}
    header.Authorization = 'Bearer ' + accessToken
    options.header = header

    let response = await wepy.uploadFile(options)
    wepy.hideLoading()

    return response
}

export default {
    showServerError,
    request,
    authRequest,
    refreshToken,
    login,
    logout,
    uploadFile
}
