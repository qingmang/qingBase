import axios from 'axios';
import type { AxiosRequestConfig, AxiosError } from 'axios';
import { message as $message } from 'ant-design-vue';
import { ACCESS_TOKEN_KEY } from '@/enums/cacheEnum';
import { Storage } from '@/utils/Storage';
import { useUserStore } from '@/store/modules/user';
import { REQUEST_TIMEOUT, REQUEST_TOKEN_PREFIX } from '@/config';
import {
  handleServiceResult,
  handleResponseError,
  transformRequestData,
  handleBackendError,
  handleAxiosError,
} from '@/utils/services';
// import {ExclamationCircleOutlined} from '@ant-design/icons'

export interface RequestOptions {
  /** 当前接口权限, 不需要鉴权的接口请忽略， 格式：sys:user:add */
  permCode?: string;
  /** 是否直接获取data，而忽略message等 */
  isGetDataDirectly?: boolean;
  /** 请求成功是提示信息 */
  successMsg?: string;
  /** 请求失败是提示信息 */
  errorMsg?: string;
  /** 是否mock数据请求 */
  isMock?: boolean;
}
/** 真实请求的路径前缀 */
const baseApiUrl = import.meta.env.VITE_BASE_API;
/** mock请求路径前缀 */
const baseMockUrl = import.meta.env.VITE_MOCK_API;

const axiosConfig: AxiosRequestConfig = {};
const backendConfig: Service.BackendResultConfig = {
  codeKey: 'code',
  dataKey: 'result',
  msgKey: 'message',
  successCode: 10000,
};
const defaultConfig: AxiosRequestConfig = {
  baseURL: baseApiUrl,
  timeout: REQUEST_TIMEOUT,
};

Object.assign(defaultConfig, axiosConfig);

const service = axios.create({
  baseURL: baseApiUrl,
  timeout: REQUEST_TIMEOUT,
});

service.interceptors.request.use(
  async (config) => {
    const handleConfig = { ...config };
    const token = Storage.get(ACCESS_TOKEN_KEY);
    if (handleConfig.headers) {
      // 数据转换
      const contentType = handleConfig.headers['Content-Type'] as string;
      handleConfig.data = await transformRequestData(handleConfig.data, contentType);
      // 请求头token信息，请根据实际情况进行修改
      handleConfig.headers['Authorization'] = REQUEST_TOKEN_PREFIX + token;
    }
    return handleConfig;
  },
  (error) => {
    Promise.reject(error);
  },
);

service.interceptors.response.use(
  (response) => {
    const { status } = response;

    if (status === 200 || status < 300 || status === 304) {
      const res = response.data;
      const { codeKey, dataKey, successCode } = backendConfig;
      // 请求成功
      if (res[codeKey] === successCode) {
        console.log(res[dataKey]);
        return handleServiceResult(null, res[dataKey]);
      }

      // token失效, 刷新token
      // if (REFRESH_TOKEN_CODE.includes(res[codeKey])) {
      //   const config = await refreshToken(response.config);
      //   if (config) {
      //     return this.instance.request(config);
      //   }
      // }
      const error = handleBackendError(res, backendConfig);

      return handleServiceResult(error, null);
    }
    const error = handleResponseError(response);
    return handleServiceResult(error, null);

    // if the custom code is not 200, it is judged as an error.
  },
  (axiosError: AxiosError) => {
    // 处理 422 或者 500 的错误异常提示
    const error = handleAxiosError(axiosError);
    return handleServiceResult(error, null);
  },
);

export type Response<T = any> = {
  code: number;
  message: string;
  data: T;
};

export type BaseResponse<T = any> = Promise<Response<T>>;

/**
 *
 * @param method - request methods
 * @param url - request url
 * @param data - request data or params
 */
export const request = async <T = any>(
  config: AxiosRequestConfig,
  options: RequestOptions = {},
): Promise<T> => {
  try {
    const { successMsg, errorMsg, permCode, isMock, isGetDataDirectly = true } = options;
    // 如果当前是需要鉴权的接口 并且没有权限的话 则终止请求发起
    if (permCode && !useUserStore().perms.includes(permCode)) {
      return $message.error('你没有访问该接口的权限，请联系管理员！');
    }
    const fullUrl = `${(isMock ? baseMockUrl : baseApiUrl) + config.url}`;
    config.url = fullUrl.replace(/(?<!:)\/{2,}/g, '/');

    const res = await service.request(config);
    successMsg && $message.success(successMsg);
    errorMsg && $message.error(errorMsg);
    return isGetDataDirectly ? res.data : res;
  } catch (error: any) {
    return Promise.reject(error);
  }
};
