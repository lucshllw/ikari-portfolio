import { z } from 'zod';
import { permitRequest } from '$lib/http.server';
import { getPublicProjects } from '$lib/server/catalog';
import { CLOUD_BUILD, isCloud } from '$lib/server/storage-mode';

const fields = z.object({
  name: z.string().trim().min(2, 'Informe seu nome (mínimo de 2 caracteres).').max(120),
  email: z.email('Informe um e-mail válido.').max(254),
  service: z.string().trim().min(1, 'Selecione um tipo de serviço.').max(120),
  brief: z.string().trim().min(10, 'Conte um pouco mais da ideia (mínimo de 10 caracteres).').max(4000, 'Resuma a descrição em até 4000 caracteres.')
});
export type CommissionValues = z.infer<typeof fields>;
export type CommissionSubmission = CommissionValues & { referenceId: string; requestKey: string; website: string };
type Rejected = { success: false; status: number; error: string; values: CommissionValues; referenceId: string; fieldErrors: Record<string, string> };
type Received = { success: true; id: string; protocol: string };

/** Optional notification contains only an identifier, never the private briefing. */
export async function notifyCommission(id: string): Promise<'accepted' | 'disabled' | 'failed'> {
  const key=process.env.RESEND_API_KEY;
  let target=process.env.IKARI_NOTIFICATION_TO;
  const ownerId=process.env.IKARI_NOTIFICATION_OWNER_ID;
  if(key&&ownerId){
    if(!(CLOUD_BUILD||isCloud())||!z.uuid().safeParse(ownerId).success)return 'failed';
    try{
      const {getCloudServiceClient}=await import('$lib/server/cloud/client');
      const client=getCloudServiceClient();
      const {data:editor,error}=await client.from('ikari_editors').select('user_id').eq('user_id',ownerId).maybeSingle();
      if(error||editor?.user_id!==ownerId)return 'failed';
      const identity=await client.auth.admin.getUserById(ownerId);
      if(identity.error||!identity.data.user?.email_confirmed_at)return 'failed';
      target=identity.data.user.email;
    }catch{return 'failed';}
  }
  const recipient=z.email().safeParse(target);
  const sender=z.string().min(3).max(320).regex(/^[^\r\n]+$/).safeParse(process.env.IKARI_NOTIFICATION_FROM);
  if(!key||!recipient.success||!sender.success)return 'disabled';
  if(!z.uuid().safeParse(id).success)return 'failed';
  let origin:URL;
  try{origin=new URL(process.env.ORIGIN||'');if(origin.protocol!=='https:'||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)return 'failed';}catch{return 'failed';}
  try{
    const response=await fetch('https://api.resend.com/emails',{
      method:'POST',redirect:'error',signal:AbortSignal.timeout(4000),
      headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json','Idempotency-Key':`ikari-commission:${id}`},
      body:JSON.stringify({from:sender.data,to:[recipient.data],subject:`[IKARI STUDIO] Novo pedido — TAKE #${id.toUpperCase()}`,text:`Novo pedido recebido: TAKE #${id.toUpperCase()}.\n\nAbra a mesa privada para ler e responder:\n${new URL('/admin/pedidos',origin).href}\n\nEsta notificação não contém os dados do cliente nem o briefing.`})
    });
    return response.ok?'accepted':'failed';
  }catch{return 'failed';}
}

/** Shared by the progressive-enhancement form and the JSON endpoint. */
export async function receivePublicCommission(input: CommissionSubmission, address: string): Promise<Rejected | Received> {
  const { name, email, service, brief: originalBrief, referenceId, requestKey, website } = input;
  const values = { name, email, service, brief: originalBrief };
  const fieldErrors: Record<string, string> = {};
  const reject = (status: number, error: string): Rejected => ({ success: false, status, error, values, referenceId, fieldErrors });
  if (!permitRequest(address)) return reject(429, 'Aguarde um minuto antes de enviar outro pedido. Seus campos foram preservados.');
  if (website) return reject(400, 'Não foi possível receber o pedido.');
  const parsed = fields.safeParse(values);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
    return reject(400, 'Revise os campos indicados. O pedido ainda não foi enviado.');
  }
  if (!z.uuid().safeParse(requestKey).success) return reject(400, 'A identificação do envio expirou. Atualize a página e tente novamente.');
  const reference = referenceId ? (await getPublicProjects()).find(project => project.id === referenceId) : undefined;
  if (referenceId && !reference) {
    fieldErrors.referenceId = 'Essa obra não está mais disponível. Escolha outra referência ou remova a seleção.';
    return reject(400, 'Revise a referência do projeto.');
  }
  // Resolve the public work on the server; never trust client-supplied credits or URLs.
  const brief = parsed.data.brief + (reference ? `\n\nProjeto de referência: ${reference.title}\nIdentificador: ${reference.id}` : '');
  if (brief.length > 4000) {
    fieldErrors.brief = 'Encurte um pouco a descrição para incluir a referência (até 3600 caracteres).';
    return reject(400, 'A descrição e a referência ultrapassam o espaço do pedido.');
  }
  try {
    const result = (CLOUD_BUILD || isCloud())
      ? await (await import('$lib/server/cloud/inquiries')).createCloudInquiry({ ...parsed.data, brief }, requestKey, address)
      : (await import('$lib/server/inquiries')).createInquiry({ ...parsed.data, brief }, requestKey);
    // Provider acceptance is not delivery. A notification failure never rolls back a saved request.
    const notification=result.created ? await notifyCommission(result.id) : 'disabled';
    if(notification==='failed')console.warn('Ikari: pedido persistido, notificação não confirmada.');
    // Full identifier keeps the protocol unique and stable on idempotent retries.
    return { success: true, id: result.id, protocol: `TAKE #${result.id.toUpperCase()}` };
  } catch {
    return reject(400, 'Não foi possível confirmar o pedido. Seus dados continuam aqui; tente novamente.');
  }
}

export function commissionFormInput(form: FormData): CommissionSubmission {
  return Object.fromEntries(['name', 'email', 'service', 'brief', 'referenceId', 'requestKey', 'website'].map(key => [key, String(form.get(key) || '')])) as CommissionSubmission;
}
