const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Conexão com MySQL
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',          // Altera se necessário
    password: '',          // Altera se tiveres password
    database: 'gestao_stock',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// ========== VALIDAÇÕES ==========
function validarProduto(nome, quantidade) {
    if (!nome || nome.trim() === '') {
        return { valido: false, mensagem: 'Nome do produto é obrigatório' };
    }
    if (quantidade === undefined || quantidade === null) {
        return { valido: false, mensagem: 'Quantidade é obrigatória' };
    }
    const qtd = Number(quantidade);
    if (isNaN(qtd) || !Number.isInteger(qtd) || qtd <= 0) {
        return { valido: false, mensagem: 'Quantidade deve ser um número inteiro maior que zero' };
    }
    return { valido: true, quantidade: qtd };
}

// ========== ENDPOINTS ==========

// GET todos os produtos
app.get('/api/produtos', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM produtos ORDER BY nome');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET busca por nome
app.get('/api/produtos/busca/:termo', async (req, res) => {
    try {
        const termo = `%${req.params.termo}%`;
        const [rows] = await pool.query('SELECT * FROM produtos WHERE nome LIKE ? ORDER BY nome', [termo]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST novo produto
app.post('/api/produtos', async (req, res) => {
    try {
        const { nome, quantidade } = req.body;
        const validacao = validarProduto(nome, quantidade);
        if (!validacao.valido) {
            return res.status(400).json({ error: validacao.mensagem });
        }

        const [result] = await pool.query(
            'INSERT INTO produtos (nome, quantidade) VALUES (?, ?)',
            [nome.trim(), validacao.quantidade]
        );

        // Opcional: verificar se quantidade <= 3 e enviar um aviso no response
        const aviso = validacao.quantidade <= 3 ? 'Quantidade baixa (≤ 3)' : null;
        res.status(201).json({ 
            id: result.insertId, 
            nome: nome.trim(), 
            quantidade: validacao.quantidade,
            aviso 
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT atualizar produto
app.put('/api/produtos/:id', async (req, res) => {
    try {
        const { nome, quantidade } = req.body;
        const validacao = validarProduto(nome, quantidade);
        if (!validacao.valido) {
            return res.status(400).json({ error: validacao.mensagem });
        }

        const [result] = await pool.query(
            'UPDATE produtos SET nome = ?, quantidade = ? WHERE id = ?',
            [nome.trim(), validacao.quantidade, req.params.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Produto não encontrado' });
        }

        const aviso = validacao.quantidade <= 3 ? 'Quantidade baixa (≤ 3)' : null;
        res.json({ success: true, aviso });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE produto
app.delete('/api/produtos/:id', async (req, res) => {
    try {
        const [result] = await pool.query('DELETE FROM produtos WHERE id = ?', [req.params.id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Produto não encontrado' });
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PATCH atualizar quantidade (rápido)
app.patch('/api/produtos/:id/quantidade', async (req, res) => {
    try {
        const { quantidade } = req.body;
        // Validação apenas da quantidade
        const qtd = Number(quantidade);
        if (isNaN(qtd) || !Number.isInteger(qtd) || qtd <= 0) {
            return res.status(400).json({ error: 'Quantidade deve ser um número inteiro maior que zero' });
        }

        const [result] = await pool.query(
            'UPDATE produtos SET quantidade = ? WHERE id = ?',
            [qtd, req.params.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Produto não encontrado' });
        }

        const aviso = qtd <= 3 ? 'Quantidade baixa (≤ 3)' : null;
        res.json({ success: true, aviso });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Servir frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Iniciar servidor
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`✅ Servidor a correr em http://localhost:${PORT}`);
});