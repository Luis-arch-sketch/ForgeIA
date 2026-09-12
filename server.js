import "dotenv/config";
import express from "express";
import OpenAI from "openai";
const app=express(); app.use(express.json({limit:"10mb"})); app.use(express.static("."));
const openai=new OpenAI({apiKey:process.env.OPENAI_API_KEY});
app.post("/api/generate",async(req,res)=>{try{
 const {prompt,files={}}=req.body;if(!prompt)return res.status(400).json({error:"Prompt não informado."});
 const response=await openai.chat.completions.create({model:process.env.OPENAI_MODEL||"gpt-4o-mini",messages:[
  {role:"system",content:`Você é o motor do ForgeAI, um construtor de sites. Crie ou altere o site conforme o pedido. Retorne SOMENTE JSON válido com html, css e javascript. Preserve funcionalidades existentes quando possível.
HTML atual:${files.html||""}
CSS atual:${files.css||""}
JavaScript atual:${files.javascript||""}`},
  {role:"user",content:prompt}
 ]});
 const content=response.choices[0].message.content;
 let result;try{result=JSON.parse(content)}catch{return res.status(500).json({error:"A IA retornou JSON inválido."})}
 res.json({success:true,files:result,tokens:0});
}catch(e){console.error(e);res.status(500).json({error:e.message||"Erro ao chamar a OpenAI."})}});
app.listen(process.env.PORT||3000,()=>console.log("ForgeAI rodando"));
