import test from 'node:test';
import assert from 'node:assert/strict';
import {discordDeliveryView} from '../worker/index.js';

test('personnel route is reported precisely while retaining legacy D1 type',()=>{
 const row={id:'x',kind:'announcements',status:'sent',error_code:'route:promotions|',http_status:null};
 const view=discordDeliveryView(row);
 assert.equal(view.kind,'promotions');
 assert.equal(view.stored_kind,'announcements');
 assert.equal(view.error_code,'');
});
test('failed discipline webhook reports its route and original error class',()=>{
 const row={id:'y',kind:'announcements',status:'failed',http_status:403,error_code:'route:personnel|http_error'};
 const view=discordDeliveryView(row);
 assert.equal(view.kind,'personnel');
 assert.equal(view.error_code,'http_error');
 assert.equal(view.http_status,403);
});
test('legacy delivery records and unknown tags remain intact',()=>{
 const original={kind:'applications',error_code:'network_error',status:'failed'};
 assert.equal(discordDeliveryView(original).kind,'applications');
 assert.equal(discordDeliveryView(original).error_code,'network_error');
 const forged={kind:'test',error_code:'route:not_whitelisted|network_error'};
 assert.equal(discordDeliveryView(forged).kind,'test');
 assert.equal(discordDeliveryView(forged).error_code,forged.error_code);
});
test('status-specific application routes are distinguished',()=>{
 const row={kind:'decisions',error_code:'route:application_rejected|',status:'sent'};
 assert.equal(discordDeliveryView(row).kind,'application_rejected');
});
