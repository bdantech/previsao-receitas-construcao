import React from 'react';

type TProps = {
  projectId: string;
  cedente: {
    razaoSocial: string;
    cnpj: string;
  };
  recebiveis: {
    comprador: string;
    cpf: string;
    vencimento: string;
    valor: string;
    linkContrato?: string
  }[];
  valores: {
    valorTotalCreditosVencimento: number;
    precoPagoCessao: number;
    formaPagamento: string;
    descontos: number;
    valorLiquidoPagoAoCedente: number;
    dataPagamento: string;
  };
  user: {
    email: string;
  };
  refComponent?: React.RefObject<HTMLDivElement>;
};

export const AnticipationTerms = (props: TProps) => {
  const { refComponent, cedente, recebiveis, valores, user } = props;

  return (
    <div style={{ maxHeight: '400px', overflow: 'auto' }}>
      <div ref={refComponent} style={{ maxWidth: '595.3pt', margin: '0 auto', lineHeight: '150%', padding: '0 24px' }}>
        <h1 style={{ textAlign: 'center', fontWeight: 'bold', marginTop: '12pt', marginBottom: '12pt' }}>
          CONTRATO DE CESSÃO DE CRÉDITOS
        </h1>

        <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: '20px', border: '1pt solid black' }}>
          <tbody>
            <tr>
              <td style={{ border: '1pt solid black', padding: '4px' }}><strong>CEDENTE</strong></td>
              <td style={{ border: '1pt solid black', padding: '4px' }}><strong>{cedente.razaoSocial}</strong>, CNPJ nº {cedente.cnpj}</td>
            </tr>
            <tr>
              <td style={{ border: '1pt solid black', padding: '4px' }}><strong>CESSIONÁRIA</strong></td>
              <td style={{ border: '1pt solid black', padding: '4px' }}><strong>CONSTRUCREDIT SECURITIZADORA S.A.</strong>, CNPJ nº 43.738.268/0001-38</td>
            </tr>
          </tbody>
        </table>

        <p style={{ textAlign: 'justify' }}>
          1. <strong>Objeto da Cessão.</strong> O Cedente cede e transfere à Cessionária, em caráter definitivo e irrevogável, os créditos descritos neste instrumento, pelo preço e nas condições aqui ajustadas.
        </p>
        <p style={{ textAlign: 'justify', marginTop: 16, marginBottom: 16 }} >
          2. <strong>Identificação dos Direitos Creditórios.</strong> Os Direitos Creditórios ora cedidos são oriundos de contratos de compra e venda de unidade(s) imobiliária(s) celebrados entre o Cedente e os respectivos devedores, cujas informações principais constam da tabela abaixo:
        </p>

        <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: '20px', border: '1pt solid black' }}>
          <thead>
            <tr style={{ backgroundColor: '#f2f2f2' }}>
              <th style={{ border: '1pt solid black', padding: '4px' }}>Devedor ou Sacado</th>
              {/* <th style={{ border: '1pt solid black', padding: '4px' }}>Parcela</th> */}
              <th style={{ border: '1pt solid black', padding: '4px' }}>Data de Vencimento</th>
              <th style={{ border: '1pt solid black', padding: '4px' }}>Valor (R$)</th>
              {/* <th style={{ border: '1pt solid black', padding: '4px' }}>Link do Contrato</th> */}
            </tr>
          </thead>
          <tbody>
            {recebiveis.map((item, index) => (
              <tr key={index}>
                <td style={{ border: '1pt solid black', padding: '4px' }}>
                  {item.comprador} ({item.cpf})
                  <p>
                    {
                      item.linkContrato && (
                        <a href={item.linkContrato} target="_blank" style={{ color: 'blue', textDecoration: 'underline' }}>
                          Visualizar Contrato
                        </a>
                      )
                    }
                  </p>
                </td>
                {/* <td style={{ border: '1pt solid black', padding: '4px' }}>{item.numeroContrato}</td> */}
                <td style={{ border: '1pt solid black', padding: '4px' }}>{item.vencimento}</td>
                <td style={{ border: '1pt solid black', padding: '4px' }}>{item.valor}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p style={{ textAlign: 'justify' }}>
        2.1. Os referidos créditos decorrem de obrigações contratuais líquidas, certas e exigíveis, formalizadas por meio eletrônico ou físico, conforme aplicável, com documentos arquivados na plataforma <strong>One Pay</strong>, nos links indicados acima ou, se necessário, nos anexos a este instrumento.
        </p>
        <p style={{ textAlign: 'justify', marginTop: 16, marginBottom: 16 }}>3. <strong>Condições da Cessão</strong></p>
        <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: '20px', border: '1pt solid black' }}>
          <tbody>
            <tr>
              <td style={{ border: '1pt solid black', padding: '5px' }}>Valor total dos Créditos no Vencimento</td>
              <td style={{ border: '1pt solid black', padding: '5px', fontWeight: 'bold' }}>R$ {valores.valorTotalCreditosVencimento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
            </tr>
            <tr>
              <td style={{ border: '1pt solid black', padding: '5px' }}>Preço pago pela cessão</td>
              <td style={{ border: '1pt solid black', padding: '5px', fontWeight: 'bold' }}>R$ {valores.precoPagoCessao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
            </tr>
            <tr>
              <td style={{ border: '1pt solid black', padding: '5px' }}>Forma de Pagamento</td>
              <td style={{ border: '1pt solid black', padding: '5px', fontWeight: 'bold' }}>{valores.formaPagamento}</td>
            </tr>
            <tr>
              <td style={{ border: '1pt solid black', padding: '5px' }}>Descontos (recompras, despesas e taxas)</td>
              <td style={{ border: '1pt solid black', padding: '5px', fontWeight: 'bold' }}>R$ {valores.descontos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
            </tr>
            <tr>
              <td style={{ border: '1pt solid black', padding: '5px' }}>Valor líquido pago ao Cedente</td>
              <td style={{ border: '1pt solid black', padding: '5px', fontWeight: 'bold' }}>R$ {valores.valorLiquidoPagoAoCedente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
            </tr>
            <tr>
              <td style={{ border: '1pt solid black', padding: '5px' }}>Data de Pagamento</td>
              <td style={{ border: '1pt solid black', padding: '5px' }}>{valores.dataPagamento}</td>
            </tr>
          </tbody>
        </table>

        <p style={{ textAlign: 'justify', marginTop: 16 }}>
          4. <strong>Declarações e Obrigações do Cedente.</strong> O Cedente declara e garante, para todos os fins de direito:
        </p>

        <p style={{ textAlign: 'justify', marginTop: 16, marginBottom: 16 }}>
        (a) que os créditos não foram objeto de cessão anterior, penhora, garantia ou qualquer ônus, e não são objeto de demanda judicial ou disputa quanto à sua existência ou valor;
        </p>

        <p style={{ textAlign: 'justify', marginTop: 16, marginBottom: 16 }}>
        (b) que não são objeto de litígio, disputa judicial ou extrajudicial quanto à sua existência, validade ou exequibilidade;
        </p>

        <p style={{ textAlign: 'justify', marginTop: 16, marginBottom: 16 }}>
        (c) que, mediante solicitação da Cessionária, compromete-se a fornecer, no prazo máximo de 3 (três) dias úteis, os documentos comprobatórios da origem e validade dos créditos, incluindo: contratos, aditivos, boletos, comprovantes de pagamento e documentos de garantias (como alienação fiduciária, hipoteca ou fiança);
        </p>

        <p style={{ textAlign: 'justify', marginTop: 16, marginBottom: 16 }}>
        (d) que prestará à Cessionária, no prazo de até 5 (cinco) dias úteis, quaisquer outras informações ou documentos complementares que se façam necessários à verificação da legitimidade dos créditos.
        </p>

        <p style={{ textAlign: 'justify', marginTop: 16, marginBottom: 16 }}>
        5. <strong>Responsabilidade pela Legitimidade e Recompra.</strong> O Cedente é integralmente responsável pela existência, validade, exigibilidade e legitimidade dos créditos cedidos, respondendo por vícios de origem, nulidades contratuais ou qualquer circunstância que comprometa a legalidade da cessão. Declara, ainda, que tais créditos não estão sujeitos a vícios como ausência de documentação, irregularidades registrais, vícios construtivos, ausência de "habite-se" ou inadimplemento de obrigações acessórias que possam afetar sua exigibilidade.
        </p>
        <p style={{ textAlign: 'justify', marginTop: 16, marginBottom: 16, paddingLeft: '24px' }}>
        5.1 O Cedente obriga-se a fornecer à Cessionária, mediante solicitação e no prazo de até 3 (três) dias úteis, todos os documentos comprobatórios da existência e regularidade dos créditos, incluindo contratos, aditivos, boletos, comprovantes de pagamento e garantias eventualmente constituídas (tais como alienação fiduciária, hipoteca ou fiança).
        </p>
        <p style={{ textAlign: 'justify', marginTop: 16, marginBottom: 16, paddingLeft: '24px' }}>
        5.2 A Cedente e os Devedores Solidários assumem, de forma expressa e irrevogável, a responsabilidade solidária com os devedores cedidos pelo pagamento integral e pontual de todos os Direitos Creditórios cedidos, abrangendo principal, juros, multas e demais encargos, bem como a obrigação de recomprar, pelo valor de face, corrigido pelo IGP-M/FGV desde a constatação do vício, qualquer crédito que, após a conclusão da operação, revele vício de origem, nulidade ou outra exceção que afete sua validade, liquidez ou exigibilidade, acrescido de juros moratórios de 1% (um por cento) ao mês, honorários advocatícios e multa de 5% (cinco por cento) se o pagamento ocorrer em até 5 (cinco) dias da notificação, 10% (dez por cento) se entre 6 (seis) e 30 (trinta) dias, e 20% (vinte por cento) se após 30 (trinta) dias.
        </p>

        <p style={{ textAlign: 'justify', marginTop: 16, marginBottom: 16 }}>
        6. <strong>Inexigibilidade Parcial ou Total de Créditos.</strong> Verificada, a qualquer tempo, a inexistência ou inexigibilidade de qualquer crédito cedido, decorrente de vício de origem, a Cedente será notificada para, no prazo de 48 (quarenta e oito) horas, sanar o vício ou, sendo isso inviável, restituir à Cessionária o valor correspondente, limitado à parte considerada juridicamente inexigível.
        </p>

        <p style={{ textAlign: 'justify', marginTop: 16, marginBottom: 16 }}>
        7. <strong>Natureza Irrevogável e Executiva.</strong> O presente instrumento é firmado em caráter irrevogável e irretratável, obrigando as partes, seus herdeiros e/ou sucessores a qualquer título.  A este contrato, atribui-se a condição de título executivo extrajudicial na forma da legislação processual em vigor. A liquidez do presente contrato, para fins legais, será apurada pela soma do valor dos créditos antecipados não pagos pelo devedor, seja em virtude da constatação de vício de origem ou qualquer outra exceção, ou ainda por mero inadimplemento, acrescido dos encargos de mora previstos no presente contrato.
        </p>

        <p style={{ textAlign: 'justify', marginTop: 16, marginBottom: 16 }}>
        8. <strong>Assinatura Eletrônica.</strong> As partes desde já acordam que este Contrato poderá ser assinado eletronicamente, nos termos do art. 10º, § 2º, da Medida Provisória 2.200-2 de 24 de agosto de 2001, e demais alterações posteriores, por meio de plataforma indicada pelo Cessionário e automaticamente aceita pelas partes por ocasião da efetiva assinatura.
        </p>

        <p style={{ textAlign: 'justify', marginTop: 16, marginBottom: 16 }}>
        9. <strong>Foro.</strong> Fica eleito o Foro da Comarca de São Paulo para dirimir quaisquer questões oriundas da presente cessão. 
        </p>

        <p style={{ textAlign: 'center', marginTop: '40px' }}>
          São Paulo, {new Date().toLocaleDateString('pt-BR', { day: '2-digit' })} de {new Date().toLocaleDateString('pt-BR', { month: 'long' })} de {new Date().toLocaleDateString('pt-BR', { year: 'numeric' })}.
        </p>

        <div style={{ marginTop: '40px', textAlign: 'center' }}>
        <p style={{ marginTop: '40px', fontFamily: 'cursive', fontSize: '26px' }}><em>
          {cedente.razaoSocial}
          </em></p>
          <p>_________________________________________________________________</p>
          <p>{cedente.razaoSocial}</p>
          <p>CNPJ nº {cedente.cnpj}. Por seu representante legal {user.email}</p>
          <p>Cedente</p>

          <p style={{ marginTop: '40px', fontFamily: 'cursive', fontSize: '26px' }}><em>
            {'Construcredit Securitizadora S.A.'}
            </em></p>
          <p>_________________________________________________________________</p>
          <p><strong>CONSTRUCREDIT SECURITIZADORA S.A</strong></p>
          <p>CNPJ nº 43.738.268/0001-38. Por seu representante legal Bruno Dante Chiaroni</p>
          <p>Cessionária</p>
        </div>
      </div>
    </div>
  );
};
