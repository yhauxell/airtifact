import { initBotId } from 'botid/client/core';

initBotId({
  protect: [
    {
      path: '/api/admin/auth',
      method: 'POST',
    },
    {
      path: '/api/admin/projects/*',
      method: 'DELETE',
    },
    {
      path: '/api/projects/*/remove',
      method: 'DELETE',
    },
    {
      path: '/api/auth/login',
      method: 'POST',
    },
    {
      path: '/api/auth/signup',
      method: 'POST',
    },
  ],
});

