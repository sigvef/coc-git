import {exec, ExecOptions, spawn} from 'child_process'
import {Uri, workspace} from 'coc.nvim'

export function shellescape(s: string): string {
  if (process.platform == 'win32') {
    return `"${s.replace(/"/g, '\\"')}"`
  }
  if (/[^A-Za-z0-9_\/:=-]/.test(s)) {
    s = "'" + s.replace(/'/g, "'\\''") + "'"
    s = s.replace(/^(?:'')+/g, '') // unduplicate single-quote at the beginning
      .replace(/\\'''/g, "\\'") // remove non-escaped single-quote if there are enclosed between 2 escaped
    return s
  }
  return s
}

export async function safeRun(cmd: string, opts: ExecOptions = {}): Promise<string> {
  try {
    return await runCommand(cmd, opts, 5000)
  } catch (e) {
    // tslint:disable-next-line: no-console
    console.error(e.message)
    return null
  }
}

export function spawnCommand(cmd: string, args: string[], cwd: string): Promise<string> {
  const cp = spawn(cmd, args, {cwd})
  let res = ''
  return new Promise((resolve, reject) => {
    cp.stdout.on('data', data => {
      res += data.toString()
    })
    cp.stderr.on('data', data => {
      workspace.showMessage(`"${cmd} ${args.join(' ')}" error: ${data.toString()}`, 'error')
    })
    cp.on('close', code => {
      if (code != 0) {
        return reject(new Error(`${cmd} exited with code ${code}`))
      }
      resolve(res)
    })
  })
}

export function runCommandWithData(cmd: string, args: string[], cwd: string, data: string): Promise<string> {
  const cp = spawn(cmd, args, {cwd})
  cp.stdin.write(data, 'utf8')
  cp.stdin.end()
  let res = ''
  return new Promise((resolve, reject) => {
    cp.stdout.on('data', data => {
      res += data.toString()
    })
    cp.stderr.on('data', data => {
      workspace.showMessage(`"${cmd} ${args.join(' ')}" error: ${data.toString()}`, 'error')
    })
    cp.on('close', code => {
      if (code != 0) {
        return reject(new Error(`${cmd} exited with code ${code}`))
      }
      resolve(res)
    })
  })
}

export function runCommand(cmd: string, opts: ExecOptions = {}, timeout?: number): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let timer: NodeJS.Timer
    if (timeout) {
      timer = setTimeout(() => {
        reject(new Error(`timeout after ${timeout}s`))
      }, timeout * 1000)
    }
    exec(cmd, opts, (err, stdout, stderr) => {
      if (timer) clearTimeout(timer)
      if (err) {
        reject(new Error(`exited with ${err.code}\n${stderr}`))
        return
      }
      resolve(stdout)
    })
  })
}

export function getStdout(cmd: string, opts: ExecOptions = {}, timeout?: number): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let timer: NodeJS.Timer
    if (timeout) {
      timer = setTimeout(() => {
        reject(new Error(`timeout after ${timeout}s`))
      }, timeout * 1000)
    }
    exec(cmd, opts, (_err, stdout) => {
      if (timer) clearTimeout(timer)
      if (stdout) {
        resolve(stdout)
        return
      }
      resolve()
    })
  })
}

export function equals(one: any, other: any): boolean {
  if (one === other) {
    return true
  }
  if (
    one === null ||
    one === undefined ||
    other === null ||
    other === undefined
  ) {
    return false
  }
  if (typeof one !== typeof other) {
    return false
  }
  if (typeof one !== 'object') {
    return false
  }
  if (Array.isArray(one) !== Array.isArray(other)) {
    return false
  }

  let i: number
  let key: string

  if (Array.isArray(one)) {
    if (one.length !== other.length) {
      return false
    }
    for (i = 0; i < one.length; i++) {
      if (!equals(one[i], other[i])) {
        return false
      }
    }
  } else {
    const oneKeys: string[] = []

    for (key in one) { // tslint:disable-line
      oneKeys.push(key)
    }
    oneKeys.sort()
    const otherKeys: string[] = []
    for (key in other) { // tslint:disable-line
      otherKeys.push(key)
    }
    otherKeys.sort()
    if (!equals(oneKeys, otherKeys)) {
      return false
    }
    for (i = 0; i < oneKeys.length; i++) {
      if (!equals(one[oneKeys[i]], other[oneKeys[i]])) {
        return false
      }
    }
  }
  return true
}

export function getUrl(remote: string, branch: string, filepath: string, lines?: number[] | string): string {
  let uri = remote.replace(/\.git$/, '')
  if (uri.startsWith('git')) {
    let str = uri.slice(4)
    let parts = str.split(':', 2)
    uri = `https://${parts[0]}/${parts[1]}`
  }
  let u = Uri.parse(uri)
  if (u.authority.startsWith('github.com')) {
    let anchor = ''
    if (lines && Array.isArray(lines)) {
      anchor = lines ? lines.map(l => `L${l}`).join('-') : ''
    } else if (typeof lines == 'string') {
      anchor = lines
    }
    return uri + '/blob/' + branch + '/' + filepath + (anchor ? '#' + anchor : '')
  }
  workspace.showMessage(`Can't get url form: ${u.authority}`, 'warning')
  return ''
}
