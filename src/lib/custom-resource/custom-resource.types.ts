export type TCustomResourceAuth = {
  type: 'credential-propagation';
};

export type TCustomResourceRequest = {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  auth: TCustomResourceAuth;
};

export type TCustomResourceDefinition = {
  id: string;
  name: string;
  description: string;
  apiRoutes: {
    list: {
      request: TCustomResourceRequest;
      enablePagination: boolean;
    };
    get: {
      request: TCustomResourceRequest;
    };
  };
};
