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
    const { sender, recipient, pdfBase64, orderId } = await req.json()

    console.log(`Sending email for order ${orderId} to ${recipient}`)

    const data = await resend.emails.send({
      from: `Notification Chantier <onboarding@resend.dev>`, // À personnaliser plus tard
      to: [recipient],
      subject: `PV de Réception - Chantier ${orderId}`,
      html: `
        <div style="font-family: sans-serif; line-height: 1.5; color: #333;">
          <h2>PV de Réception de Chantier</h2>
          <p>Bonjour,</p>
          <p>Veuillez trouver ci-joint le Procès-Verbal de réception pour le chantier <strong>${orderId}</strong>.</p>
          <p>Ce document atteste de la fin des travaux et de la conformité des menuiseries installées.</p>
          <br/>
          <p>Cordialement,</p>
          <p><em>L'équipe Logistique</em></p>
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
