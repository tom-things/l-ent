import './LentButton.css'

function LentButton({ children, className = '', type = 'button', ...props }) {
  const classes = ['lent-button', className].filter(Boolean).join(' ')

  return (
    <button type={type} className={classes} {...props}>
      <span className="lent-button__label">{children}</span>
    </button>
  )
}

export default LentButton
