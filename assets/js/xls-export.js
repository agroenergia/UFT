import {metrics as normalizeMetrics} from "./criteria.js";

function xmlEsc(v){
  return String(v??"")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&apos;")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g," ");
}

function wosClassifierText(r){
  if(r.classificadorWos)return r.classificadorWos;
  if(!r.indexacaoWos)return "";
  const parts=[];
  if(r.colecaoWos)parts.push("Coleção WoS: "+r.colecaoWos);
  if(r.fatorImpacto!==null&&r.fatorImpacto!==undefined&&r.fatorImpacto!==""){
    parts.push("JIF "+r.fatorImpacto+(r.anoFatorImpacto?" ("+r.anoFatorImpacto+")":""));
  }
  if(r.quartilJif)parts.push("Quartil JIF: "+r.quartilJif);
  if(r.percentilJif!==null&&r.percentilJif!==undefined&&r.percentilJif!=="")parts.push("Percentil JIF: "+r.percentilJif+"%");
  return parts.join(" · ");
}

export function journalSpreadsheetRows(journals){
  const headers=[
    {label:"Título",width:210,type:"String"},
    {label:"ISSN",width:85,type:"String"},
    {label:"Editora",width:155,type:"String"},
    {label:"Área de pesquisa",width:165,type:"String"},
    {label:"Escopo editorial",width:250,type:"String"},
    {label:"Status na curadoria",width:110,type:"String"},
    {label:"Indexação Scopus",width:85,type:"String"},
    {label:"CiteScore 2025",width:85,type:"Number"},
    {label:"Maior Percentil Scopus (%)",width:115,type:"Number"},
    {label:"Quartil SJR",width:75,type:"String"},
    {label:"Indexação Web of Science (WoS)",width:95,type:"String"},
    {label:"Coleção WoS",width:165,type:"String"},
    {label:"JIF (WoS)",width:75,type:"Number"},
    {label:"Classificador WoS (Quartil / Percentil JIF)",width:230,type:"String"},
    {label:"Acordo CAPES",width:85,type:"String"},
    {label:"Custo / Publicação",width:165,type:"String"},
    {label:"Idiomas aceitos",width:110,type:"String"},
    {label:"Primeira decisão",width:110,type:"String"},
    {label:"Site / Ficha da revista",width:200,type:"String"},
    {label:"Link oficial Scopus",width:200,type:"String"},
    {label:"Instruções aos autores",width:200,type:"String"}
  ];

  const rows=(journals||[]).map(r=>{
    const m=normalizeMetrics(r);
    const scopusUrl=r.scopusSourceId?"https://www.scopus.com/sourceid/"+encodeURIComponent(r.scopusSourceId):"";
    const statusMap={selecao:"Na seleção",abaixo:"Demais registros",confirmar:"Em conferência"};
    const statusLabel=statusMap[r.criterioPlanilha?.status]||r.enquadramento||"";
    const csNum=r.citescore!==null&&r.citescore!==undefined&&r.citescore!==""&&Number.isFinite(Number(r.citescore))?Number(r.citescore):"";
    const pctNum=m.maiorPercentil!==null&&m.maiorPercentil!==undefined&&Number.isFinite(Number(m.maiorPercentil))?Number(m.maiorPercentil):"";
    const jifNum=r.fatorImpacto!==null&&r.fatorImpacto!==undefined&&r.fatorImpacto!==""&&Number.isFinite(Number(r.fatorImpacto))?Number(r.fatorImpacto):"";
    return [
      r.titulo||"",
      r.issn||"",
      r.editora||"",
      r.area||"",
      r.alinhamento||r.escopo||"",
      statusLabel,
      r.indexacaoScopus===true?"Sim":r.indexacaoScopus===false?"Não":"",
      csNum,
      pctNum,
      r.sjr||"",
      r.indexacaoWos===true?"Sim":r.indexacaoWos===false?"Não":"",
      r.colecaoWos||"",
      jifNum,
      wosClassifierText(r),
      r.acordoCapes===true?"Sim":r.acordoCapes===false?"Não":"A confirmar",
      r.custo||"",
      r.idioma||"",
      r.prazoPrimeiraDecisao||r.prazoPrimeiraDecisaoPlanilha||"",
      r.url_ficha||r.url||"",
      scopusUrl,
      r.urlInstrucoes||""
    ];
  });
  return {headers,rows};
}

export function buildSpreadsheetML(journals,sheetName="RigorAtlas_Base"){
  const {headers,rows}=journalSpreadsheetRows(journals);
  const colsXml=headers.map(h=>`<Column ss:AutoFitWidth="0" ss:Width="${h.width}"/>`).join("");
  const headRow=`<Row ss:Height="28">${headers.map(h=>`<Cell ss:StyleID="Header"><Data ss:Type="String">${xmlEsc(h.label)}</Data></Cell>`).join("")}</Row>`;
  const bodyRows=rows.map(row=>{
    const cells=row.map((val,idx)=>{
      const type=headers[idx].type==="Number"&&val!==""?"Number":"String";
      return `<Cell ss:StyleID="Body"><Data ss:Type="${type}">${xmlEsc(val)}</Data></Cell>`;
    }).join("");
    return `<Row>${cells}</Row>`;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Top" ss:WrapText="1"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#102A43"/>
  </Style>
  <Style ss:ID="Header">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center" ss:WrapText="1"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#1B6D49"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#0C4A6E" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="Body">
   <Alignment ss:Vertical="Top" ss:WrapText="1"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#DCE6EE"/>
   </Borders>
  </Style>
 </Styles>
 <Worksheet ss:Name="${xmlEsc(sheetName.slice(0,31))}">
  <Table ss:ExpandedColumnCount="${headers.length}" ss:ExpandedRowCount="${rows.length+1}" x:FullColumns="1" x:FullRows="1">
   ${colsXml}
   ${headRow}
   ${bodyRows}
  </Table>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
   <FreezePanes/>
   <FrozenNoSplit/>
   <SplitHorizontal>1</SplitHorizontal>
   <TopRowBottomPane>1</TopRowBottomPane>
   <ActivePane>2</ActivePane>
  </WorksheetOptions>
 </Worksheet>
</Workbook>`;
}

export function downloadJournalsXls(journals,filename="RigorAtlas-base-completa.xls"){
  const xml=buildSpreadsheetML(journals,"Revistas_RigorAtlas");
  const blob=new Blob(["\ufeff"+xml],{type:"application/vnd.ms-excel;charset=utf-8"});
  const a=document.createElement("a");
  const url=URL.createObjectURL(blob);
  a.href=url;
  a.download=filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
}

export function downloadJournalsCsv(journals,filename="RigorAtlas-base-completa.csv"){
  const {headers,rows}=journalSpreadsheetRows(journals);
  const cell=v=>{
    const s=String(v??"");
    return /^[=+\-@\t\r]/.test(s)?'"'+"'"+s.replace(/"/g,'""')+'"':'"'+s.replace(/"/g,'""')+'"';
  };
  const csv=[headers.map(h=>cell(h.label)).join(";"),...rows.map(r=>r.map(cell).join(";"))].join("\r\n");
  const blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"});
  const a=document.createElement("a");
  const url=URL.createObjectURL(blob);
  a.href=url;
  a.download=filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
}
