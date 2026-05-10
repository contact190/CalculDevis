import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { Resend } from 'npm:resend'

const resend = new Resend(Deno.env.get('RESEND_API_KEY'))

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { sender, recipient, companyName, clientName, floors, pdfBase64, orderId } = await req.json()

    console.log(`Sending email for order ${orderId} (Floors: ${floors}) to ${recipient}`)

    // ⚠️ Pour utiliser votre propre email, vérifiez votre domaine sur resend.com/domains
    // Une fois vérifié, remplacez onboarding@resend.dev par votre adresse email (sender)
    const fromAddress = Deno.env.get('VERIFIED_DOMAIN') 
      ? `${companyName} <${sender}>` 
      : `${companyName} <onboarding@resend.dev>`;

    const data = await resend.emails.send({
      from: fromAddress,
      to: [recipient],
      subject: `PV de Réception - ${clientName}`,
      html: `
        <div style="font-family: sans-serif; line-height: 1.6; color: #1a202c; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
          <div style="background: #1e293b; padding: 24px; color: white; text-align: center;">
            <h1 style="margin: 0; font-size: 20px;">Procès-Verbal de Réception</h1>
          </div>
          <div style="padding: 32px; background: white;">
            <p>Bonjour <strong>${clientName}</strong>,</p>
            <p>Nous avons le plaisir de vous informer que les travaux concernant vos étages : <strong>${floors}</strong> sont désormais terminés.</p>
            <p>Veuillez trouver ci-joint votre Procès-Verbal de réception, attestant de la conformité des menuiseries installées.</p>
            <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; color: #64748b; font-size: 14px;">Cordialement,</p>
              <p style="margin: 4px 0 0 0; font-weight: 800; font-size: 16px; color: #1e293b;">L'équipe ${companyName}</p>
            </div>
          </div>
          <div style="background: #f8fafc; padding: 16px; text-align: center; fontSize: 12px; color: #94a3b8;">
            Document généré automatiquement par le portail logistique ${companyName}
          </div>
        </div>
      `,
      attachments: [
        {
          filename: `PV_RECEPTION_${orderId}.pdf`,
          content: pdfBase64,
        },
      ],
    })

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error("Error in send-pv-email function:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
