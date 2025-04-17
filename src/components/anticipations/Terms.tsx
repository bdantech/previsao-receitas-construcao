
type TProps = {
    cedente: {
        razaoSocial: string
        cnpj: string
    },
    devedor: string
    devedorSolidario: string
    recebiveis: {
        comprador: string
        cpf: string
        vencimento: string
        valor: string
    }[]
    valores: {
        valorTotalCreditosVencimento: number
        precoPagoCessao: number
        formaPagamento: string
        descontos: number
        valorLiquidoPagoAoCedente: number
        dataPagamento: string
    }
    user: {
        email: string
    }
    refComponent: React.RefObject<HTMLDivElement>
}


export const AnticipationTerms = (props: TProps) => {
    const { refComponent, cedente, devedor, devedorSolidario, recebiveis, valores, user } = props;
    return (
        <div style={{ maxHeight: '400px', overflow: 'auto' }}>
            <div ref={refComponent} style={{ maxWidth: '595.3pt', margin: '0 auto', lineHeight: '115%' }}>
                <h1 style={{ textAlign: 'center', fontWeight: 'bold', marginTop: '12pt', marginBottom: '12pt' }}>
                    CONTRATO DE CESSÃO DE CRÉDITOS
                </h1>

                <table style={{ borderCollapse: 'collapse', margin: '4.8pt', width: '100%' }}>
                    <tbody>
                        <tr>
                            <td style={{ width: '50%', padding: '0 5.4pt' }}>
                                <p style={{ margin: '12pt 0', textAlign: 'justify', fontWeight: 'bold' }}>CEDENTE</p>
                            </td>
                            <td style={{ width: '50%', padding: '0 5.4pt' }}>
                                <p style={{ margin: '12pt 0', textAlign: 'justify' }}>
                                    <strong>{cedente.razaoSocial}</strong>, CNPJ n° <strong>{cedente.cnpj}</strong>
                                </p>
                            </td>
                        </tr>
                        <tr>
                            <td style={{ padding: '0 5.4pt' }}>
                                <p style={{ margin: '12pt 0', textAlign: 'justify', fontWeight: 'bold' }}>CESSIONÁRIA</p>
                            </td>
                            <td style={{ padding: '0 5.4pt' }}>
                                <p style={{ margin: '0', textAlign: 'justify' }}>
                                    <strong style={{ fontVariant: 'small-caps' }}>CONSTRUCREDIT SECURITIZADORA S.A.</strong>, CNPJ nº <strong>43.738.268/0001-38</strong>, sedeada no endereço <strong>Avenida Angelica 2346 Conj 112, Consolacao, São Paulo SP</strong> – CEP: <strong>01228-200</strong>
                                </p>
                            </td>
                        </tr>
                        <tr>
                            <td style={{ padding: '0 5.4pt' }}>
                                <p style={{ margin: '12pt 0', textAlign: 'justify', fontWeight: 'bold' }}>DEVEDOR</p>
                            </td>
                            <td style={{ padding: '0 5.4pt' }}>
                                <p style={{ margin: '12pt 0', textAlign: 'justify', fontWeight: 'bold', backgroundColor: 'yellow' }}>{devedor}</p>
                            </td>
                        </tr>
                        <tr>
                            <td style={{ padding: '0 5.4pt' }}>
                                <p style={{ margin: '12pt 0', textAlign: 'justify', fontWeight: 'bold' }}>DEVEDOR SOLIDÁRIO</p>
                            </td>
                            <td style={{ padding: '0 5.4pt' }}>
                                <p style={{ margin: '12pt 0', textAlign: 'justify', fontWeight: 'bold', backgroundColor: 'yellow' }}>{devedorSolidario}</p>
                            </td>
                        </tr>
                    </tbody>
                </table>

                <p style={{ margin: '12pt 0', textAlign: 'justify' }}>&nbsp;</p>

                <ol style={{ margin: '0', fontSize: '11pt' }}>
                    <li style={{ margin: '12pt 0', textAlign: 'justify' }}>
                        O Cedente cede e transfere à Cessionária, em caráter definitivo e irrevogável, os créditos descritos neste instrumento, pelo preço e nas condições aqui ajustadas.
                    </li>
                    <li style={{ margin: '12pt 0', textAlign: 'justify' }}>
                        Os créditos cedidos originam-se de contratos de compra e venda de unidade(s) imobiliária(s), firmados eletronicamente mediante aceite na plataforma [●], ou por assinatura física, conforme o caso. O Cedente obriga-se a fornecer à Cessionária, mediante solicitação e no prazo de até 3 (três) dias úteis, todos os documentos comprobatórios da existência e regularidade dos créditos, incluindo contratos, aditivos, boletos, comprovantes de pagamento e garantias eventualmente constituídas (tais como alienação fiduciária, hipoteca ou fiança).
                    </li>
                    <li style={{ margin: '12pt 0', textAlign: 'justify' }}>
                        A Cedente transmite à Cessionária os Direitos Creditórios:
                        <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: '6pt', border: '1pt solid black' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f2f2f2' }}>
                                    <th style={{ border: '1pt solid black', padding: '0 5.4pt', textAlign: 'center' }}>Direitos Creditórios</th>
                                    <th style={{ border: '1pt solid black', borderLeft: 'none', padding: '0 5.4pt', textAlign: 'center', minWidth: '150px' }}>Devedores ou Sacados</th>
                                    <th style={{ border: '1pt solid black', borderLeft: 'none', padding: '0 5.4pt', textAlign: 'center' }}>Vencimento</th>
                                    <th style={{ border: '1pt solid black', borderLeft: 'none', padding: '0 5.4pt', textAlign: 'center' }}>Valor no vencimento</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td rowSpan={6} style={{ border: '1pt solid black', padding: '0 5.4pt', verticalAlign: 'top' }}>
                                        <p style={{ margin: '6pt 0', textAlign: 'justify', backgroundColor: 'yellow' }}>
                                            Os créditos ora cedidos decorrem do(s) Contrato(s) de Compra e Venda de unidade(s) imobiliária(s) celebrado(s) entre o Cedente e o(s) Devedor(es), identificado(s) no(s) instrumento(s) particular(es) datado(s) de [●], relativo(s) à(s) unidade(s) [descrever – número, torre, matrícula, empreendimento], com vencimento(s) e valores conforme discriminado(s) na cláusula 1ª e/ou em anexo a este instrumento
                                        </p>
                                    </td>
                                </tr>
                                {recebiveis.map((item, index) => (
                                    <tr key={index}>
                                        <td style={{ border: '1pt solid black', borderLeft: 'none', padding: '0 5.4pt', textAlign: 'center' }}>
                                            <p style={{ margin: '6pt 0' }}>{item.comprador} <br /> {item.cpf}</p>
                                        </td>
                                        <td style={{ border: '1pt solid black', borderLeft: 'none', padding: '0 5.4pt', textAlign: 'justify' }}>
                                            <p style={{ margin: '6pt 0' }}>
                                                {item.vencimento}
                                            </p>
                                        </td>
                                        <td style={{ border: '1pt solid black', borderLeft: 'none', padding: '0 5.4pt', textAlign: 'justify' }}>
                                            <p style={{ margin: '6pt 0' }}>
                                                {item.valor}
                                            </p>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </li>
                    <li style={{ margin: '12pt 0', textAlign: 'justify' }}>
                        Tais créditos decorrem de Contrato(s) de Compra e Venda de unidade(s) imobiliária(s) celebrado(s) entre o Cedente e o(s) Devedor(es), identificado(s) nos instrumentos particulares datados de [●], relativos à(s) unidade(s) [descrever: número, torre, matrícula, empreendimento], com vencimentos e valores conforme [...] a este instrumento.
                    </li>
                    <li style={{ margin: '12pt 0', textAlign: 'justify' }}>
                        Condições da cessão:
                        <table style={{ borderCollapse: 'collapse', width: '100%', border: '1pt solid black' }}>
                            <tbody>
                                <tr>
                                    <td style={{ border: '1pt solid black', padding: '5pt 5.4pt', width: '50%' }}>
                                        <p style={{ margin: '0', textAlign: 'justify' }}>Valor total dos Créditos no Vencimento</p>
                                    </td>
                                    <td style={{ border: '1pt solid black', borderLeft: 'none', padding: '0 5.4pt' }}>
                                        <p style={{ margin: '0', textAlign: 'justify' }}>
                                            R$
                                            {valores.valorTotalCreditosVencimento.toLocaleString('pt-BR', {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                            })}

                                        </p>
                                    </td>
                                </tr>
                                <tr>
                                    <td style={{ border: '1pt solid black', borderTop: 'none', padding: '0 5.4pt' }}>
                                        <p style={{ margin: '0', textAlign: 'justify' }}>Preço pago pela cessão</p>
                                    </td>
                                    <td style={{ border: '1pt solid black', borderLeft: 'none', borderTop: 'none', padding: '5pt 5.4pt' }}>
                                        <p style={{ margin: '0', textAlign: 'justify' }}>
                                            R$
                                            {
                                                (valores.valorTotalCreditosVencimento - valores.valorLiquidoPagoAoCedente).toLocaleString('pt-BR', {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2,
                                                })
                                            }
                                        </p>
                                    </td>
                                </tr>
                                <tr>
                                    <td style={{ border: '1pt solid black', borderTop: 'none', padding: '0 5.4pt' }}>
                                        <p style={{ margin: '0', textAlign: 'justify' }}>Forma de Pagamento</p>
                                    </td>
                                    <td style={{ border: '1pt solid black', borderLeft: 'none', borderTop: 'none', padding: '5pt 5.4pt' }}>
                                        <p style={{ margin: '0', textAlign: 'justify' }}>
                                            {valores.formaPagamento}
                                        </p>
                                    </td>
                                </tr>
                                <tr>
                                    <td style={{ border: '1pt solid black', borderTop: 'none', padding: '0 5.4pt' }}>
                                        <p style={{ margin: '0', textAlign: 'justify' }}>Descontos (recompras, despesas e taxas, R$)</p>
                                    </td>
                                    <td style={{ border: '1pt solid black', borderLeft: 'none', borderTop: 'none', padding: '5pt 5.4pt' }}>
                                        <p style={{ margin: '0', textAlign: 'justify' }}>
                                            R$
                                            {valores.descontos.toLocaleString('pt-BR', {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                            })}
                                        </p>
                                    </td>
                                </tr>
                                <tr>
                                    <td style={{ border: '1pt solid black', borderTop: 'none', padding: '5pt 5.4pt' }}>
                                        <p style={{ margin: '0', textAlign: 'justify' }}>Valor líquido pago ao cedente (R$) na data deste contrato</p>
                                    </td>
                                    <td style={{ border: '1pt solid black', borderLeft: 'none', borderTop: 'none', padding: '0 5.4pt' }}>
                                        <p style={{ margin: '0', textAlign: 'justify' }}>
                                            R$
                                            {valores.valorLiquidoPagoAoCedente.toLocaleString('pt-BR', {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                            })}
                                        </p>
                                    </td>
                                </tr>
                                <tr>
                                    <td style={{ border: '1pt solid black', borderTop: 'none', padding: '5pt 5.4pt' }}>
                                        <p style={{ margin: '0', textAlign: 'justify' }}>Data de pagamento</p>
                                    </td>
                                    <td style={{ border: '1pt solid black', borderLeft: 'none', borderTop: 'none', padding: '0 5.4pt' }}>
                                        <p style={{ margin: '0', textAlign: 'justify' }}>{valores.dataPagamento}</p>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </li>
                    <li style={{ margin: '12pt 0', textAlign: 'justify' }}>
                        O Cedente declara que:
                        <ol style={{ listStyleType: 'lower-alpha' }}>
                            <li style={{ margin: '12pt 0' }}>
                                os créditos não foram objeto de cessão anterior, penhora, garantia ou qualquer ônus, e não são objeto de demanda judicial ou disputa quanto à sua existência ou valor;
                            </li>
                            <li style={{ margin: '12pt 0' }}>
                                prestará todas as informações solicitadas pela Cessionária, em até 5 (cinco) dias da solicitação
                            </li>
                            <li style={{ margin: '12pt 0' }}>
                                os créditos decorrem de obrigações contratuais válidas, eficazes e não condicionadas à entrega futura do imóvel, e que os imóveis se encontram <span style={{ backgroundColor: 'yellow' }}>[entregues/em construção/regularizados, conforme o caso]</span>.
                            </li>
                        </ol>
                    </li>
                    <li style={{ margin: '12pt 0', textAlign: 'justify' }}>
                        O Cedente é integralmente responsável pela existência, validade, exigibilidade e legitimidade dos créditos cedidos, respondendo por vícios de origem, nulidades contratuais ou qualquer circunstância que comprometa a legalidade da cessão. Declara, ainda, que tais créditos não estão sujeitos a vícios como ausência de documentação, irregularidades registrais, vícios construtivos, ausência de "habite-se" ou inadimplemento de obrigações acessórias que possam afetar sua exigibilidade.
                    </li>
                    <li style={{ margin: '12pt 0', textAlign: 'justify' }}>
                        A Cedente e os Devedores Solidários assumem, de forma expressa e irrevogável, a responsabilidade solidária com os devedores cedidos pelo pagamento integral e pontual de todos os Direitos Creditórios cedidos, abrangendo principal, juros, multas e demais encargos, bem como a obrigação de recomprar, pelo valor de face, corrigido pelo IGP-M/FGV desde a constatação do vício, qualquer crédito que, após a conclusão da operação, revele vício de origem, nulidade ou outra exceção que afete sua validade, liquidez ou exigibilidade, acrescido de juros moratórios de 1% (um por cento) ao mês, honorários advocatícios e multa de 5% (cinco por cento) se o pagamento ocorrer em até 5 (cinco) dias da notificação, 10% (dez por cento) se entre 6 (seis) e 30 (trinta) dias, e 20% (vinte por cento) se após 30 (trinta) dias.
                    </li>
                    <li style={{ margin: '12pt 0', textAlign: 'justify' }}>
                        Verificada, a qualquer tempo, a inexistência ou inexigibilidade de qualquer crédito cedido, decorrente de vício de origem, a Cedente será notificada para, no prazo de 48 (quarenta e oito) horas, sanar o vício ou, sendo isso inviável, restituir à Cessionária o valor correspondente, limitado à parte considerada juridicamente inexigível.
                    </li>
                    <li style={{ margin: '12pt 0', textAlign: 'justify' }}>
                        O presente instrumento é firmado em caráter irrevogável e irretratável, obrigando as partes, seus herdeiros e/ou sucessores a qualquer título.
                    </li>
                    <li style={{ margin: '12pt 0', textAlign: 'justify' }}>
                        A este contrato, atribui-se a condição de título executivo extrajudicial na forma da legislação processual em vigor. A liquidez do presente contrato, para fins legais, será apurada pela soma do valor dos créditos antecipados não pagos pelo devedor, seja em virtude da constatação de vício de origem ou qualquer outra exceção, ou ainda por mero inadimplemento, acrescido dos encargos de mora previstos no presente contrato.
                    </li>
                    <li style={{ margin: '12pt 0', textAlign: 'justify' }}>
                        As partes desde já acordam que este Contrato poderá ser assinado eletronicamente, nos termos do art. 10º, § 2º, da Medida Provisória 2.200-2 de 24 de agosto de 2001, e demais alterações posteriores, por meio de plataforma indicada pelo Cessionário e automaticamente aceita pelas partes por ocasião da efetiva assinatura.
                    </li>
                    <li style={{ margin: '12pt 0', textAlign: 'justify' }}>
                        Fica eleito o Foro da Comarca de São Paulo para dirimir quaisquer questões oriundas da presente cessão.
                    </li>
                </ol>

                <p style={{ margin: '6pt 0', textAlign: 'center', marginBottom: '20px' }}>
                    São Paulo, de {' '}
                    <span>
                        {new Date().toLocaleDateString('pt-BR', {
                            day: '2-digit',
                        })}
                    </span> {' '}
                    de
                    <span> {' '}
                        {new Date().toLocaleDateString('pt-BR', {
                            month: 'long',
                        })}
                    </span> {' '}
                    de
                    <span> {' '}
                        {new Date().toLocaleDateString('pt-BR', {
                            year: 'numeric',
                        })}
                    </span>.
                </p>

                <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                    <tbody>
                        <tr >
                            <td style={{ padding: '16px 5.4pt', textAlign: 'center' }}>
                                <p style={{ margin: '0' }}><em>assinatura eletrônica</em></p>
                                <p style={{ margin: '0' }}>_________________________________________________________________</p>
                                <p style={{ margin: '0' }}>{cedente.razaoSocial}</p>
                                <p style={{ margin: '0' }}>CNPJ n° {cedente.cnpj}. por seu representante legal {user.email}</p>
                                <p style={{ margin: '0' }}>Cedente</p>
                            </td>
                        </tr>
                        <tr>
                            <td style={{ padding: '16px 5.4pt', textAlign: 'center' }}>
                                <p style={{ margin: '0' }}>&nbsp;</p>
                                <p style={{ margin: '0' }}><em>assinatura eletrônica</em></p>
                                <p style={{ margin: '0' }}>_________________________________________________________________</p>
                                <p style={{ margin: '0' }}>Nome do Devedor Solidário</p>
                                <p style={{ margin: '0' }}>CPF n° [...]</p>
                                <p style={{ margin: '0' }}>Devedor Solidário</p>
                            </td>
                        </tr>
                        <tr>
                            <td style={{ padding: '16px 5.4pt', textAlign: 'center' }}>
                                <p style={{ margin: '0' }}>&nbsp;</p>
                                <p style={{ margin: '0' }}><em>assinatura eletrônica</em></p>
                                <p style={{ margin: '0' }}>_________________________________________________________________</p>
                                <p style={{ margin: '0', fontWeight: 'bold', fontVariant: 'small-caps' }}>CONSTRUCREDIT SECURITIZADORA S.A</p>
                                <p style={{ margin: '0' }}>
                                    CNPJ n° <strong style={{ color: 'black' }}>43.738.268/0001-38</strong>. por seu representante legal Bruno Dante Chiaroni
                                </p>
                                <p style={{ margin: '0' }}>Cessionário</p>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
};
