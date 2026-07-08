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
  ],
});
