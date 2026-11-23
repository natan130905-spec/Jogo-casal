#!/usr/bin/env python3
"""Lê as respostas JSON da Meshy CLI (formato meshy.cli/v1) para o script meshy_gerar.sh.
  get <caminho> [<caminho alternativo> ...]  -> imprime o primeiro valor encontrado (stdin)
  status                                      -> confirma tarefa SUCCEEDED (stdin), senão sai com erro
  consumed <task.json> [...]                  -> soma consumed_credits das tarefas salvas
Nunca imprime cabeçalhos, chaves ou URLs assinadas.
"""
import json
import sys


def dig(d, path):
    for part in path.split('.'):
        if not isinstance(d, dict) or part not in d:
            return None
        d = d[part]
    return d


def find(d, key):
    if isinstance(d, dict):
        if key in d:
            return d[key]
        for v in d.values():
            r = find(v, key)
            if r is not None:
                return r
    elif isinstance(d, list):
        for v in d:
            r = find(v, key)
            if r is not None:
                return r
    return None


def main():
    cmd = sys.argv[1]
    if cmd == 'get':
        d = json.load(sys.stdin)
        if not d.get('ok', True):
            err = d.get('error') or {}
            sys.exit(f"erro da Meshy CLI: {err.get('code')} — {err.get('message')}")
        for p in sys.argv[2:]:
            v = dig(d, p)
            if v is not None:
                print(v)
                return
        sys.exit('campo não encontrado: ' + ', '.join(sys.argv[2:]))
    if cmd == 'status':
        d = json.load(sys.stdin)
        st = find(d, 'status')
        if not d.get('ok', True) or str(st).upper() != 'SUCCEEDED':
            err = d.get('error') or {}
            sys.exit(f"tarefa não concluída: status={st} erro={err.get('code')} {err.get('message')}")
        print('   concluída')
        return
    if cmd == 'consumed':
        total, known = 0, True
        for f in sys.argv[2:]:
            v = find(json.load(open(f, encoding='utf-8')), 'consumed_credits')
            if v is None:
                known = False
            else:
                total += v
        print(total if known else f'{total} (incompleto: o Meshy não informou em todas as tarefas)')
        return
    sys.exit('comando desconhecido')


if __name__ == '__main__':
    main()
